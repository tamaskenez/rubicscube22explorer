import type { Color, CubeFacelets, Face, NextStepCube } from './state';

const CUBIE_CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1],
  [+1, -1, -1],
  [-1, +1, -1],
  [+1, +1, -1],
  [-1, -1, +1],
  [+1, -1, +1],
  [-1, +1, +1],
  [+1, +1, +1],
];

const FACELET_TO_CUBIE: Record<Face, readonly [number, number, number, number]> = {
  U: [2, 3, 6, 7],
  D: [4, 5, 0, 1],
  F: [6, 7, 4, 5],
  B: [3, 2, 1, 0],
  L: [2, 6, 0, 4],
  R: [7, 3, 5, 1],
};

const FACE_LAYER_CUBIES: Record<Face, readonly number[]> = {
  U: [2, 3, 6, 7],
  D: [0, 1, 4, 5],
  F: [4, 5, 6, 7],
  B: [0, 1, 2, 3],
  L: [0, 2, 4, 6],
  R: [1, 3, 5, 7],
};

const FACE_OUTWARD_AXIS: Record<Face, readonly [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
  L: [-1, 0, 0],
  R: [1, 0, 0],
};

const FACES: ReadonlyArray<Face> = ['U', 'D', 'F', 'B', 'L', 'R'];
const FACE_INDEX: Record<Face, number> = { U: 0, D: 1, F: 2, B: 3, L: 4, R: 5 };

function faceForUnitAxis(x: number, y: number, z: number): Face {
  if (x === 1) return 'R';
  if (x === -1) return 'L';
  if (y === 1) return 'U';
  if (y === -1) return 'D';
  if (z === 1) return 'F';
  return 'B';
}

function cubieIndexAt(sx: number, sy: number, sz: number): number {
  return ((sx + 1) >> 1) | (((sy + 1) >> 1) << 1) | (((sz + 1) >> 1) << 2);
}

function stickerIndex(cubieIdx: number, x: number, y: number, z: number): number {
  const face = faceForUnitAxis(x, y, z);
  return FACE_INDEX[face] * 4 + FACELET_TO_CUBIE[face].indexOf(cubieIdx);
}

function rotate(
  x: number,
  y: number,
  z: number,
  kx: number,
  ky: number,
  kz: number,
  angle: number,
): [number, number, number] {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dot = x * kx + y * ky + z * kz;
  const cx = ky * z - kz * y;
  const cy = kz * x - kx * z;
  const cz = kx * y - ky * x;
  return [
    x * cosA + cx * sinA + kx * dot * (1 - cosA),
    y * cosA + cy * sinA + ky * dot * (1 - cosA),
    z * cosA + cz * sinA + kz * dot * (1 - cosA),
  ];
}

function buildBaseFacePermutation(face: Face): number[] {
  const perm: number[] = new Array(24);
  for (let i = 0; i < 24; i++) perm[i] = i;

  const [ax, ay, az] = FACE_OUTWARD_AXIS[face];
  const angle = -Math.PI / 2; // CW from outside = right-hand-rule negative around outward axis

  for (const cubieIdx of FACE_LAYER_CUBIES[face]) {
    const [sx, sy, sz] = CUBIE_CORNERS[cubieIdx];
    const [npx, npy, npz] = rotate(sx, sy, sz, ax, ay, az, angle);
    const newCubieIdx = cubieIndexAt(Math.round(npx), Math.round(npy), Math.round(npz));

    const stickerDirs: ReadonlyArray<readonly [number, number, number]> = [
      [sx, 0, 0],
      [0, sy, 0],
      [0, 0, sz],
    ];
    for (const [dx, dy, dz] of stickerDirs) {
      const oldIdx = stickerIndex(cubieIdx, dx, dy, dz);
      const [nx, ny, nz] = rotate(dx, dy, dz, ax, ay, az, angle);
      const newIdx = stickerIndex(newCubieIdx, Math.round(nx), Math.round(ny), Math.round(nz));
      perm[newIdx] = oldIdx;
    }
  }
  return perm;
}

function composePerms(first: number[], second: number[]): number[] {
  // Apply `first` then `second`: result[i] = first[second[i]] applied to initial state.
  const out = new Array<number>(24);
  for (let i = 0; i < 24; i++) out[i] = first[second[i]];
  return out;
}

interface MoveDef {
  name: string;
  perm: number[];
}

const MOVES: ReadonlyArray<MoveDef> = (() => {
  const list: MoveDef[] = [];
  for (const face of FACES) {
    const base = buildBaseFacePermutation(face);
    const double = composePerms(base, base);
    const inverse = composePerms(base, double);
    list.push({ name: face, perm: base });
    list.push({ name: `${face}2`, perm: double });
    list.push({ name: `${face}'`, perm: inverse });
  }
  return list;
})();

function faceletsToString(facelets: CubeFacelets): string {
  let s = '';
  for (const face of FACES) {
    const arr = facelets[face];
    s += arr[0] + arr[1] + arr[2] + arr[3];
  }
  return s;
}

function stringToFacelets(s: string): CubeFacelets {
  const result = {} as CubeFacelets;
  for (let i = 0; i < FACES.length; i++) {
    const face = FACES[i];
    const o = i * 4;
    result[face] = [
      s[o] as Color,
      s[o + 1] as Color,
      s[o + 2] as Color,
      s[o + 3] as Color,
    ];
  }
  return result;
}

function applyPerm(state: string, perm: number[]): string {
  const chars = new Array<string>(24);
  for (let i = 0; i < 24; i++) chars[i] = state[perm[i]];
  return chars.join('');
}

function isSolved(state: string): boolean {
  for (let f = 0; f < 6; f++) {
    const base = f * 4;
    const c = state[base];
    if (state[base + 1] !== c || state[base + 2] !== c || state[base + 3] !== c) {
      return false;
    }
  }
  return true;
}

export interface SolveResult {
  steps: number;
  nextSteps: NextStepCube[];
}

export function solveCube(facelets: CubeFacelets): SolveResult {
  const initial = faceletsToString(facelets);
  if (isSolved(initial)) {
    return { steps: 0, nextSteps: [] };
  }

  // Forward BFS from `initial`. depthMap stores shortest distance from initial.
  const depthMap = new Map<string, number>();
  depthMap.set(initial, 0);
  const queue: string[] = [initial];
  let qi = 0;
  let solvedDepth = -1;
  const solvedStates: string[] = [];

  while (qi < queue.length) {
    const s = queue[qi++];
    const d = depthMap.get(s)!;
    if (solvedDepth >= 0 && d >= solvedDepth) break;

    for (let mi = 0; mi < MOVES.length; mi++) {
      const next = applyPerm(s, MOVES[mi].perm);
      if (depthMap.has(next)) continue;
      const nd = d + 1;
      depthMap.set(next, nd);
      if (isSolved(next)) {
        if (solvedDepth < 0) solvedDepth = nd;
        if (nd === solvedDepth) solvedStates.push(next);
      } else {
        queue.push(next);
      }
    }
  }

  if (solvedDepth < 0) {
    return { steps: -1, nextSteps: [] };
  }

  // Backward BFS: walk the depth layers from solvedDepth down to 1, collecting all
  // states on some optimal path. At each step, a state at depth d-1 is "on an optimal
  // path" iff applying some move yields a state in the current layer.
  let layer: Set<string> = new Set(solvedStates);
  for (let d = solvedDepth; d > 1; d--) {
    const prev = new Set<string>();
    for (const s of layer) {
      for (let mi = 0; mi < MOVES.length; mi++) {
        const candidate = applyPerm(s, MOVES[mi].perm);
        if (depthMap.get(candidate) === d - 1) prev.add(candidate);
      }
    }
    layer = prev;
  }

  // `layer` now holds the depth-1 ancestors that lie on optimal paths. The first
  // moves are those moves from `initial` that land in `layer`.
  const firstMoves = new Set<number>();
  for (let mi = 0; mi < MOVES.length; mi++) {
    const child = applyPerm(initial, MOVES[mi].perm);
    if (layer.has(child)) firstMoves.add(mi);
  }

  const nextSteps: NextStepCube[] = [];
  for (const mi of firstMoves) {
    const move = MOVES[mi];
    nextSteps.push({
      facelets: stringToFacelets(applyPerm(initial, move.perm)),
      instruction: move.name,
    });
  }
  return { steps: solvedDepth, nextSteps };
}
