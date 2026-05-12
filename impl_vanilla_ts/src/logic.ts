import { AppState, Color, initialAppState } from './state';
import type { UI } from './ui';

export class Logic {
  private state: AppState = initialAppState();

  constructor(private readonly ui: UI) {}

  start(): void {
    this.ui.showSelectedColor(this.state.selectedColor);
  }

  onPaletteColorClicked(color: Color): void {
    if (color === this.state.selectedColor) return;
    this.state.selectedColor = color;
    this.ui.showSelectedColor(color);
  }
}
