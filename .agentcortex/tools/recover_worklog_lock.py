#!/usr/bin/env python3
"""Acquire, recover, and release Work Log lock files at phase entry/exit.

Acquisition is atomic and never overwrites an active other-holder lock:
- create: O_CREAT|O_EXCL (loser of a create race re-classifies)
- recovery (stale/dead-pid/corrupt): unlink + O_CREAT|O_EXCL — serializes
  racing recoverers; os.replace would let both believe they recovered
- same-owner+session update: tmp + os.replace (racing with yourself is benign)

Exit codes: 0 = acquired/updated/recovered/released/taken-over/missing,
2 = held by another live session (fail closed) or release refused,
3 = persistent filesystem failure (distinct from "lock is active").
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from guard_context_write import pid_alive

DEFAULT_STALE_TIMEOUT_MINUTES = 60
IO_RETRY_ATTEMPTS = 3
IO_RETRY_DELAY_SECONDS = 0.1
ACQUIRE_ATTEMPTS = 2


class LockIOError(OSError):
    """Persistent unlink/replace failure (e.g. Windows AV/indexer hold)."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


@dataclass
class LockDecision:
    status: str
    reason: str
    exit_code: int = 0
    holder: dict[str, Any] | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize(now: datetime | None) -> datetime:
    current = now or _now()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _read_payload(lock: Path) -> tuple[dict[str, Any] | None, str | None]:
    if not lock.exists():
        return None, "missing"
    try:
        payload = json.loads(lock.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, "invalid-json"
    if not isinstance(payload, dict):
        return None, "invalid-json"
    return payload, None


def _timeout_minutes(payload: dict[str, Any], default: int) -> int:
    raw = payload.get("stale_timeout_minutes", default)
    try:
        timeout = int(raw)
    except (TypeError, ValueError):
        return default
    return max(timeout, 0)


def _pid_is_dead(payload: dict[str, Any]) -> bool:
    if "pid" not in payload or payload.get("pid") in (None, ""):
        return False
    try:
        pid = int(payload["pid"])
    except (TypeError, ValueError):
        return True
    return not pid_alive(pid)


def classify_lock(
    lock: Path,
    *,
    now: datetime | None = None,
    stale_timeout_minutes: int = DEFAULT_STALE_TIMEOUT_MINUTES,
) -> LockDecision:
    """Classify a Work Log lock as missing, active, or recoverable."""
    payload, error = _read_payload(lock)
    if error == "missing":
        return LockDecision("missing", "missing")
    if error:
        return LockDecision("recoverable", error)
    assert payload is not None

    if _pid_is_dead(payload):
        return LockDecision("recoverable", "dead-pid", holder=payload)

    updated_at = _parse_datetime(payload.get("updated_at"))
    if updated_at is None:
        return LockDecision("recoverable", "missing-updated-at", holder=payload)

    current = _normalize(now)
    timeout = _timeout_minutes(payload, stale_timeout_minutes)
    age_minutes = (current - updated_at).total_seconds() / 60
    if age_minutes >= timeout:
        return LockDecision("recoverable", "stale-time", holder=payload)

    return LockDecision("active", "active", exit_code=2, holder=payload)


def _lock_payload(
    *,
    owner: str,
    session: str,
    branch: str,
    phase: str,
    now: datetime,
    stale_timeout_minutes: int,
    pid: int | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "owner": owner,
        "session": session,
        "branch": branch,
        "phase": phase,
        "updated_at": now.isoformat(),
        "stale_timeout_minutes": stale_timeout_minutes,
    }
    if pid is not None:
        payload["pid"] = pid
    return payload


def _dump(payload: dict[str, Any]) -> str:
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _with_io_retries(action: Callable[[], Any]) -> Any:
    last: BaseException | None = None
    for attempt in range(IO_RETRY_ATTEMPTS):
        try:
            return action()
        except PermissionError as exc:  # WinError 5 — AV/indexer hold
            last = exc
        except OSError as exc:
            if getattr(exc, "winerror", None) != 32:  # sharing violation
                raise
            last = exc
        if attempt < IO_RETRY_ATTEMPTS - 1:
            time.sleep(IO_RETRY_DELAY_SECONDS)
    raise LockIOError(f"persistent-io-failure: {last}")


def _atomic_create(lock: Path, payload: dict[str, Any]) -> bool:
    """Create the lock with O_EXCL. Returns False if someone else won."""
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(_dump(payload))
    return True


def _replace_write(lock: Path, payload: dict[str, Any]) -> None:
    """Atomic whole-file replace — only for same-session updates and takeover."""
    lock.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=lock.name + ".", suffix=".tmp", dir=str(lock.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(_dump(payload))
        _with_io_retries(lambda: os.replace(tmp, str(lock)))
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def _unlink_tolerant(lock: Path) -> None:
    """Unlink with bounded retries; a missing file means someone beat us — fine."""

    def _do() -> None:
        try:
            lock.unlink()
        except FileNotFoundError:
            pass

    _with_io_retries(_do)


def append_drift_log(worklog: Path, line: str) -> None:
    # Force single-line entries. Interpolated fields (owner/session) come from
    # an untrusted lock JSON; embedded line breaks could otherwise forge section
    # headers or gate receipts in the Work Log. str.splitlines() mirrors the
    # full break set the validators split on (\r, \n, \v, \f, \x1c-\x1e,
    # \x85 NEL, U+2028 LS, U+2029 PS) — do NOT narrow this to just \r/\n.
    line = " ".join(line.splitlines()).strip()
    text = worklog.read_text(encoding="utf-8") if worklog.exists() else ""
    marker = "## Drift Log"
    if marker not in text:
        suffix = "\n\n" if text and not text.endswith("\n\n") else ""
        worklog.write_text(f"{text}{suffix}{marker}\n\n{line}\n", encoding="utf-8")
        return

    start = text.index(marker) + len(marker)
    section_start = text.find("\n", start)
    if section_start == -1:
        section_start = len(text)
    else:
        section_start += 1

    end_candidates = [idx for idx in (text.find("\n---", section_start), text.find("\n## ", section_start)) if idx != -1]
    section_end = min(end_candidates) if end_candidates else len(text)
    section = text[section_start:section_end]
    kept = [existing for existing in section.splitlines() if existing.strip() and existing.strip() != "none"]
    kept.append(line)
    replacement = "\n" + "\n".join(kept) + "\n"
    worklog.write_text(text[:section_start] + replacement + text[section_end:], encoding="utf-8")


def _recovery_drift_line(decision: LockDecision, lock: Path, current: datetime) -> str:
    holder = decision.holder or {}
    prior_owner = holder.get("owner", "unknown")
    prior_session = holder.get("session", "unknown")
    return (
        "- Recovered stale Work Log lock "
        f"on {current.isoformat()}; prior_owner={prior_owner}; "
        f"prior_session={prior_session}; reason={decision.reason}; lock={lock.name}"
    )


def _takeover_drift_line(holder: dict[str, Any], lock: Path, current: datetime) -> str:
    return (
        "- Takeover of ACTIVE Work Log lock "
        f"on {current.isoformat()}; prior_owner={holder.get('owner', 'unknown')}; "
        f"prior_session={holder.get('session', 'unknown')}; lock={lock.name}"
    )


def ensure_lock(
    lock: Path,
    *,
    owner: str,
    session: str,
    branch: str,
    phase: str,
    worklog: Path | None = None,
    now: datetime | None = None,
    stale_timeout_minutes: int = DEFAULT_STALE_TIMEOUT_MINUTES,
    owner_pid: int | None = None,
    include_pid: bool = False,
    takeover: bool = False,
) -> LockDecision:
    if takeover and worklog is None:
        raise ValueError("takeover requires a worklog path so the audit line cannot be skipped")

    current = _normalize(now)
    payload = _lock_payload(
        owner=owner,
        session=session,
        branch=branch,
        phase=phase,
        now=current,
        stale_timeout_minutes=stale_timeout_minutes,
        pid=owner_pid if owner_pid is not None else os.getpid() if include_pid else None,
    )

    decision = classify_lock(lock, now=current, stale_timeout_minutes=stale_timeout_minutes)
    for attempt in range(ACQUIRE_ATTEMPTS):
        if decision.status == "missing":
            if _atomic_create(lock, payload):
                return LockDecision("created", "missing")
            # lost the create race — fall through to re-classify

        elif decision.status == "active":
            holder = decision.holder or {}
            same_session = holder.get("owner") == owner and holder.get("session") == session
            if same_session:
                try:
                    _replace_write(lock, payload)
                except LockIOError as exc:
                    return LockDecision("error", exc.reason, exit_code=3)
                return LockDecision("updated", decision.reason, holder=holder)
            if not takeover:
                return decision  # exit 2 — fail closed
            try:
                _replace_write(lock, payload)
            except LockIOError as exc:
                return LockDecision("error", exc.reason, exit_code=3)
            assert worklog is not None
            append_drift_log(worklog, _takeover_drift_line(holder, lock, current))
            return LockDecision("takeover", "takeover", holder=holder)

        else:  # recoverable
            try:
                _unlink_tolerant(lock)
            except LockIOError as exc:
                return LockDecision("error", exc.reason, exit_code=3)
            if _atomic_create(lock, payload):
                # Drift line only after WINNING the create — a loser writes nothing.
                if worklog is not None:
                    append_drift_log(worklog, _recovery_drift_line(decision, lock, current))
                return LockDecision("recovered", decision.reason, holder=decision.holder)
            # lost the recovery race — fall through to re-classify

        decision = classify_lock(lock, now=current, stale_timeout_minutes=stale_timeout_minutes)

    if decision.status == "active":
        holder = decision.holder or {}
        if holder.get("owner") == owner and holder.get("session") == session:
            return LockDecision("updated", decision.reason, holder=holder)
        return decision
    return LockDecision("contention", "lost-acquire-race", exit_code=2, holder=decision.holder)


def release_lock(lock: Path, *, owner: str, session: str) -> LockDecision:
    """Delete the lock iff owner+session match. Idempotent on missing."""
    payload, error = _read_payload(lock)
    if error == "missing":
        return LockDecision("missing", "missing")
    if error:
        # Ownership unverifiable — refuse; staleness/ensure recovery handles it.
        return LockDecision("refused", "invalid-json", exit_code=2)
    if payload.get("owner") == owner and payload.get("session") == session:
        try:
            _unlink_tolerant(lock)
        except LockIOError as exc:
            return LockDecision("error", exc.reason, exit_code=3)
        return LockDecision("released", "released")
    return LockDecision("refused", "owner-mismatch", exit_code=2, holder=payload)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    ensure = sub.add_parser("ensure", help="atomically create, refresh, or recover a Work Log lock")
    ensure.add_argument("--lock", required=True, type=Path)
    ensure.add_argument("--owner", required=True)
    ensure.add_argument("--session", required=True)
    ensure.add_argument("--branch", required=True)
    ensure.add_argument("--phase", required=True)
    ensure.add_argument("--worklog", type=Path)
    ensure.add_argument("--stale-timeout-minutes", type=int, default=DEFAULT_STALE_TIMEOUT_MINUTES)
    ensure.add_argument("--pid", type=int, help="owner process id; use only for a long-lived lock owner")
    ensure.add_argument(
        "--takeover",
        action="store_true",
        help="user-approved takeover of an ACTIVE other-holder lock; requires --worklog",
    )
    ensure.add_argument("--no-pid", action="store_true", help=argparse.SUPPRESS)

    release = sub.add_parser("release", help="delete the lock iff owner+session match (idempotent)")
    release.add_argument("--lock", required=True, type=Path)
    release.add_argument("--owner", required=True)
    release.add_argument("--session", required=True)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.command == "ensure":
        if args.takeover and args.worklog is None:
            parser.error("--takeover requires --worklog (the takeover audit line cannot be skipped)")
        result = ensure_lock(
            args.lock,
            owner=args.owner,
            session=args.session,
            branch=args.branch,
            phase=args.phase,
            worklog=args.worklog,
            stale_timeout_minutes=args.stale_timeout_minutes,
            owner_pid=None if args.no_pid else args.pid,
            takeover=args.takeover,
        )
        print(json.dumps(asdict(result), sort_keys=True))
        return result.exit_code
    if args.command == "release":
        result = release_lock(args.lock, owner=args.owner, session=args.session)
        print(json.dumps(asdict(result), sort_keys=True))
        return result.exit_code
    return 1


if __name__ == "__main__":
    sys.exit(main())
