import { AppState, Color, Face, initialAppState } from './state';
import { cubeValidity } from './cube_validator';
import type { UI } from './ui';

export class Logic {
  private state: AppState = initialAppState();

  constructor(private readonly ui: UI) {}

  start(): void {
    this.ui.showSelectedColor(this.state.selectedColor);
    this.ui.renderMainCube(this.state.cube);
    this.ui.renderNextStepCubes(this.state.nextSteps);
    this.ui.setMainCubeLabel(this.labelForCurrentState());
  }

  onPaletteColorClicked(color: Color): void {
    if (color === this.state.selectedColor) return;
    this.state.selectedColor = color;
    this.ui.showSelectedColor(color);
  }

  onMainCubeFaceletClicked(face: Face, index: number): void {
    if (this.state.cube[face][index] === this.state.selectedColor) return;
    this.state.cube[face][index] = this.state.selectedColor;
    this.ui.renderMainCube(this.state.cube);
    this.ui.setMainCubeLabel(this.labelForCurrentState());
  }

  private labelForCurrentState(): string {
    switch (cubeValidity(this.state.cube)) {
      case 'valid_solved':
        return 'Use the color palette to scramble.';
      case 'invalid':
        return 'Invalid scramble, keep on coloring.';
      case 'valid_unsolved':
        return '0 steps to solve. Apply turn by clicking on cube on the right or bottom.';
    }
  }
}
