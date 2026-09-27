#!/usr/bin/env python3
"""Remap Pulse's navy/neon palette to the minimal charcoal + teal palette.

Usage: python3 scripts/remap-palette.py <file-or-dir> [...]
Rewrites hex and rgb()/rgba() literals in .ts/.tsx/.css/.html files in place.
Idempotent: target colors are not themselves source keys.
"""

import re
import sys
from pathlib import Path

HEX = {
    # grounds and surfaces
    "060B1A": "0a0a0a", "0A0E1F": "0a0a0a", "111830": "0f0f0f", "0F1A33": "111111",
    "12203D": "141414", "141C38": "141414", "17284A": "1a1a1a", "1A2444": "1a1a1a",
    "1F2B52": "1f1f1f", "0D1428": "0f0f0f", "161E3C": "161616", "0B1226": "0f0f0f",
    "274068": "2a2a2a", "232C4A": "222222", "1A2347": "1a1a1a", "131A33": "131313",
    # lines
    "1A2A4D": "1f1f1f", "23305A": "262626", "2E3E6E": "3a3a3a",
    # ink
    "E8EFFF": "f0e8d8", "ECE8FF": "f0e8d8", "F1F5F9": "f0e8d8", "D8D4F0": "e4ddcf",
    "D6E1F5": "e4ddcf", "C0CAF5": "d9d2c4", "A8A5C8": "98a8b3", "9BB0D6": "98a8b3",
    "94A3B8": "98a8b3", "7E7B9E": "7d8d98", "6B80AB": "6b7d89", "6B7FAE": "6b7d89",
    "64748B": "6b7d89", "6B7280": "6b7d89", "565F89": "55636d", "5A5879": "55636d",
    "9CA3AF": "8a9aa5", "444444": "3a3a3a", "EFF3FB": "f0e8d8", "E2E8F4": "e4ddcf",
    "C9D6F0": "d9d2c4", "DAE2F2": "e4ddcf", "475569": "55636d",
    # blues and cyans -> teal
    "3B82F6": "3fb2c9", "002B9D": "1f6f80", "60A5FA": "5cc4d8", "7AA2F7": "5cc4d8",
    "9ACBFF": "a8e2ee", "7DCFFF": "7cd5e6", "7DD3FC": "a8e2ee", "38BDF8": "5cc4d8",
    "22D3EE": "5cc4d8", "06B6D4": "3fb2c9", "A5B4FC": "a8e2ee", "BAE6FD": "cdeef5",
    "2563EB": "2f97ad", "1D4ED8": "1f6f80", "93C5FD": "a8e2ee", "0EA5E9": "3fb2c9",
    "4F8CFF": "3fb2c9",
    # violets -> one muted violet
    "BB9AF7": "a78bfa", "A855F7": "a78bfa", "B794F4": "a78bfa", "9D7CD8": "a78bfa",
    "C8B0F7": "c4b5fd", "8B5CF6": "a78bfa", "7C3AED": "8b6fe0", "B98CFF": "a78bfa",
    # greens
    "34D399": "22c55e", "4ADE80": "22c55e", "9ECE6A": "22c55e", "10B981": "22c55e",
    "6FD6A1": "5fd18a", "6EE7B7": "5fd18a", "6EE7D3": "7cd5e6", "2DD4BF": "3fb2c9",
    "73DACA": "5cc4d8",
    # warm
    "E0A458": "f5c451", "E0AF68": "f5c451", "FBBF24": "f5c451", "EAB308": "f5c451",
    "F59E0B": "f5c451", "F0A35E": "fbd57a", "E5C07B": "fbd57a", "FF9E64": "f97316",
    "F4A974": "f97316",
    # reds and pinks
    "F87B7B": "f97316", "F7768E": "f87171", "EF4444": "f87171", "F08A7A": "f87171",
    "F472B6": "f87171", "EC4899": "f87171",
}

RGB = {
    (154, 203, 255): (168, 226, 238), (59, 130, 246): (63, 178, 201),
    (251, 191, 36): (245, 196, 81), (168, 165, 200): (152, 168, 179),
    (125, 211, 252): (168, 226, 238), (240, 163, 94): (251, 213, 122),
    (52, 211, 153): (34, 197, 94), (248, 123, 123): (249, 115, 22),
    (183, 148, 244): (167, 139, 250), (74, 222, 128): (34, 197, 94),
    (45, 212, 191): (63, 178, 201), (107, 128, 171): (107, 125, 137),
    (96, 165, 250): (92, 196, 216), (6, 11, 26): (10, 10, 10),
    (224, 164, 88): (245, 196, 81), (15, 26, 51): (17, 17, 17),
    (51, 65, 85): (58, 58, 58), (165, 180, 252): (168, 226, 238),
    (20, 28, 56): (20, 20, 20), (158, 206, 106): (34, 197, 94),
    (125, 207, 255): (124, 213, 230), (110, 231, 183): (95, 209, 138),
    (30, 41, 59): (26, 26, 26), (30, 31, 42): (26, 26, 26), (2, 6, 23): (8, 8, 8),
    (247, 118, 142): (248, 113, 113), (244, 169, 116): (249, 115, 22),
    (24, 25, 35): (24, 24, 24), (224, 175, 104): (245, 196, 81),
    (186, 230, 253): (205, 238, 245), (155, 176, 214): (152, 168, 179),
    (148, 163, 184): (152, 168, 179), (139, 154, 193): (125, 141, 152),
    (13, 20, 40): (15, 15, 15), (10, 14, 31): (10, 10, 10),
    (35, 48, 90): (38, 38, 38), (26, 42, 77): (31, 31, 31),
    (232, 239, 255): (240, 232, 216), (236, 232, 255): (240, 232, 216),
    (6, 182, 212): (63, 178, 201), (34, 211, 238): (92, 196, 216),
    (168, 85, 247): (167, 139, 250), (187, 154, 247): (167, 139, 250),
    (122, 162, 247): (92, 196, 216), (234, 179, 8): (245, 196, 81),
    (239, 68, 68): (248, 113, 113), (16, 185, 129): (34, 197, 94),
    (99, 102, 241): (63, 178, 201), (139, 92, 246): (167, 139, 250),
}

HEX_RE = re.compile(r"#([0-9A-Fa-f]{6})(?![0-9A-Fa-f])")
RGB_RE = re.compile(r"(rgba?\(\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})")


def remap(text: str) -> str:
    text = HEX_RE.sub(lambda m: "#" + HEX.get(m.group(1).upper(), m.group(1)), text)

    def rgb(m: re.Match) -> str:
        key = (int(m.group(2)), int(m.group(4)), int(m.group(6)))
        if key not in RGB:
            return m.group(0)
        r, g, b = RGB[key]
        return f"{m.group(1)}{r}{m.group(3)}{g}{m.group(5)}{b}"

    return RGB_RE.sub(rgb, text)


def main() -> None:
    changed = 0
    for arg in sys.argv[1:]:
        root = Path(arg)
        files = [root] if root.is_file() else [
            p for p in root.rglob("*")
            if p.suffix in {".ts", ".tsx", ".css", ".html"} and "node_modules" not in p.parts
        ]
        for path in files:
            before = path.read_text(encoding="utf-8")
            after = remap(before)
            if after != before:
                path.write_text(after, encoding="utf-8")
                changed += 1
    print(f"remapped {changed} files")


if __name__ == "__main__":
    main()
