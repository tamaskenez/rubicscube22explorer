import { Color, CubeFacelets, Face } from './state';

export type CubeValidity = 'valid_solved' | 'valid_unsolved' | 'invalid';

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

// Canonical sticker triplet for each valid corner type, read in the cubie's
// cyclic order from outside. Key is the three colors sorted alphabetically.
// Derived from the solved state in standard orientation (W top, Y bottom, G front,
// B back, O left, R right).
const VALID_CORNER_CANONICAL: Record<string, readonly [Color, Color, Color]> = {
  GRW: ['R', 'W', 'G'],
  BRW: ['R', 'B', 'W'],
  BRY: ['R', 'Y', 'B'],
  GRY: ['R', 'G', 'Y'],
  GOW: ['O', 'G', 'W'],
  BOW: ['O', 'W', 'B'],
  BOY: ['O', 'B', 'Y'],
  GOY: ['O', 'Y', 'G'],
};

const ALL_COLORS: ReadonlyArray<Color> = ['R', 'G', 'B', 'O', 'Y', 'W'];
const ALL_FACES: ReadonlyArray<Face> = ['U', 'D', 'F', 'B', 'L', 'R'];

// For each cubie 0..7, list its 3 stickers as (face, faceletIndex) in cyclic
// order from outside. Right-handed: sx·sy·sz === 1 gives (X, Y, Z) order;
// otherwise (X, Z, Y). The cross of the first two unit axes equals the third.
const CUBIE_STICKER_ORDER: ReadonlyArray<ReadonlyArray<readonly [Face, number]>> = (() => {
  const result: Array<ReadonlyArray<readonly [Face, number]>> = [];
  for (let i = 0; i < 8; i++) {
    const [sx, sy, sz] = CUBIE_CORNERS[i];
    const faceX: Face = sx === 1 ? 'R' : 'L';
    const faceY: Face = sy === 1 ? 'U' : 'D';
    const faceZ: Face = sz === 1 ? 'F' : 'B';
    const idxX = FACELET_TO_CUBIE[faceX].indexOf(i);
    const idxY = FACELET_TO_CUBIE[faceY].indexOf(i);
    const idxZ = FACELET_TO_CUBIE[faceZ].indexOf(i);
    const order: Array<readonly [Face, number]> =
      sx * sy * sz === 1
        ? [[faceX, idxX], [faceY, idxY], [faceZ, idxZ]]
        : [[faceX, idxX], [faceZ, idxZ], [faceY, idxY]];
    result.push(order);
  }
  return result;
})();

function cornerKey(a: Color, b: Color, c: Color): string {
  return [a, b, c].sort().join('');
}

export function cubeValidity(facelets: CubeFacelets): CubeValidity {
  const result = computeCubeValidity(facelets);
  if (result !== 'valid_solved') {
    // TEMPORARY: dump every checked state that isn't trivially solved so we can
    // identify the configuration that triggered the solver to crash. Single-line
    // JSON so it can be pasted into a test.
    console.log('[cubeValidity]', result, JSON.stringify(facelets));
  }
  return result;
}

function computeCubeValidity(facelets: CubeFacelets): CubeValidity {
  const counts: Record<Color, number> = { R: 0, G: 0, B: 0, O: 0, Y: 0, W: 0 };
  for (const face of ALL_FACES) {
    for (let i = 0; i < 4; i++) {
      counts[facelets[face][i]]++;
    }
  }
  for (const c of ALL_COLORS) {
    if (counts[c] !== 4) return 'invalid';
  }

  const seenTypes = new Set<string>();
  let twistSum = 0;
  for (let cubieIdx = 0; cubieIdx < 8; cubieIdx++) {
    const stickers = CUBIE_STICKER_ORDER[cubieIdx];
    const c1 = facelets[stickers[0][0]][stickers[0][1]];
    const c2 = facelets[stickers[1][0]][stickers[1][1]];
    const c3 = facelets[stickers[2][0]][stickers[2][1]];

    const key = cornerKey(c1, c2, c3);
    const canonical = VALID_CORNER_CANONICAL[key];
    if (!canonical) return 'invalid';
    if (seenTypes.has(key)) return 'invalid';
    seenTypes.add(key);

    let twist = -1;
    for (let r = 0; r < 3; r++) {
      if (
        c1 === canonical[r] &&
        c2 === canonical[(r + 1) % 3] &&
        c3 === canonical[(r + 2) % 3]
      ) {
        twist = r;
        break;
      }
    }
    if (twist === -1) return 'invalid';
    twistSum += twist;
  }

  if (twistSum % 3 !== 0) return 'invalid';

  for (const face of ALL_FACES) {
    const c0 = facelets[face][0];
    if (facelets[face][1] !== c0 || facelets[face][2] !== c0 || facelets[face][3] !== c0) {
      return 'valid_unsolved';
    }
  }
  return 'valid_solved';
}
