# 2x2 Rubic's Cube Explorer and Solver

This an interactive application with a single-page UI displaying 3D views of 2x2 Rubic's cubes.
With the application the user can:

- Scramble a virtual 2x2 Rubic's Cube to match their own physical cube, by changing the facelets of
  the cube on screen. This will be the active configuration of the cube in the app.
- The program than computes the shortest paths to the solution and display the next step or steps.
- The user can click on a step and it will become the active configuration. The app computes the shortest paths and
  displays the next step or steps again.

The application needs to display:

- 3D views of cubes, the user can rotate them with the pointer to look at all sides
- Arrows between the cubes, with instructions on the array, such as "R'"
- A few simple widgets, like buttons, drop-down lists, color palette for the facelets

It should be implemented as a web application.

## Technology Survey

The AI surveyed the options: [Technology Survey](docs/001_technology_survey.md)

## Technology stack

We choose Stack S2, with the TypeScript option, relevant specs repeated here for convenience:

- **Rendering:** Three.js (A4). All UI is rendered with Three.js (no DOM widgets, no HTML overlays); see [Rendering approach](details_of_ui.md#rendering-approach).
- **Solver:** TypeScript in a Web Worker
- **Build tool:** Vite (dev-time only).
- **Total runtime deps:** `three`, `troika-three-text` (for in-scene text labels). `@types/three` as a dev dep for TypeScript.

## Detailed user-level description

### High-level overview

The application opens with 3D view of a solved 2x2 cube. Only a single UI control is available, a color palette in the
top-left corner. The user can rotate the cube, select or deselect colors from the palette, paint the facelets of the
cube to the selected color. If the cube is in a valid configuration, the program displays the immediate next step or
steps to solve the cube in the shortest possible way, by displaying the next steps (3D cubes) on the right and bottom
side of the window. The user can click on a next step which makes it the active configuration and the next steps are
updated.

### Color palette

The colors of the cube are Red, Blue, Green, Orange, White and Yellow.

The color palette is displayed in a 3 x 4 grid. It is used to set the active color, to scramble the cube by painting its
facelets with the current color. The user can change the current color by clicking on the color palette with the pointer.

### 3D view of the cube

The user can rotate the main cube (drag gesture) and click on its facelets to change their color. The main cube
also keeps a preferred orientation with slight rotations to reveal different sides of the cube, based on the mouse
pointer location.

### Displaying the next steps towards solutions

- The facelets of the cube displayed in the center has a specific coloring, defined by the user. It might result either
  in an invalid or valid configuration.
- If the coloring is invalid, a label above the cube is shown with the text "Invalid scramble, keep on coloring.".
- If the coloring is valid, the app finds the shortest paths to solved cubes (considering all final color orientations).
- If cube is valid and there's an active solution (with potentially multiple shortest paths) the program displays the
  next steps of all shortest paths as the additional, 3D-rendered cubes, on the right and bottom sides of the window.
  The program also draws arrows from the central cube to the next steps. On the arrows the code of the step is
  displayed.
  The possible codes:

  - The letters U, D, R, L, F, B for turning the top, bottom, right, left, front, back faces one quarter-turn clockwise
  - The same letters followed by an apostrophe, indicating counter-clockwise quarter turn
  - The same letters followed by the digit "2", indicating half-turn.

  For the shortest paths, the algorithm uses the face-turn metric, that is, both quarter and face turns count as 1 step.

## Details of the behavior

See [Details of the behavior](details_of_behavior.md)

## Details of the UI

See [Details of the UI](details_of_ui.md)

## Implementation

Implementation and further instructions will be placed into the "impl_vanilla_ts" subdirectory.
