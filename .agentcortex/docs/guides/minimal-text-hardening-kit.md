# Minimal Text Hardening Kit

This guide defines the smallest reusable package for reducing Windows text corruption, encoding drift, and patch fragility in downstream repositories.

## Goal

Block new text-integrity regressions without rewriting existing localized or legacy files.

## Minimal Kit Components

1. `.gitattributes`
- Define default text handling.
- Pin `lf` for common text files and `crlf` for `*.ps1`, `*.cmd`, `*.bat`.

2. `.editorconfig`
- Keep new writes consistent (`utf-8`, final newline, stable EOL rules).

3. `tools/check_text_integrity.py`
- Cross-platform preflight for tracked text files.
- Detect `utf8-bom`, invalid UTF-8, mixed EOL, and null bytes.

4. `tools/check_text_integrity.ps1`
- Windows-native equivalent for PowerShell-first environments.

5. `tools/text_integrity_baseline.txt`
- Records known legacy exceptions.
- Validation blocks only new regressions outside the baseline.

6. Validation hook
- Call the text-integrity preflight from the repo's existing `validate` entrypoint.
- Do not create a second validation workflow unless necessary.

## Integration Steps

1. Copy the five files above into the target repository.
2. Wire the integrity check into the existing `validate` script or equivalent preflight entrypoint.
3. Run the integrity check once and record current legacy exceptions into `tools/text_integrity_baseline.txt`.
4. Keep future cleanup incremental; do not mass-reencode multilingual docs unless explicitly planned.

## Recommended Defaults

- New text files: UTF-8 without BOM
- Shell / Markdown / YAML / JSON / TOML: `LF`
- PowerShell / CMD / BAT: `CRLF`
- Validation behavior: fail only on new regressions, not on pre-existing baseline exceptions

## Non-Goals

- No global rewrite of old docs.
- No workflow or rules migration.
- No promise that editor/patch corruption becomes impossible; the goal is to reduce frequency and detect drift earlier.