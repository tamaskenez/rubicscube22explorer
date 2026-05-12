# Implementation steps

As an architectural pattern we use the unidirectional data flow pattern.

- The "Logic" component is the application logic, the driver of state changes, the center of the application
- "UI" acts as a service for Logic. Logic instructs UI to update or display something. Logic knows about UI, UI doesn't know about Logic.
- AppState data structure stores the application state. Writable by Logic, read-only for UI
- UI might have small local state (animation progress, gesture state). It always announces user actions never instructs the Logic to do things.

## Step 1: A complete but empty application with all the dependencies in place

[IMPLEMENT:.]

Implement an empty application according to [Technology stack](../main.spec.md#Technology stack)

## Step 2: Implement the color palette

- AppState: add the currently selected color
- UI: display the color palette, selected color, detect clicks, send the clicked color to Logic
- Logic: receive color palette selection and update the state
