import { AppState, Color, initialAppState } from './state';
import type { UI } from './ui';

export class Logic {
  private state: AppState = initialAppState();

  constructor(private readonly ui: UI) {}

  start(): void {
    this.ui.showSelectedColor(this.state.selectedColor);
    this.ui.renderMainCube(this.state.cube);
    this.ui.renderNextStepCubes(this.state.nextSteps);
  }

  onPaletteColorClicked(color: Color): void {
    if (color === this.state.selectedColor) return;
    this.state.selectedColor = color;
    this.ui.showSelectedColor(color);
  }
}
