# Implementation steps

As an architectural pattern we use the unidirectional data flow pattern.

- The "Logic" component is the application logic, the driver of state changes, the center of the application
- "UI" acts as a service for Logic. Logic instructs UI to update or display something. Logic knows about UI, UI doesn't know about Logic.
- AppState data structure stores the application state. Writable by Logic, read-only for UI
- UI might have small local state (animation progress, gesture state). It always announces user actions never instructs the Logic to do things.

## Step 1: A complete but empty application with all the dependencies in place

Implement an empty application according to [Technology stack](../main.spec.md#Technology stack)

## Step 2: Implement the color palette

- AppState: add the currently selected color
- UI: display the color palette, selected color, detect clicks, send the clicked color to Logic
- Logic: receive color palette selection and update the state

## Step 3: Main cube initial display and data structure

- AppState: add a data structure which can store the colors of the facelets of a 2 x 2 rubic cube
- UI: write a function which displays a cube:
  - minimal graphics, just render the facelets as 2 one-sided triangles
  - function takes arguments:
    - facelet colors
    - position of cube center on screen
    - orientation of the cube
    - zoom factor (otherwise the function should use a hard-coded projection)
    - identifier and turn angle of a single face
- UI: display the main cube

## Step 4: Implement main cube's dynamic orientation

Implement the following behaviors:

- maintain separate "target" and "current" orientations for the cube
- in each frame apply an exponential decay to turn the "current" towards the "target" but only
  if the mouse pointer is outside of a circle slightly bigger than the cube on the screen. Otherwise
  the current orientation is unchanged
- use the "current" orientation to render the cube
- if the mouse pointer is outside of a circle slightly bigger than the cube on the screen,
  take the screen vector from cube center to the mouse pointer and calculate a rotation and angle pair
  from it which turns the orientation of the cube away from the pointer. The axis is unambiguous, the
  angle should be a factor times the mouse pointer distance, clamped to 45 degrees. Set the target orientation
  to the idle orientation rotated by this axis/angle.

### Step 5: Implement main cube drag

- Implement a drag gesture so the user can rotate the cube by the mouse pointer. The dragging
  should instantaneously set the current orientation to a new value


### Step 6: Implement next-step display

- Add a data structure to AppState to hold a vector of next-step cubes. Each cube has
  - facelet colors
  - instruction text (e.g. "R2")
- Implement the the display of the next-step cubes along with arrows with instructions
  from the main cube.
- Make sure both the dynamic orientation and the drag mechanics work for the next-step cubes.

To test the system, temporarily, on program startup add 7 next-step cubes to AppState.

### Step 7: Facelet coloring

First, remove the 7 next-steps cubes added at startup.
Then, implement facelet coloring. This is only for the main cube. The user can click on a facelet
of the main cube which turns into the currently selected color.

### Step 8: Validator and label

Implement a function which tells if the configuration of cube facelet colors is valid, meaning,
reachable from a solved cube, which the solved cube have their colors oriented in the standard way:
if green is facing the viewer, red is on the right, orange on the left, white on top, yellow on bottom, blue on back.

The function should also check if the cube is solved, so it returns three possible values: "valid_solved", "valid_unsolved", "invalid".

Then, add a label according to "details_of_behavior.md#Label above main cube". For now, the third kind of
label just prints 0 for the number of steps.

### Step 9: Implement solver

Implement a function which takes a cube configuration (facelet colors), computes the shortest path
using the face-turn metric (both quarter or half turns count 1 step) and returns:

- the number of steps needed to solve the cube
- a list of next-steps items, where each item is a cube configuration (facelet-colors) and the code of the move
  (as described in "main.spec.md#Displaying the next steps towards solutions")

### Step 10: Display and jump to next steps

When the main cube is valid, call the solver, update the next-step cubes around the main cube.
When the user clicks on a next-step cube, copy that configuration onto the main cube and refresh
by calling the solver again and updating the next-step cubes.

### Step 11: Allow color selection by key

Handle the following key presses: w, y, g, b, r, o and make them activate the corresponding color on the palette.
