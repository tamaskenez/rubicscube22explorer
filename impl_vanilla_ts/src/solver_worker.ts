import { solveCube, type SolveResult } from './solver';
import type { CubeFacelets } from './state';

export interface SolveRequest {
  requestId: number;
  facelets: CubeFacelets;
}

export interface SolveResponse {
  requestId: number;
  result: SolveResult;
}

// In a worker, `self` is a DedicatedWorkerGlobalScope, but the DOM lib types it as Window.
// Cast through unknown to get a minimal worker-shaped view.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<SolveRequest>) => void) | null;
  postMessage(data: SolveResponse): void;
};

ctx.onmessage = (event) => {
  const { requestId, facelets } = event.data;
  try {
    const result = solveCube(facelets);
    ctx.postMessage({ requestId, result });
  } catch (err) {
    console.error('[solver worker] solveCube threw:', err);
    ctx.postMessage({ requestId, result: { steps: -1, nextSteps: [] } });
  }
};
