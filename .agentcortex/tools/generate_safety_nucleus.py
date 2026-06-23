#!/usr/bin/env python3
"""Generate / freshness-check the portable safety nucleus
(`.agentcortex/AGENTS.safety.md`) from the AGENTS.md ACX:SAFETY-FLOOR fenced span.

Source of truth: the fenced span in AGENTS.md (the always-loaded safety invariants
+ the subagent-delegation line). A non-shim harness injects the generated nucleus
into every dispatched subagent so the safety floor is inherited even when the
subagent never runs `/bootstrap` (ADR-008).

Usage:
  generate_safety_nucleus.py            # (re)write .agentcortex/AGENTS.safety.md (LF)
  generate_safety_nucleus.py --check    # exit 1 if the nucleus drifts from the fence
                                        #   source repo (no manifest): drift -> FAIL (exit 1)
                                        #   downstream (manifest present): drift -> WARN (exit 0)

Mirrors the generate_compact_index.py `--check` freshness pattern. No third-party deps
(no-python downstream: validate.* runs this via run_python_check, which SKIPs when
Python is absent — the committed nucleus still ships as a core file).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGENTS = ROOT / "AGENTS.md"
NUCLEUS = ROOT / ".agentcortex" / "AGENTS.safety.md"
MANIFEST = ROOT / ".agentcortex-manifest"  # downstream install marker (absent in source repo)

BEGIN = "<!-- ACX:SAFETY-FLOOR:BEGIN"
END = "<!-- ACX:SAFETY-FLOOR:END -->"

HEADER = (
    "<!-- GENERATED from the AGENTS.md ACX:SAFETY-FLOOR span by "
    "generate_safety_nucleus.py - DO NOT EDIT BY HAND; run the generator. -->\n"
    "# ACX Safety Floor (inherited nucleus)\n\n"
    "The always-loaded safety floor every dispatched / autonomous agent MUST honor. "
    "A harness that spawns subagents SHOULD inject this file into each subagent's "
    "context so the floor is inherited even when the subagent never runs `/bootstrap`.\n\n"
)


def _norm(text):
    """CR-normalize so a CRLF working-tree checkout compares equal to an LF nucleus."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def extract_span():
    lines = _norm(AGENTS.read_text(encoding="utf-8")).split("\n")
    start = end = None
    for i, ln in enumerate(lines):
        if ln.startswith(BEGIN):
            start = i + 1
        elif ln.strip() == END:
            end = i
            break
    if start is None or end is None or start > end:
        sys.stderr.write(
            "ERROR: ACX:SAFETY-FLOOR BEGIN/END markers not found (or malformed) in AGENTS.md\n"
        )
        sys.exit(2)
    return "\n".join(lines[start:end]).strip("\n")


def build():
    return HEADER + extract_span() + "\n"


def main():
    content = build()
    if "--check" in sys.argv:
        if not NUCLEUS.exists():
            drift = "AGENTS.safety.md missing"
        elif _norm(NUCLEUS.read_text(encoding="utf-8")) != _norm(content):
            drift = "AGENTS.safety.md out of sync with the AGENTS.md safety-floor span"
        else:
            return 0
        if MANIFEST.exists():
            sys.stderr.write(
                "WARN (downstream): %s - your AGENTS.md safety floor differs from the "
                "shipped nucleus; regenerate or accept your override.\n" % drift
            )
            return 0
        sys.stderr.write(
            "FAIL: %s - run `python .agentcortex/tools/generate_safety_nucleus.py` and commit.\n"
            % drift
        )
        return 1
    with open(NUCLEUS, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
    sys.stdout.write(
        "Wrote %s (%d lines)\n" % (NUCLEUS.relative_to(ROOT).as_posix(), len(content.splitlines()))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
