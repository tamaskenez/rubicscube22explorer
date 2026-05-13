import { describe, expect, test } from 'vitest';
import { solvedCube, type CubeFacelets } from './state';
import { MOVE_NAMES, ROTATION_COUNT, applyMove, countReachableStates, solveCube } from './solver';

const FACES = ['U', 'D', 'F', 'B', 'L', 'R'] as const;

describe('move semantics', () => {
  test('every move keeps a solved cube valid (sanity)', () => {
    for (const m of MOVE_NAMES) {
      const c = applyMove(solvedCube(), m);
      expect(c).not.toEqual(solvedCube());
    }
  });

  test('F + F′ returns to solved', () => {
    for (const f of FACES) {
      let c = solvedCube();
      c = applyMove(c, f);
      c = applyMove(c, `${f}'`);
      expect(c, `${f} + ${f}'`).toEqual(solvedCube());
    }
  });

  test('F applied four times returns to solved', () => {
    for (const f of FACES) {
      let c = solvedCube();
      for (let i = 0; i < 4; i++) c = applyMove(c, f);
      expect(c, `${f} x4`).toEqual(solvedCube());
    }
  });

  test('F2 applied twice returns to solved', () => {
    for (const f of FACES) {
      let c = solvedCube();
      c = applyMove(c, `${f}2`);
      c = applyMove(c, `${f}2`);
      expect(c, `${f}2 + ${f}2`).toEqual(solvedCube());
    }
  });

  test('F2 equals F + F', () => {
    for (const f of FACES) {
      let a = solvedCube();
      a = applyMove(a, `${f}2`);
      let b = solvedCube();
      b = applyMove(b, f);
      b = applyMove(b, f);
      expect(a, `${f}2 == ${f}+${f}`).toEqual(b);
    }
  });
});

describe('each base move applied to solved matches hand-computed state', () => {
  const cases: Record<string, CubeFacelets> = {
    R: {
      U: ['W', 'G', 'W', 'G'],
      D: ['Y', 'B', 'Y', 'B'],
      F: ['G', 'Y', 'G', 'Y'],
      B: ['W', 'B', 'W', 'B'],
      L: ['O', 'O', 'O', 'O'],
      R: ['R', 'R', 'R', 'R'],
    },
    L: {
      U: ['B', 'W', 'B', 'W'],
      D: ['G', 'Y', 'G', 'Y'],
      F: ['W', 'G', 'W', 'G'],
      B: ['B', 'Y', 'B', 'Y'],
      L: ['O', 'O', 'O', 'O'],
      R: ['R', 'R', 'R', 'R'],
    },
    U: {
      U: ['W', 'W', 'W', 'W'],
      D: ['Y', 'Y', 'Y', 'Y'],
      F: ['R', 'R', 'G', 'G'],
      B: ['O', 'O', 'B', 'B'],
      L: ['G', 'G', 'O', 'O'],
      R: ['B', 'B', 'R', 'R'],
    },
    D: {
      U: ['W', 'W', 'W', 'W'],
      D: ['Y', 'Y', 'Y', 'Y'],
      F: ['G', 'G', 'O', 'O'],
      B: ['B', 'B', 'R', 'R'],
      L: ['O', 'O', 'B', 'B'],
      R: ['R', 'R', 'G', 'G'],
    },
    F: {
      U: ['W', 'W', 'O', 'O'],
      D: ['R', 'R', 'Y', 'Y'],
      F: ['G', 'G', 'G', 'G'],
      B: ['B', 'B', 'B', 'B'],
      L: ['O', 'Y', 'O', 'Y'],
      R: ['W', 'R', 'W', 'R'],
    },
    B: {
      U: ['R', 'R', 'W', 'W'],
      D: ['Y', 'Y', 'O', 'O'],
      F: ['G', 'G', 'G', 'G'],
      B: ['B', 'B', 'B', 'B'],
      L: ['W', 'O', 'W', 'O'],
      R: ['R', 'Y', 'R', 'Y'],
    },
  };
  for (const [m, expected] of Object.entries(cases)) {
    test(m, () => {
      expect(applyMove(solvedCube(), m)).toEqual(expected);
    });
  }
});

describe('orbit size', () => {
  test('d=1 from solved has 18 unique states', () => {
    const initial = solvedCube();
    const keys = new Set<string>();
    for (const m of MOVE_NAMES) {
      const next = applyMove(initial, m);
      keys.add(['U', 'D', 'F', 'B', 'L', 'R'].map((f) => next[f as keyof typeof next].join('')).join(''));
    }
    expect(keys.size).toBe(18);
  });

  // The 2x2 orbit under face turns in the 24-sticker encoding is 3,674,160 × 24 = 88,179,840.
  // The ×24 comes from whole-cube rotations being reachable as face-turn compositions
  // (e.g. R+L' rotates every cubie by -90° around X), which is possible on the 2x2
  // because there are no center pieces to anchor orientation. That's why a single Map
  // (capacity 2^24 ≈ 16.7M) can't enumerate the whole orbit and the solver needs
  // canonicalization or bidirectional BFS to handle deep scrambles.
  test.skip('full orbit from solved is ~88M states (skipped — exceeds Map limit)', () => {
    const count = countReachableStates(solvedCube(), 16_000_000);
    expect(count).toBeGreaterThan(16_000_000);
  });
});

describe('canonicalization', () => {
  test('there are exactly 24 whole-cube rotations', () => {
    expect(ROTATION_COUNT).toBe(24);
  });
});

describe('solver', () => {
  test('solves solved cube in 0 moves', () => {
    const result = solveCube(solvedCube());
    expect(result.steps).toBe(0);
    expect(result.nextSteps).toHaveLength(0);
  });

  test('solves single-move scrambles in 1 move', () => {
    for (const m of MOVE_NAMES) {
      const scrambled = applyMove(solvedCube(), m);
      const result = solveCube(scrambled);
      expect(result.steps, `scrambled by ${m}`).toBe(1);
      expect(result.nextSteps.length, `nextSteps for ${m}`).toBeGreaterThan(0);
    }
  });

  test('solves user-reported deep scramble without crashing', () => {
    const facelets: CubeFacelets = {
      U: ['G', 'O', 'W', 'R'],
      D: ['Y', 'O', 'B', 'R'],
      F: ['B', 'Y', 'R', 'G'],
      B: ['B', 'W', 'W', 'O'],
      L: ['O', 'R', 'Y', 'G'],
      R: ['B', 'W', 'Y', 'G'],
    };
    const result = solveCube(facelets);
    expect(result.steps).toBeGreaterThan(0);
    expect(result.steps).toBeLessThanOrEqual(11); // God's number for 2x2 is 11
    expect(result.nextSteps.length).toBeGreaterThan(0);
  }, 120_000);
});
