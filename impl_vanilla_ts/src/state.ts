export type Color = 'R' | 'G' | 'B' | 'O' | 'Y' | 'W';
export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

export type FaceColors = [Color, Color, Color, Color];

export interface CubeFacelets {
  U: FaceColors;
  D: FaceColors;
  L: FaceColors;
  R: FaceColors;
  F: FaceColors;
  B: FaceColors;
}

export const COLOR_HEX: Record<Color, number> = {
  R: 0xba0c2f,
  G: 0x009a44,
  B: 0x003da5,
  O: 0xfe5000,
  Y: 0xffd700,
  W: 0xffffff,
};

export function solvedCube(): CubeFacelets {
  return {
    U: ['W', 'W', 'W', 'W'],
    D: ['Y', 'Y', 'Y', 'Y'],
    F: ['G', 'G', 'G', 'G'],
    B: ['B', 'B', 'B', 'B'],
    L: ['O', 'O', 'O', 'O'],
    R: ['R', 'R', 'R', 'R'],
  };
}

export interface AppState {
  selectedColor: Color;
  cube: CubeFacelets;
}

export function initialAppState(): AppState {
  return {
    selectedColor: 'G',
    cube: solvedCube(),
  };
}
