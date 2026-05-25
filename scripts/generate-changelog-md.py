#!/usr/bin/env python3
"""Generate CHANGELOG.md from src/lib/changelog.ts + src/utils/translations/changelog.ts.

The in-app changelog is the single source of truth. This script renders
a Keep-a-Changelog-flavored markdown file at the repo root so the OSS
audience (and tooling like Dependabot, release-drafter) sees a familiar
format without us maintaining two copies.

Run: python3 scripts/generate-changelog-md.py
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "src" / "lib" / "changelog.ts"
TRANS = ROOT / "src" / "utils" / "translations" / "changelog.ts"
OUT = ROOT / "CHANGELOG.md"

# Pull every (dateKey, releaseLevel) from src/lib/changelog.ts. Order in
# the file is reverse-chronological per month, which is the order we emit.
entry_re = re.compile(
    r'dateKey:\s*"changelogDate(\d{8})".*?(?:releaseLevel:\s*"(\w+)")?\s*\},',
    re.DOTALL,
)


def parse_entries() -> list[tuple[str, str | None]]:
    text = LIB.read_text()
    out: list[tuple[str, str | None]] = []
    for m in entry_re.finditer(text):
        date_key, level = m.group(1), m.group(2)
        out.append((date_key, level))
    return out


def parse_translation(date_key: str) -> dict[str, str]:
    """Pull EN-block fields for a single date_key from the translations file."""
    text = TRANS.read_text()
    # Find the EN block (between `en: {` and the matching `},\n  it: {`).
    en_match = re.search(r"en:\s*\{(.*?)\n\s*\},\s*\n\s*it:", text, re.DOTALL)
    if not en_match:
        return {}
    en_block = en_match.group(1)
    fields: dict[str, str] = {}
    # Format for header fields: changelog{Suffix}{date} (e.g. changelogTitle20260524)
    # Format for item fields:   changelogItem{date}{A|B|C} (suffix after date)
    plan = [
        ("date",    f"changelogDate{date_key}"),
        ("version", f"changelogVersion{date_key}"),
        ("title",   f"changelogTitle{date_key}"),
        ("body",    f"changelogBody{date_key}"),
        ("itema",   f"changelogItem{date_key}A"),
        ("itemb",   f"changelogItem{date_key}B"),
        ("itemc",   f"changelogItem{date_key}C"),
    ]
    for field, key in plan:
        m = re.search(
            rf'{re.escape(key)}:\s*"(.+?)(?<!\\)"(?:\s*,|$)',
            en_block,
            re.DOTALL,
        )
        if m:
            val = m.group(1).replace('\\"', '"').replace("\\n", "\n")
            # Collapse multi-line string concatenations down to one line.
            val = re.sub(r'"\s*\+\s*\n\s*"', "", val)
            fields[field] = val
    return fields


def main() -> None:
    entries = parse_entries()
    if not entries:
        raise SystemExit("Could not parse any entries from " + str(LIB))

    lines: list[str] = [
        "# Changelog",
        "",
        "Single source of truth: `src/lib/changelog.ts` + `src/utils/translations/changelog.ts` (these power the in-app `/changelog` page). Regenerate this file with `python3 scripts/generate-changelog-md.py`.",
        "",
        'Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions in chronological order, most recent first.',
        "",
        "---",
        "",
    ]

    current_month = ""
    for date_key, level in entries:
        f = parse_translation(date_key)
        if not f:
            continue
        month = f.get("date", "").rsplit(",", 1)[0].split(" ", 1)[0] + " " + f.get("date", "").rsplit(",", 1)[-1].strip()
        if month != current_month:
            lines.append(f"## {month}")
            lines.append("")
            current_month = month

        version = f.get("version", "")
        title = f.get("title", "")
        date = f.get("date", "")
        body = f.get("body", "")
        items = [f.get(k) for k in ("itema", "itemb", "itemc") if f.get(k)]
        badge = ""
        if level == "major":
            badge = " · **major**"
        elif level == "important":
            badge = " · important"

        lines.append(f"### {version} — {title}{badge}")
        lines.append(f"_{date}_")
        lines.append("")
        if body:
            lines.append(body)
            lines.append("")
        for item in items:
            lines.append(f"- {item}")
        lines.append("")

    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT} ({len(entries)} entries)")


if __name__ == "__main__":
    main()
