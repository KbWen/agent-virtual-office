# pixel-v1 asset pack — provenance

Phase 1 of `docs/specs/phased-pixel-character-refresh.md`.

Each `<role>.png` is a byte-for-byte copy (verified with `cmp`) of the owner-approved
ORIGINAL identity master `pixel-kit/generated/characters/<role>/idle-0.png` from the
2026-10-25 office visual-direction kit. No transformation was applied: no background
removal, trim, recentre, resample or recolour.

- Decoded: 512×512 RGBA PNG; uniform 8×8 blocks → 64×64 logical grid.
- Partial-alpha pixels are a dark soft outline (no white/grey matte).
- Foot-contact pivot (logical px) measured from opaque (α ≥ 250) sole pixels; recorded in
  `src/systems/characterAppearance.js` together with the SHA-256 below.

| file | sha256 |
|---|---|
| pm.png | 64b3b93551b2c6064877fe29f51de984301860c807a99e95372150bfa303d245 |
| arch.png | 4dbbc0792212b9a9e7921a965c6a9b38c4a429d350e3ac566be20c9c14c7442a |
| dev.png | da81bee1bd1cb480783c878236458f6ded0d8ce88b9b8f81041c9c2cf1d4bd31 |
| qa.png | d5f64afbf0a3778e1fe99fd5114fd409bcc60447e0de5f59a995a454f4f854ed |
| ops.png | 4916b663dad415068dfeba8b1ec07b634883b081e37693ce09c1cc7fd17f8db0 |
| res.png | d638fee5040d840b32097e97e647052cb397e9ea0def93b1b861dca77e68a6f7 |
| gate.png | 8692bcceee24a97423808a49c1a0bb5f6b31383ce87d9555b2b97b8889832dd8 |
| designer.png | 61a665352ce563ba3a8a6de6cd6db5b6adc71be1873b93f0648059f200ed679c |

## Views (back + signature actions) — imported 2026-11-08/09 at the owner's request

Sources: Gemini candidates generated from each role's ORIGINAL master
(`candidates/2026-11-07-directions/.../idle-up-0.png` for backs, `candidates/2026-11-05-regenerated/.../actions/*`
for actions, Dev's coffee pose from the 2026-11-07 replacement). Those exports had been background-removed
from white upstream, leaving an opaque light/grey rim (worst at the shoes, a strip under some soles); the
owner asked for it to be made transparent.

Runtime files are DERIVED, not byte copies: `python scripts/pixel_alpha_cleanup.py <source> <master> <out>`
(recipe: light_min 100, keep_bright 218, neutral_spread 30, palette_tol 6, max_layers 2) sets alpha to
0 only on edge-connected, near-neutral light-grey pixels (near-white props/highlights are kept) whose colour is not in that role's master palette, for whole 8x8
blocks; nothing else changes. Sources stay untouched in the kit. Review: exact 8x8 grid, hard alpha,
identity matches the master (light/dark and floor-colour composites at app scale), identity whites kept
(Dev sneakers, Gate silver hair, QA paper). Pivot = measured bottom sole row / sole midpoint after cleanup.
Back views are used only seated (clipped below the waist); action poses only while the role performs its
own signature behavior and is not walking.

| file | source | source sha256 | runtime sha256 | removed px | pivot (x, y) |
|---|---|---|---|---|---|
| arch-back.png | candidates/2026-11-07-directions/characters/arch/idle-up-0.png | 5cf00fcf0ddeba3d… | 339522ca5bd498b4cf88273344b53d07442e497c6f10ed7de953759163fbd817 | 43 | 31, 56 |
| arch-pointing-board.png | candidates/2026-11-05-regenerated/characters/arch/actions/pointing-board-0.png | 39c9090b253d0062… | 055e340d98d5aa94e8f2e37610451b130446288a03eb80711575badb2363b793 | 54 | 31.5, 56 |
| designer-back.png | candidates/2026-11-07-directions/characters/designer/idle-up-0.png | 96728530404986b3… | 0c172c3685b79d4eeca586aae99919309c7a41334cc108249abb4ec408a900d4 | 25 | 32, 57 |
| designer-writing-notes.png | candidates/2026-11-05-regenerated/characters/designer/actions/writing-notes-0.png | 37017156ccf4c146… | da236a7db6fb46bc8136e596009aa0be8d95e199b6147cd2c57b361d3a5e47dd | 58 | 32.5, 57 |
| dev-back.png | candidates/2026-11-07-directions/characters/dev/idle-up-0.png | e2a4052ece046595… | 1e7564273729f2b1c7791741621d82274de681986a6eb64f4423ee65691b316b | 24 | 36, 57 |
| dev-drinking-coffee.png | candidates/2026-11-07-directions/characters/dev/actions/drinking-coffee-1.png | 87630b485a2da97b… | bbdd786f7f5941e7822ce31a5b816226d2d8a285b33af8e81a3131445cfa9424 | 48 | 36, 57 |
| gate-back.png | candidates/2026-11-07-directions/characters/gate/idle-up-0.png | 339999b385020d8c… | a362fcb49be4987c28398b24e1f6f2ae8a127e532741775299857f1cd0a5c0f4 | 27 | 31.5, 57 |
| gate-control-shield.png | candidates/2026-11-05-regenerated/characters/gate/actions/control-shield-0.png | f6b6edf99ffb89ae… | c5ed74774526bb43815ec3e1bda0dd861275d8510af2a4532add9d1387bec256 | 22 | 32, 57 |
| ops-back.png | candidates/2026-11-07-directions/characters/ops/idle-up-0.png | 2952b81ce35d8112… | 39a0de129bea2063ede86c6bf23736c654be055ba6624037409d09e8f2eaf615 | 26 | 32, 56 |
| ops-control-deploy.png | candidates/2026-11-05-regenerated/characters/ops/actions/control-deploy-0.png | f0be321c0ff3667f… | e4d620b6c6a48512ac07a00646aad8c894e4db5a6ebf4ea25ef3d1a6a143ef03 | 72 | 32, 56 |
| pm-back.png | candidates/2026-11-07-directions/characters/pm/idle-up-0.png | 04c603a98548d606… | bfb2fa0fc9d50a2a1e85c7d2e55dc77a55dbaa63517f963e4d38792bdc6a628b | 41 | 31.5, 57 |
| pm-typing.png | candidates/2026-11-05-regenerated/characters/pm/actions/typing-0.png | 5f4787dfa9b6c3ae… | 2f4bbe71576687343849748c8b0e1fd23f35aaf85b35e2ec23d9c186db21faa1 | 38 | 31.5, 56 |
| qa-back.png | candidates/2026-11-07-directions/characters/qa/idle-up-0.png | ff4c6de508b00856… | b59c17b8fe55ae074a63969fce667fb675280fda9aaa8132566646656446439e | 28 | 32, 57 |
| qa-reading-magnifier.png | candidates/2026-11-05-regenerated/characters/qa/actions/reading-magnifier-0.png | a2f9a1ca45b9ce7f… | 2bfcf0164c8a0a3197d7abfce1d32c04cd3935dc6cc63cb67c29398941ac629d | 31 | 31.5, 57 |
| res-back.png | candidates/2026-11-07-directions/characters/res/idle-up-0.png | 17150b272363f8ac… | bf5a7f160eb16ed06c495084248ac69c177be5c721cfb53047208529ce2b1e99 | 4 | 32, 57 |
| res-reading-book.png | candidates/2026-11-05-regenerated/characters/res/actions/reading-book-0.png | b962cf6df56ddcd5… | 2bfc9da351fd6268fb77d380388bb1ba4b6bc3309e290b20b1fce473d5e1daf9 | 57 | 32, 57 |

## Walk cycles (AVO-207) — derived 2026-11-14

Spec: `docs/specs/avo-207-pixel-walk-cycles.md`. Owner rule: a frame ships only if it matches its master natively
(size and look); nothing is resized or repainted. Sources are raw Gemini 1024x1024 JPEG frames on white,
reviewed in the external kit (`phased-handoff/REVIEW-WALK-W1-20261114.md`).

Runtime files are DERIVED by `python scripts/pixel_walk_derive.py <raw> <master> <out>`: exact-grid check
(refuses off-grid raws), per-block centre median (JPEG noise), border-connected near-white -> transparent, enclosed
near-white gaps (background between arm and body) -> transparent unless the master uses that colour, rim pass
(max 2 layers) for light near-neutral outline pixels whose colour is not on the master's own outline. The 64x64
logical drawing is unchanged. Pivot = measured sole row + 1, x = measured torso centre. Re-running the command
reproduces the same bytes.

Measured height (review 2026-11-14): Res's master spans logical rows 14-55 (42 rows, top row is its soft
outline); all four walk frames span rows 14-56 (43 rows), i.e. 1 row taller as Gemini drew them. Feet are
anchored per frame (pivot), so on the idle-to-walk switch the head rises 1 logical row (0.875 display
units). Kept as drawn (no resize); a new role's frames must be within ±1 row of the master or are
regenerated. Every new role's derivation is checked with `--review <overlay.png>` before its hashes are
recorded.

| file | source (2026-11-08-gait/needs-review/) | source sha256 | runtime sha256 | px cleared (enclosed gap + rim) | pivot (x, y) |
|---|---|---|---|---|---|
| res-walk-side-0.png | candidates-20261108-res-walk-side-0-raw.jpg | 87e75480c6d19f01… | 729eaff66c18a22cba5ccfccfb15c86ea910f81277338053a349ea4525b8b2c1 | 2 gap + 28 rim | 31.5, 57 |
| res-walk-side-1.png | candidates-20261108-res-walk-side-1-raw.jpg | 628e41ab2896205c… | 5ee2b66e35d69f646a2abd46e20da843f32e2a1c00237dc4dd9344b042fd673e | 2 gap + 16 rim | 31.5, 57 |
| res-walk-side-2.png | candidates-20261108-res-walk-side-2-raw.jpg | ab97c1c7c0b6cb37… | 354f169c51d47fd23c5b694f37281b7e5e543c10bd8a69fa4dc294cd0f4db4b7 | 0 gap + 17 rim | 31.5, 57 |
| res-walk-side-3.png | candidates-20261108-res-walk-side-3-raw.jpg | 55a945b69e1b3b57… | 20163e5200334848731a3b8381bbc225352602d53ec064c457c0212157b31924 | 3 gap + 15 rim | 31.5, 57 |

### Other roles — derived 2026-11-14 (AVO-207 increment 2)

Sources: accepted W1 frames plus Gemini fix waves 5A/5B (regenerated with one accepted sibling frame attached as
size/look reference), reviewed in `phased-handoff/REVIEW-FIX-5-20261114.md`. Every set was compared with its master
and siblings and every derivation checked with `--review`. Recipe change for this batch: an edge pixel that is
more than `HALO_DELTA` (12) brighter than all its inner neighbours is halo even when its colour is a master
white (cleared the specks around Dev's hair and Gate/QA feet); Res's four files re-derive byte-identical.
Pivot y = each frame's measured sole row + 1; pivot x = the role's mean torso centre (rows 30-40) across its
four frames, rounded to 0.5, one value per role so the body does not jitter sideways. All Dev frames end
one row higher as drawn, so their pivot y is 56.

(History) Held back at first (owner review of the live office, 2026-11-14: "the legs do not swap"; all five were
later replaced by walk-sheet frames below): QA (f0 and f2 nearly
identical, 15 px apart in the leg area), Ops (f1 and f3 identical, 0 px) and Designer (f1 and f3 6 px
apart, smallest stride of any role), PM (all four frames are wide strides with no tucked passing leg and
both legs the same shade; replaced by the walk-sheet frames below) and Gate (the long coat hides the legs; four near-identical stances). The
fix-wave reference frame was copied too closely. They keep the
front master while walking until regenerated frames pass a leg-swap check.

| file | source (under pixel-kit/generated/candidates/) | source sha256 | runtime sha256 | px cleared (enclosed gap + rim) | pivot (x, y) |
|---|---|---|---|---|---|
| arch-walk-side-0.png | 2026-11-08-gait/needs-review/candidates-20261108-arch-walk-side-0-raw.jpg | 6eaa49beddb135a4… | aef5bb2732bb48e90fce38b0259dd83c4fbedf84400d116cf135ba6540f3ebb3 | 0 gap + 25 rim | 32, 57 |
| arch-walk-side-1.png | 2026-11-08-gait/needs-review/candidates-20261108-arch-walk-side-1-raw.jpg | e3a503ea1d1fceab… | f2a3ccc6af53de9d496309e1a4cd7bd8fb71338537a8934ae3a6b5a2b92dd1db | 0 gap + 21 rim | 32, 57 |
| arch-walk-side-2.png | 2026-11-08-gait/needs-review/candidates-20261108-arch-walk-side-2-raw.jpg | 377a9f2b531a4ffa… | c582b177439bd9983d8b03c5e6e6bb9b91af974e159a9ac4feac91a74d7e8e17 | 0 gap + 16 rim | 32, 57 |
| arch-walk-side-3.png | 2026-11-15-fix-5a/needs-review/candidates-20261114-arch-walk-side-3-raw.jpg | 8500bb4c8d10285f… | 4c5a1287d5782cb6dd56c63837f91244923ad4802bb613ff2a49801c81bc6f85 | 3 gap + 21 rim | 32, 57 |
| dev-walk-side-0.png | 2026-11-09-gait-3/needs-review/candidates-20261109-dev-walk-side-0-raw.jpg | 122d069bc92daec0… | de8671130d0f628a1e8bdddf3485a5aa05158b0fc2e9f07ff0d4b57251f73891 | 0 gap + 62 rim | 29.5, 56 |
| dev-walk-side-1.png | 2026-11-09-gait-3/needs-review/candidates-20261109-dev-walk-side-1-raw.jpg | 7b6157e9ebc06d0d… | 78f9afd7a028ea9e52be83177328b1deaa62a806d05566c2138bc6d92d653f27 | 3 gap + 52 rim | 29.5, 56 |
| dev-walk-side-2.png | 2026-11-09-gait-3/needs-review/candidates-20261109-dev-walk-side-2-raw.jpg | 4944ccc6519da690… | 38625cc72f20f0ed507859169c70a8c78df727c98ab1474893ee8cd7106fdbd7 | 0 gap + 17 rim | 29.5, 56 |
| dev-walk-side-3.png | 2026-11-15-fix-5a/needs-review/candidates-20261114-dev-walk-side-3-raw.jpg | dff7856d13e61068… | 73e0d2df38258568f90ba4976a668a40d6334051064bd462481cf4f260978163 | 0 gap + 55 rim | 29.5, 56 |

Near/far tone fix (owner 2026-11-15, "那其他要重產要變色的也處理吧" -> "可以，接上"): after the derivation above, three
frames had the near leg/shoe drawn darker than the far one, so the same leg always read as in front. Each limb's tone
class was shifted onto the other side's class (64-grid pixel, whole 8 px block; outlines and every other pixel unchanged):
- arch-walk-side-2: rows 44-57, trouser navy (b > r+15); columns < 32 with mean 45-60 -> +15,+15,+19 (near, lighter);
  columns >= 32 with mean 61-80 -> -15,-15,-19 (far, darker). 39 px.
- dev-walk-side-2: rows 50-57, near-neutral shoe pixels (spread < 40, min > 90) at columns >= 30 with mean >= 200
  -> -50,-45,-40 (far shoe grey). 6 px.
- dev-walk-side-3: same rows/material; columns < 30.5 with mean 160-199 -> +40,+36,+34 (lifted near shoe white);
  columns >= 30.5 with mean >= 200 -> -50,-45,-40 (standing far shoe grey). 8 px.
Dev speck cleanup (owner 2026-11-15, "好，修掉"): light near-neutral pixels (min > 100, spread < 25) at the
hair/hoodie border, the back hair edge and the hand edge (columns 10-29, rows 26-46; eye highlights and sneakers
excluded) took the per-channel median of their non-speck 8-neighbours. Pixels: f0 12, f1 9, f2 3, f3 11.
Arms already alternate in Arch/Dev/Res; Res's two legs share one tone, so it is unchanged. Runtime sha256 in the table
above are the fixed files; the derivation output before the fix was arch-2 c2300332…, dev-2 23c029f3…, dev-3 64ee8d5a….

PM, from walk-sheet wave 7b (2026-11-15). Wave 7 drew PM's 4 frames as one 1024 image (2x2 grid of 512 cells)
with a consistent but thin, long-jawed head; the owner asked for the master's round chubby face, so wave 7b
redrew that sheet with only the head changed (`2026-11-20-walk-sheet-7b/needs-review/candidates-20261115-walk-sheet-pm-raw.jpg`,
sha256 2cc8065da2960de706d60be1f3c10b3e12984e6e629f90c961d2dd7e8d84166e; the .png beside it is the same bytes).
Gemini drew each cell on a 50 grid (10.24 px pixels, figure block-spread p95 10-12), not the requested 64 grid,
so `pixel_walk_derive.py` refuses it as-is. Recipe used (owner-approved exception "以 PM 試等比縮放", 2026-11-15):
1. split the sheet into its four 512 cells (top-left f0, top-right f1, bottom-left f2, bottom-right f3);
2. run the derive rules unchanged (block-centre median, border background, master-palette gap and rim
   passes against pm.png) on the native 50 grid -> 0 gap and 0 rim pixels cleared;
3. scale all four frames by one factor, 0.9362 = master rows 13-56 (44) / sheet rows 3-49 (47),
   nearest-neighbour, one shared offset (torso centre on the master's), so every drawn pixel survives
   as a 7-8 px block.
4. near/far tone swap (owner-approved 2026-11-15, "阿還有手阿" -> "夠了，接上"): Gemini shaded every frame as
   lit from the right (right-side limbs light, left-side limbs one tone darker), which is already near-light /
   far-dark in f0 and f1 but backwards in f2 and f3, so the same leg always looked in front. On the 50 grid,
   before step 3, f2 and f3 swap the two tone sets between body sides, using only colours already in the frame:
   trousers (37,48,77) <-> (51,63,96); shoes (49,31,16) <-> (62,42,26), (69,47,32) <-> (84,56,36), (119,81,56)
   -> (69,47,32); skin (215,149,114) <-> (252,215,173); match tolerance 12 per channel; outlines untouched.
   Boxes (50-grid columns/rows): legs and shoes rows 35-49, side split at column 24.5 (f2 and f3); arms f2
   only, left arm columns 0-20 rows 27-37 -> far tone, right arm columns 29-49 rows 27-35 -> near tone.
   Pixels changed: f2 128, f3 73; f0/f1 unchanged. Result: far leg and far arm are the darker ones in all frames.
Known limits (owner accepted): the bottom-row cells' heads are drawn one row taller than the top row's, and
the four heads are close but not pixel-identical; the trouser tones are close, so the leg swap is subtler
than the arm swap at office size.
Pivot y = each frame's bottom + 1 row (56.125 -> 56 for f0/f1); pivot x = mean torso centre 31.30 -> 31.5.

| file | source cell | runtime sha256 | pivot (x, y) |
|---|---|---|---|
| pm-walk-side-0.png | top-left | 2c69ddd4a263a9c6a75d51d6a489a5cf9f608f80f7f50811111d1dc1ae8e1ecb | 31.5, 56 |
| pm-walk-side-1.png | top-right | 73622a8ebf80af1e36281d650c0761cc435807c3db0f6403d5471205cd7bf30c | 31.5, 56 |
| pm-walk-side-2.png | bottom-left | 77257aa9425db30a603f3aaea0c15a58dc05d0656e5cad6cd358bd63c4e23177 | 31.5, 57 |
| pm-walk-side-3.png | bottom-right | f707aa3bbeb4d680dce8e21092e0d0fd35ab7f59153c5485bc85eaa257d36855 | 31.5, 57 |

QA, Ops, Designer, Gate, from walk-sheet wave 7c (2026-11-15). Each sheet is PM's wave-7b sheet redrawn with the
role's person (same 2x2 layout, 50 grid, body size and poses), `2026-11-21-walk-sheet-7c/needs-review/
candidates-20261115-walk-sheet-<role>-raw.png`. Same recipe as PM (steps 1-4 above), owner-approved ("全部接上"):
- native 50-grid sampling, figure block-spread p95 9-13; cleared: QA 1/4/1/4 rim, Ops 1/0/1/3 rim, Gate 1/3/7/4 rim
  + 1 gap in f0 and f2, Designer 18/32/28/35 rim (the light halo around her hair) + 7/1/5/1 enclosed gaps (between
  arm and body); --review overlays checked;
- one scale for all four frames and roles: 0.9149 = master rows 14-56 (43) / sheet rows 3-49 (47);
- near/far tone swap on f2 (legs + arms) and f3 (legs), shifting a tone class by its measured light-minus-mid delta:
  trousers QA +-16, Ops +-(32,32,20), Designer tights +-(24,24,16); skin +-(40,64,56). Gate's coat and trousers
  already share one tone on both sides, so only its f2 arms swap. Pixels: QA 79/33, Ops 75/27, Designer 51/32,
  Gate 13/0 (f2/f3);
- Designer: one light speck by the hand in f1 (20,33) and f3 (21,32) took the median of its neighbours.
Known limits (owner accepted): Designer's f0 face is drawn three-quarter (both eyes), the other three in profile;
the bottom-row cells' heads are one row taller than the top row's.

| file | source cell | runtime sha256 | pivot (x, y) |
|---|---|---|---|
| qa-walk-side-0.png | top-left | 5970e6cda25207d43bfcae1914d72ee6f4eccce2d7a21368048b18c2365d7c51 | 31.5, 56 |
| qa-walk-side-1.png | top-right | 342ad171cd7155e7907169253ca96dbbd43e67e67627940a6a63bc315a53ce35 | 31.5, 56 |
| qa-walk-side-2.png | bottom-left | 81538249bb04eb4b95459766040b7056f5415ab86fb970b3092d2c31efbb6407 | 31.5, 57 |
| qa-walk-side-3.png | bottom-right | 5b3325eb3cd3c49b6a14c51e9f24976f18d455771dd4b1e0f97ac2c79ba7efd7 | 31.5, 57 |
| ops-walk-side-0.png | top-left | 40ded272e085bad1619ce918a9e8293f0cb54b31c5c915c3e9db0731850fbb0b | 31.5, 56 |
| ops-walk-side-1.png | top-right | 87dc63710b70cbc04d3dcc367bf542ed8be705a5a51c2490989b06b40e2fd215 | 31.5, 56 |
| ops-walk-side-2.png | bottom-left | c96529eabeae493ebb38ff68553738c6c35405530c01c8ae4f3bdf217e4c39e9 | 31.5, 57 |
| ops-walk-side-3.png | bottom-right | 48e12bb425f5a925e6b126bbd68cabe076c509e1f83497b33126523f8483a82e | 31.5, 57 |
| designer-walk-side-0.png | top-left | 5b21df006c54badaac5a7ea729469ba0f63e67620f739c9ded00364f6c67568b | 32, 56 |
| designer-walk-side-1.png | top-right | a98dcfa0d456df5239cd99ae3b3d3805104ace95b8df3fb86f1af1f93c1bf27e | 32, 56 |
| designer-walk-side-2.png | bottom-left | c8f2b5acb1c084d7e8c2b4d3a1ff787b57bc797299ecfe095ead521834cf143f | 32, 57 |
| designer-walk-side-3.png | bottom-right | cd6438ff17f17e799dfadf984c31bf4c18224e6aa05a8f5c4f19af9135c1ab13 | 32, 57 |
| gate-walk-side-0.png | top-left | e22d6944568b326f594dd31efe17b3aae3ba999877ef13f0eef935dee422fdf6 | 31.5, 56 |
| gate-walk-side-1.png | top-right | 513bfc74bea812a94248c26209f40295d980081ddb600cde25eccb668db46643 | 31.5, 56 |
| gate-walk-side-2.png | bottom-left | 3cf431ae91c743640ba107ff1c136c7b7f7190d46fec5bd7dc7e895cca57bebf | 31.5, 57 |
| gate-walk-side-3.png | bottom-right | 7026ff9372f0756a16ed85a6bcefbffcc09394ad20f9e0e82ffd957b820f3de9 | 31.5, 57 |
