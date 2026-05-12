# Details of the UI

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

It's fine to display it with a HTML table and indicating the selection with a thicker border and by mixing, maybe
25% background color into the unselected colors.


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
- **Label typography:** system sans-serif (`system-ui, sans-serif`), 16 px, bold, color `#333333`. No background box — the line passes beside the text rather than through it.
- **Rendering approach:** draw the shaft and arrowhead as Three.js `Line` + a small triangle mesh in screen space (or use `THREE.ArrowHelper`); draw labels as HTML overlays positioned via `CSS2DRenderer` so the text stays crisp at any zoom level.

## Click-to-advance animation

When the user clicks a next-step cube do the following 2 animations in parallel:

- the arrows and next-step cube or cubes are faded away (around 1 sec is fine)
- the appropriate face of main cube is rotated
