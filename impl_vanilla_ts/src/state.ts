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

export function cloneCubeFacelets(src: CubeFacelets): CubeFacelets {
  return {
    U: [src.U[0], src.U[1], src.U[2], src.U[3]],
    D: [src.D[0], src.D[1], src.D[2], src.D[3]],
    L: [src.L[0], src.L[1], src.L[2], src.L[3]],
    R: [src.R[0], src.R[1], src.R[2], src.R[3]],
    F: [src.F[0], src.F[1], src.F[2], src.F[3]],
    B: [src.B[0], src.B[1], src.B[2], src.B[3]],
  };
}

export interface NextStepCube {
  facelets: CubeFacelets;
  instruction: string;
}

export interface AppState {
  selectedColor: Color;
  cube: CubeFacelets;
  nextSteps: NextStepCube[];
}

export function initialAppState(): AppState {
  return {
    selectedColor: 'G',
    cube: solvedCube(),
    nextSteps: [],
  };
}
