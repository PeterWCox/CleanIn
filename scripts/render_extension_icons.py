#!/usr/bin/env python3
"""
Build dist/icons from logo.png: remove the flat gray background via flood fill,
place the mark on a white disk, and export 16/32/48/128 sizes.
Run from repo root: python3 scripts/render_extension_icons.py
"""
from __future__ import annotations

import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(REPO, "logo.png")
OUT_DIR = os.path.join(REPO, "dist", "icons")
SIZES = (16, 32, 48, 128)


def flood_remove_border_background(rgba: np.ndarray, thresh: float = 50) -> np.ndarray:
    h, w = rgba.shape[:2]
    ref = np.mean(
        [
            rgba[0, 0, :3],
            rgba[0, w - 1, :3],
            rgba[h - 1, 0, :3],
            rgba[h - 1, w - 1, :3],
        ],
        axis=0,
    )
    a = rgba.copy().astype(np.uint8)

    def near_bg(px: np.ndarray) -> bool:
        p = px[:3].astype(np.float32)
        if np.max(p) < 80:
            return False
        return float(np.linalg.norm(p - ref)) <= thresh

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(1, h - 1):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y, x]:
            continue
        if not near_bg(rgba[y, x]):
            continue
        visited[y, x] = True
        a[y, x, 3] = 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q.append((x + dx, y + dy))
    return a


def build_master(size: int = 512) -> Image.Image:
    """Square RGBA: transparent outside a white disk, art centered on the disk."""
    im = Image.open(LOGO).convert("RGBA")
    cut = flood_remove_border_background(np.array(im))
    cut = Image.fromarray(cut)
    # Tight box around opaque pixels
    bbox = cut.getbbox()
    if not bbox:
        raise RuntimeError("No opaque pixels after background removal")
    cut = cut.crop(bbox)
    w0, h0 = cut.size

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Smaller margin => larger white disk behind the mark.
    base = int(round(size * 0.04))
    margin = max(1, base - 2)  # a few px larger disk than proportional margin alone
    m = margin
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((m, m, size - 1 - m, size - 1 - m), fill=(255, 255, 255, 255))
    disc_d = (size - 1 - 2 * m)  # ~ inner diameter
    # Fit artwork in ~78% of disc diameter, centered
    target_max = int(disc_d * 0.78)
    s = min(target_max / w0, target_max / h0)
    nw, nh = max(1, int(round(w0 * s))), max(1, int(round(h0 * s)))
    art = cut.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.paste(art, (x, y), art)
    return canvas


def main() -> int:
    if not os.path.isfile(LOGO):
        print(f"Missing {LOGO}", file=sys.stderr)
        return 1
    os.makedirs(OUT_DIR, exist_ok=True)
    master = build_master(512)
    for dim in SIZES:
        out = master.resize((dim, dim), Image.Resampling.LANCZOS)
        path = os.path.join(OUT_DIR, f"icon{dim}.png")
        out.save(path, "PNG", optimize=True)
        print("wrote", path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
