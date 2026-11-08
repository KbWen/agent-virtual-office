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
