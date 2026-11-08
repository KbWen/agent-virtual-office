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

## Back views (`<role>-back.png`) — imported 2026-11-08 at the owner's request

Byte-for-byte copies of `pixel-kit/generated/candidates/2026-11-07-directions/characters/<role>/idle-up-0.png`.
These candidates were produced by Gemini from each role's ORIGINAL master, but the producer
disclosed background segmentation / crop / per-image scaling that had not been approved; the owner
asked for them to be imported after review. Claude's review: 512x512 RGBA, zero non-uniform 8x8
blocks, hard alpha (no partial-alpha halo), identity matches each master from behind (light and dark
backgrounds). Known defect: pm / qa / ops / gate carry a light-grey residue strip on the row under
the soles (logical row 56) from background removal. Mitigation: back views are used ONLY for the
seated-at-desk pose, where everything below the waist is clipped behind the chair, so the strip is
never rendered. Pivot = measured dark-sole bottom row / sole midpoint (not the residue row).
Heads are 1-2 logical rows taller than the masters (accepted; seated only).

| file | sha256 | pivot (x, y) |
|---|---|---|
| pm-back.png | 04c603a98548d606be3991c20148c47a2df96ffad2a25ce12fc5711bbd77763d | 31.5, 57 |
| arch-back.png | 5cf00fcf0ddeba3d7c7dd055abb204e17367371f4c916472cd656c3912053501 | 31, 56 |
| dev-back.png | e2a4052ece046595ae677a06657aacb9a97710cb0de947d5b73724083ee72079 | 36, 57 |
| qa-back.png | ff4c6de508b008565ee7a1e01a7ddaca4b6387ff481af95569119cae715f6e95 | 32, 56 |
| ops-back.png | 2952b81ce35d8112004e5d2b90baa25b49698a831203bb366d9c3bfea8669ed5 | 32, 56 |
| res-back.png | 17150b272363f8ac4b13c8edd87a52628b227f9fd4d055fe6aa69eef646c0c61 | 32, 57 |
| designer-back.png | 96728530404986b37b9f3707385644770de9dfb0ef9818564f3b7babf2107784 | 32, 57 |
| gate-back.png | 339999b385020d8cab781edcaa6657d4a6079186277a45ad322093af2e543180 | 31.5, 56 |
