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

Held back (owner review of the live office, 2026-11-14: "the legs do not swap"): QA (f0 and f2 nearly
identical, 15 px apart in the leg area), Ops (f1 and f3 identical, 0 px) and Designer (f1 and f3 6 px
apart, smallest stride of any role), PM (all four frames are wide strides with no tucked passing leg and
both legs the same shade) and Gate (the long coat hides the legs; four near-identical stances). The
fix-wave reference frame was copied too closely. They keep the
front master while walking until regenerated frames pass a leg-swap check.

| file | source (under pixel-kit/generated/candidates/) | source sha256 | runtime sha256 | px cleared (enclosed gap + rim) | pivot (x, y) |
|---|---|---|---|---|---|
| arch-walk-side-0.png | 2026-11-08-gait/needs-review/candidates-20261108-arch-walk-side-0-raw.jpg | 6eaa49beddb135a4… | aef5bb2732bb48e90fce38b0259dd83c4fbedf84400d116cf135ba6540f3ebb3 | 0 gap + 25 rim | 32, 57 |
| arch-walk-side-1.png | 2026-11-08-gait/needs-review/candidates-20261108-arch-walk-side-1-raw.jpg | e3a503ea1d1fceab… | f2a3ccc6af53de9d496309e1a4cd7bd8fb71338537a8934ae3a6b5a2b92dd1db | 0 gap + 21 rim | 32, 57 |
| arch-walk-side-2.png | 2026-11-08-gait/needs-review/candidates-20261108-arch-walk-side-2-raw.jpg | 377a9f2b531a4ffa… | c2300332facd5b016fd8ccdc911a463ee8499a964e0fffb0d5923867fc76df86 | 0 gap + 16 rim | 32, 57 |
| arch-walk-side-3.png | 2026-11-15-fix-5a/needs-review/candidates-20261114-arch-walk-side-3-raw.jpg | 8500bb4c8d10285f… | 4c5a1287d5782cb6dd56c63837f91244923ad4802bb613ff2a49801c81bc6f85 | 3 gap + 21 rim | 32, 57 |
| dev-walk-side-0.png | 2026-11-09-gait-3/needs-review/candidates-20261109-dev-walk-side-0-raw.jpg | 122d069bc92daec0… | 73a0861b23e6347cb3e5a9357a2629bf9fe8ab17e1476779642205c5a85c0b67 | 0 gap + 62 rim | 29.5, 56 |
| dev-walk-side-1.png | 2026-11-09-gait-3/needs-review/candidates-20261109-dev-walk-side-1-raw.jpg | 7b6157e9ebc06d0d… | aa18e231a77bb4b343ce65d4b80b504c10ef1161f75ed030c0012f46c8db7de0 | 3 gap + 52 rim | 29.5, 56 |
| dev-walk-side-2.png | 2026-11-09-gait-3/needs-review/candidates-20261109-dev-walk-side-2-raw.jpg | 4944ccc6519da690… | 23c029f38658865b7e0d6cc3992b7a0fdd1892e30b0fd3b1dd0d8ebf7984940e | 0 gap + 17 rim | 29.5, 56 |
| dev-walk-side-3.png | 2026-11-15-fix-5a/needs-review/candidates-20261114-dev-walk-side-3-raw.jpg | dff7856d13e61068… | 64ee8d5a11885606e1413f0d4c642d023c87078fcce8d8971f59a2022afdadcf | 0 gap + 55 rim | 29.5, 56 |
