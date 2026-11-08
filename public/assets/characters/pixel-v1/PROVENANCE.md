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
