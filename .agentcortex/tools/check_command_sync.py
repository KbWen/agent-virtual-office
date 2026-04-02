#!/usr/bin/env python3
"""Compare command inventories between AGENTS.md and CLAUDE.md."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


BACKTICK_PATTERN = re.compile(r"`([^`]+)`")
COMMAND_PATTERN = re.compile(r"^/[a-z][a-z0-9-]*$")
IGNORED_TOKENS = {"/command"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Warn when AGENTS.md and CLAUDE.md command sets drift.")
    parser.add_argument("--root", default=".", help="Repository root")
    parser.add_argument("--agents", default="AGENTS.md", help="AGENTS.md path")
    parser.add_argument("--claude", default="CLAUDE.md", help="CLAUDE.md path")
    return parser.parse_args()


def extract_commands(path: Path) -> set[str]:
    commands: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        for snippet in BACKTICK_PATTERN.findall(line):
            candidate = snippet.strip()
            if COMMAND_PATTERN.match(candidate) and candidate not in IGNORED_TOKENS:
                commands.add(candidate)
    return commands


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    agents_path = (root / args.agents).resolve()
    claude_path = (root / args.claude).resolve()

    if not agents_path.is_file() or not claude_path.is_file():
        print("warning: command sync check skipped because AGENTS.md or CLAUDE.md is missing", file=sys.stderr)
        return 0

    agents_commands = extract_commands(agents_path)
    claude_commands = extract_commands(claude_path)

    only_agents = sorted(agents_commands - claude_commands)
    only_claude = sorted(claude_commands - agents_commands)

    if not only_agents and not only_claude:
        print("Command sync check passed")
        return 0

    print("warning: command inventory drift detected")
    if only_agents:
        print(f"  present only in AGENTS.md: {', '.join(only_agents)}")
    if only_claude:
        print(f"  present only in CLAUDE.md: {', '.join(only_claude)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
