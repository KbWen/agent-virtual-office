// Classic procedural back view (seated-at-desk, owner R1 option C). Pure grid transform:
// the face rows of the 16x20 classic sprite become the back of the head in the character's own
// hair colour, so identity stays readable from hair/hat/clothes. Body/arms/legs are unchanged
// (legs are hidden by the seat clip anyway). No new colours beyond the role's hair palette.
const FACE_ROWS = [4, 5, 6, 7, 8, 9]

export function applyBackView(grid, hairColor, hairShade = hairColor) {
  return grid.map((row, y) => {
    if (!FACE_ROWS.includes(y)) return row
    return row.map((px) => (px ? (y === 9 ? hairShade : hairColor) : px))
  })
}
