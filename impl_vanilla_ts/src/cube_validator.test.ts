import { describe, expect, test } from 'vitest';
import { cubeValidity } from './cube_validator';
import { solvedCube } from './state';
import { MOVE_NAMES, applyMove } from './solver';

describe('cubeValidity under a random walk', () => {
  test('stays valid for 1000 random face turns from solved', () => {
    let cube = solvedCube();
    const seenValidities = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const moveName = MOVE_NAMES[Math.floor(Math.random() * MOVE_NAMES.length)];
      cube = applyMove(cube, moveName);
      const v = cubeValidity(cube);
      seenValidities.add(v);
      if (v === 'invalid') {
        throw new Error(`move ${i} (${moveName}) produced an invalid cube`);
      }
    }

    // Random sequences of face turns from solved should produce mostly
    // unsolved-but-valid states and never an invalid state.
    expect(seenValidities.has('invalid')).toBe(false);
    expect(seenValidities.has('valid_unsolved')).toBe(true);
  });
});
