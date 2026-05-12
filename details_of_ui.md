# Details of the UI

## Rendering approach

The entire UI is rendered with Three.js — no HTML widgets, no DOM-based overlays. Each frame the renderer draws two scenes in sequence:

1. **Main scene** (`PerspectiveCamera`): the cubes, arrows, and move-code labels in 3D world space. Move-code labels are attached to the arrows in 3D.
2. **Overlay scene** (`OrthographicCamera`, 1 unit = 1 pixel): the color palette and the label above the main cube. Rendered on top of the main scene with `renderer.autoClear = false` and a depth-buffer clear between the two `renderer.render(...)` calls.

Text is rendered with `troika-three-text` (signed-distance-field text mesh — stays crisp at any zoom). One extra runtime dependency.

Pointer hit testing uses `THREE.Raycaster` against both scenes. The only DOM interaction outside the `<canvas>` is setting `canvas.style.cursor` to `'pointer'` when hovering an interactive element (palette swatch, cube facelet, next-step cube) and `'default'` otherwise.

## UI colors

The background color is #F0F0F0

The colors of the cube are (with hex and Pantone labels)

- "R": #BA0C2F, Red 200C
- "G": #009A44, Green 347C
- "B": #003DA5, Blue 293C
- "O": #FE5000, Orange 021C
- "Y": #FFD700, Yellow 012C
- "W": #FFFFFF (White, no Pantone)

## Color palette

The color palette is displayed in the top-left corner of the window, as a grid. The grid is arranged like this:

.W..
OGRB
.Y..

where the colored rectangles are drawn with black borders, '.' marks an empty (background-colored) cell, which doesn't
have borders, either.

Each swatch is a plane mesh in the overlay scene, drawn on top of a black border plane that fills a fixed-size cell. The cell's outer dimensions never change between states — only the colored face area inside it does — so the palette layout never shifts as selection or hover changes.

**Visual states (combinable):**

- **Normal** — narrow black border (2 px on each side); the colored face fills the remaining inner area at full saturation.
- **Selected** — wider black border (4 px on each side); the colored face shrinks inward by the extra 2 px on each side. Full saturation.
- **Hovered** — the face color is mixed 50% with white. Hover is independent of selection: the selected swatch can also be hovered (thick border + whitened face).

Hover is UI-local state — it doesn't go through Logic. Selection round-trips through Logic.

**Current layout values:**

- Palette margin from top-left of window: 16 px
- Cell outer size: 60 px (= 56 px normal face + 2 px border on each side)
- Selected face inset: 4 px per side (face becomes 52 × 52 px)
- Gap between adjacent cells: 6 px


## Displaying the "next step" cubes

Divide the right and bottom sides into 4 cells initially and display one solution in each cell, starting from the top-
right corner. That makes 4 + 3 = 7 cells. If the number of solutions is more than 7, increase the number of cells per
side.

Fill order: fill the right side from top to bottom, then the bottom side from right to left.
The solutions are presented in no particular order.
The arrows are drawn on the line from main cube center to next-step cube center. The arrows can be drawn from 25% of
the distance to 75% of the distance.

## Arrow style

Proposal — adjust if you'd prefer different defaults:

- **Shaft:** straight line, ~2 px wide, color `#333333` (dark grey — good contrast against the `#F0F0F0` background).
- **Arrowhead:** filled triangle in the same color, ~10 px wide by ~14 px long, placed at the 75%-of-distance end (pointing toward the next-step cube).
- **Label:** the move code (e.g. `R`, `R'`, `R2`) drawn near the midpoint of the visible shaft (the 50% point of the line). Offset slightly perpendicular to the line (~8 px) so the text sits beside the shaft rather than on top of it.
- **Label typography:** sans-serif, 16 px equivalent, bold, color `#333333`. No background box — the line passes beside the text rather than through it.
- **Rendering approach:** draw the shaft and arrowhead as Three.js `Line` + a small triangle mesh (or use `THREE.ArrowHelper`) in the main scene; draw labels as `troika-three-text` meshes positioned along each arrow in 3D space.

## Click-to-advance animation

When the user clicks a next-step cube do the following 2 animations in parallel:

- the arrows and next-step cube or cubes are faded away (around 1 sec is fine)
- the appropriate face of main cube is rotated
