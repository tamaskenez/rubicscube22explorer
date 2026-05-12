# Details of the app's behavior

## Label above main cube

- When the app starts and anytime the main cube is solved, the label should display "Use the color palette to scramble."
- If the main cube is invalid, show "Invalid scramble, keep on coloring."
- If the main cube is valid and there are next steps, show:
  "{} steps to solve. Apply turn by clicking on cube on the right or bottom."

## Color selection

- The program starts by the Green color as the current color.
- One color is always active. When the user clicks on another color on the palette, the previous color gets deselected
  and the picked color will be active.
- The current selection is indicated [here](details_of_ui.md#color-palette)

## Rendered 3D cube and user interactions

We display the main cube in the center and if there are next steps to show, additional cubes on the right side of
the window. All these cubes behave similarly, except that only the main cube can be colored.

All cubes have a single, preferred orientation. The cubes' orientation is managed like this:

- The user can rotate the cube in 3D using the a drag gesture with the pointer
- When the drag gesture is over and the pointer is over or very near the cube, the dragged orientation is kept
- When the user moves the pointer away from the cube it should turn (in a few seconds) into a specific, preferred orientation
  - The preferred orientation should be slightly adjusted based on the position of the pointer:
  - Turn the cube away from the user in the horizontal direction with an angle proportional to the horizontal distance
    between the mouse pointer and the center of the cube
  - Turn the cube away from the user in the vertical direction with an angle proportional to the vertical distance
    between the mouse pointer and the center of the cube
  The intended effect is that the cube's white face will still be facing the user but the cube will reveal its sides
  corresponding to where the user moved the pointer.
- The auto-return mechanism should be activated when the distance between the pointer and center of the cube is more than
  75% of the size of the bounding box (approximate is fine).
- All displayed cubes auto-return and auto-rotate independently, using their own centers to calculate the distance.
- Auto-return animation ease-out should be around 1 second.
- Drag vs. click disambiguation threshold can be 5 pixels.

Main cube only: the user can click on a facelet of the cube which turns into the selected color.

The initial orientation of the main cube is Green facing the user, White on top and Red on the right. The user can later
change the coloring. Also, if the shortest solution results in the Green face on the right, then it'll be kept that way,
too.

## Solver and next-steps

Every time the user changes the color of a facelet and it results in a valid cube, the cube solver algorithm should be
run and a new set a next-steps will be generated from the shortest paths.
The cube validity check should allow all configurations which is reachable from the initial cube and prevent those
which are not reachable without taking apart the cube.
