"""Deterministic background-residue cleanup for Pixel candidate art (owner-requested 2026-11-09).

Some Gemini candidates were exported on white and then background-removed, which left opaque
light-grey pixels on the outer silhouette (worst around the shoes, sometimes a strip under the
soles). This tool makes ONLY those residue pixels transparent:

  * works on the 64x64 logical grid (every logical pixel is an exact 8x8 block; refuses otherwise)
  * a pixel is residue when it is opaque, light (min channel > 100) and near-neutral
    (max-min < 30), 4-connected to the OUTSIDE transparent region, and its colour is NOT within
    6 (per channel) of any opaque colour of that role's ORIGINAL master - so identity whites such
    as Dev's sneakers, QA's sleeves or Gate's silver hair are kept
  * peels at most 2 layers (the 1-2 px blended rim/strip), never touches interior pixels
  * changes alpha only (to 0) for whole 8x8 blocks; every other pixel is copied unchanged

Usage: python scripts/pixel_alpha_cleanup.py <candidate.png> <master.png> <out.png>
Prints a JSON report (removed logical pixels, input/output sha256). Requires Pillow.
Originals are never modified; the report is the provenance record.
"""
import hashlib
import json
import sys

from PIL import Image

LIGHT_MIN, NEUTRAL_SPREAD, PALETTE_TOL, MAX_LAYERS = 100, 30, 6, 2


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def grid_of(im):
    px = im.load()
    w, h = im.size
    if (w, h) != (512, 512):
        raise SystemExit(f'expected 512x512, got {w}x{h}')
    g = []
    for by in range(64):
        row = []
        for bx in range(64):
            c = px[bx * 8, by * 8]
            for y in range(8):
                for x in range(8):
                    if px[bx * 8 + x, by * 8 + y] != c:
                        raise SystemExit(f'non-uniform 8x8 block at logical ({bx},{by})')
            row.append(c)
        g.append(row)
    return g


def main(cand_path, master_path, out_path):
    cand = Image.open(cand_path).convert('RGBA')
    master = Image.open(master_path).convert('RGBA')
    g = grid_of(cand)
    mg = grid_of(master)
    palette = {c[:3] for row in mg for c in row if c[3] >= 250}

    def in_palette(rgb):
        return any(all(abs(a - b) <= PALETTE_TOL for a, b in zip(rgb, p)) for p in palette)

    def residue_like(c):
        r, gg, b, a = c
        return a >= 250 and min(r, gg, b) > LIGHT_MIN and max(r, gg, b) - min(r, gg, b) < NEUTRAL_SPREAD and not in_palette((r, gg, b))

    # outside = transparent cells connected to the canvas border
    outside = set()
    stack = [(x, y) for x in range(64) for y in (0, 63)] + [(x, y) for y in range(64) for x in (0, 63)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or not (0 <= x < 64 and 0 <= y < 64) or g[y][x][3] != 0:
            continue
        outside.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]

    removed = []
    for _ in range(MAX_LAYERS):
        layer = [(x, y) for y in range(64) for x in range(64)
                 if residue_like(g[y][x]) and any((nx, ny) in outside for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))]
        if not layer:
            break
        for x, y in layer:
            removed.append([x, y, list(g[y][x][:3])])
            g[y][x] = (0, 0, 0, 0)
            outside.add((x, y))

    out = cand.copy()
    px = out.load()
    for x, y, _ in removed:
        for yy in range(8):
            for xx in range(8):
                px[x * 8 + xx, y * 8 + yy] = (0, 0, 0, 0)
    out.save(out_path, format='PNG')
    print(json.dumps({
        'input': cand_path, 'input_sha256': sha(cand_path),
        'master': master_path, 'master_sha256': sha(master_path),
        'output': out_path, 'output_sha256': sha(out_path),
        'recipe': {'light_min': LIGHT_MIN, 'neutral_spread': NEUTRAL_SPREAD, 'palette_tol': PALETTE_TOL, 'max_layers': MAX_LAYERS},
        'removed_count': len(removed), 'removed': removed,
    }))


if __name__ == '__main__':
    main(*sys.argv[1:4])
