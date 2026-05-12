export type Color = 'R' | 'G' | 'B' | 'O' | 'Y' | 'W';

export interface AppState {
  selectedColor: Color;
}

export function initialAppState(): AppState {
  return { selectedColor: 'G' };
}
