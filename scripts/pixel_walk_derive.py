"""Derive a runtime Pixel frame from a raw Gemini walk frame (AVO-207, owner rules 2026-11-14).

Gemini returns walk frames as 1024x1024 JPEG on a white background. This tool turns one raw frame
into the 512x512 RGBA runtime file WITHOUT changing the drawing:

  * the raw must sit on an exact 64x64 logical grid (16x16 px blocks); otherwise it is REFUSED
    (p95 of the per-block colour spread above MAX_BLOCK_SPREAD means the art is off-grid)
  * each logical pixel = per-channel median of its block's centre (drops JPEG noise; the block
    edges carry the JPEG ringing)
  * background = near-white logical pixels (min channel >= BG_MIN, spread <= BG_SPREAD) that are
    4-connected to the canvas border -> alpha 0
  * enclosed gaps (background seen between an arm and the body): a near-white 4-connected patch
    NOT touching the border becomes alpha 0 only if none of its colours appears (within
    PALETTE_TOL) anywhere in the role master, so white sneakers / shirts / eye highlights stay
  * rim pass (max RIM_LAYERS): light (min channel > LIGHT_MIN), near-neutral pixels on the outside
    edge whose colour is not within PALETTE_TOL of a colour on the role master's OWN outline ->
    alpha 0. This clears the light halo/corner pixels Gemini adds around the silhouette, while a
    light colour the master itself shows on its outline (silver hair, white sneakers) is kept.
  * every other logical pixel is copied unchanged, opaque, as an exact 8x8 block

Never crops, recentres, resizes, rescales or repaints the figure: the 64x64 logical drawing is
the same grid Gemini drew. Prints a JSON report (hashes, removed pixels, measured rows).

Usage: python scripts/pixel_walk_derive.py <raw.jpg|png> <master.png> <out.png>
Requires Pillow.
"""
import hashlib
import json
import statistics
import sys

from PIL import Image

GRID = 64
MAX_BLOCK_SPREAD = 24      # p95 per-block channel spread; JPEG noise on exact-grid art measures 7-11
BG_MIN, BG_SPREAD = 232, 14
LIGHT_MIN, NEUTRAL_SPREAD, PALETTE_TOL, RIM_LAYERS = 100, 30, 10, 2
OUT_BLOCK = 8


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def sample_grid(im):
    w, h = im.size
    if w != h or w % GRID:
        raise SystemExit(f'REFUSED: expected a square canvas divisible by {GRID}, got {w}x{h}')
    b = w // GRID
    m = b // 4
    px = im.load()
    cells, spreads = [], []
    for gy in range(GRID):
        row = []
        for gx in range(GRID):
            vals = [px[gx * b + x, gy * b + y] for y in range(m, b - m) for x in range(m, b - m)]
            row.append(tuple(int(statistics.median(v[i] for v in vals)) for i in range(3)))
            spreads.append(max(max(v[i] for v in vals) - min(v[i] for v in vals) for i in range(3)))
        cells.append(row)
    p95 = sorted(spreads)[int(len(spreads) * 0.95)]
    if p95 > MAX_BLOCK_SPREAD:
        raise SystemExit(f'REFUSED: not on an exact {GRID}x{GRID} grid (p95 block spread {p95} > {MAX_BLOCK_SPREAD})')
    return cells, p95


def master_full_palette(path):
    im = Image.open(path).convert('RGBA')
    b = im.size[0] // GRID
    px = im.load()
    return {px[x * b, y * b][:3] for y in range(GRID) for x in range(GRID) if px[x * b, y * b][3] >= 250}


def master_outline_palette(path):
    """Colours of the master's opaque pixels that touch its transparent outside (its outline)."""
    im = Image.open(path).convert('RGBA')
    b = im.size[0] // GRID
    px = im.load()
    opaque = {(x, y) for y in range(GRID) for x in range(GRID) if px[x * b, y * b][3] >= 250}
    return {px[x * b, y * b][:3] for x, y in opaque
            if any(n not in opaque for n in neighbours(x, y))}


def neighbours(x, y):
    return ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))


def derive(raw_path, master_path, out_path):
    cells, p95 = sample_grid(Image.open(raw_path).convert('RGB'))
    palette = master_outline_palette(master_path)
    full_palette = master_full_palette(master_path)

    def is_bg(c):
        return min(c) >= BG_MIN and max(c) - min(c) <= BG_SPREAD

    def in_palette(c, pal=None):
        return any(all(abs(a - b) <= PALETTE_TOL for a, b in zip(c, p)) for p in (palette if pal is None else pal))

    def rim_like(c):
        return min(c) > LIGHT_MIN and max(c) - min(c) < NEUTRAL_SPREAD and not in_palette(c)

    outside = set()
    stack = [(x, y) for x in range(GRID) for y in (0, GRID - 1)] + [(x, y) for y in range(GRID) for x in (0, GRID - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in outside or not (0 <= x < GRID and 0 <= y < GRID) or not is_bg(cells[y][x]):
            continue
        outside.add((x, y))
        stack.extend(neighbours(x, y))
    background = len(outside)

    holes = []
    seen = set(outside)
    for y in range(GRID):
        for x in range(GRID):
            if (x, y) in seen or not is_bg(cells[y][x]):
                continue
            comp, st = [], [(x, y)]
            while st:
                cx, cy = st.pop()
                if (cx, cy) in seen or not (0 <= cx < GRID and 0 <= cy < GRID) or not is_bg(cells[cy][cx]):
                    continue
                seen.add((cx, cy))
                comp.append((cx, cy))
                st.extend(neighbours(cx, cy))
            if not any(in_palette(cells[cy][cx], full_palette) for cx, cy in comp):
                holes.extend(comp)
    outside.update(holes)

    rim = []
    for _ in range(RIM_LAYERS):
        layer = [(x, y) for y in range(GRID) for x in range(GRID)
                 if (x, y) not in outside and rim_like(cells[y][x])
                 and any(n in outside for n in neighbours(x, y))]
        if not layer:
            break
        for x, y in layer:
            rim.append([x, y, list(cells[y][x])])
            outside.add((x, y))

    size = GRID * OUT_BLOCK
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    opx = out.load()
    rows = []
    for y in range(GRID):
        for x in range(GRID):
            if (x, y) in outside:
                continue
            rows.append(y)
            c = cells[y][x] + (255,)
            for yy in range(OUT_BLOCK):
                for xx in range(OUT_BLOCK):
                    opx[x * OUT_BLOCK + xx, y * OUT_BLOCK + yy] = c
    out.save(out_path, format='PNG')
    sole = max(rows)
    sole_cols = [x for x in range(GRID) if (x, sole) not in outside]
    return {
        'input': raw_path, 'input_sha256': sha(raw_path),
        'master': master_path, 'master_sha256': sha(master_path),
        'output': out_path, 'output_sha256': sha(out_path),
        'recipe': {'grid': GRID, 'max_block_spread': MAX_BLOCK_SPREAD, 'bg_min': BG_MIN, 'bg_spread': BG_SPREAD,
                   'light_min': LIGHT_MIN, 'neutral_spread': NEUTRAL_SPREAD,
                   'rim_palette': 'master outline', 'gap_palette': 'master full', 'palette_tol': PALETTE_TOL,
                   'rim_layers': RIM_LAYERS},
        'block_spread_p95': p95, 'background_px': background, 'enclosed_gaps': [list(h) for h in holes],
        'rim_removed': len(rim), 'rim': rim,
        'head_row': min(rows), 'sole_row': sole, 'sole_cols': [sole_cols[0], sole_cols[-1]],
    }


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    print(json.dumps(derive(*sys.argv[1:4])))
