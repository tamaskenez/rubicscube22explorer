import { AppState, Color, Face, cloneCubeFacelets, initialAppState } from './state';
import { cubeValidity, type CubeValidity } from './cube_validator';
import type { SolveResult } from './solver';
import SolverWorker from './solver_worker?worker';
import type { SolveRequest, SolveResponse } from './solver_worker';
import type { UI } from './ui';

export class Logic {
  private state: AppState = initialAppState();
  private readonly worker: Worker;
  private latestRequestId = 0;

  constructor(private readonly ui: UI) {
    this.worker = new SolverWorker();
    this.worker.onmessage = (event: MessageEvent<SolveResponse>) => {
      const { requestId, result } = event.data;
      if (requestId !== this.latestRequestId) return; // stale response
      this.applySolverResult(result);
    };
  }

  start(): void {
    this.ui.showSelectedColor(this.state.selectedColor);
    this.ui.renderMainCube(this.state.cube);
    this.ui.renderNextStepCubes(this.state.nextSteps);
    this.handleValidityChange();
  }

  onPaletteColorClicked(color: Color): void {
    if (color === this.state.selectedColor) return;
    this.state.selectedColor = color;
    this.ui.showSelectedColor(color);
  }

  onMainCubeFaceletClicked(face: Face, index: number): void {
    if (this.state.cube[face][index] === this.state.selectedColor) return;
    this.state.cube[face][index] = this.state.selectedColor;
    this.ui.renderMainCube(this.state.cube);
    this.handleValidityChange();
  }

  onNextStepCubeClicked(index: number): void {
    const step = this.state.nextSteps[index];
    if (!step) return;
    this.state.cube = cloneCubeFacelets(step.facelets);
    this.ui.renderMainCube(this.state.cube);
    this.handleValidityChange();
  }

  private handleValidityChange(): void {
    const v = cubeValidity(this.state.cube);
    if (v === 'valid_unsolved') {
      // Keep the previous label and next-step cubes visible while the solver runs;
      // the worker response will replace them when it arrives.
      this.requestSolve();
    } else {
      // Cancel any in-flight solve, clear next-steps, and show a static label.
      this.latestRequestId += 1;
      if (this.state.nextSteps.length > 0) {
        this.state.nextSteps = [];
        this.ui.renderNextStepCubes([]);
      }
      this.ui.setMainCubeLabel(staticLabelFor(v));
    }
  }

  private requestSolve(): void {
    this.latestRequestId += 1;
    const request: SolveRequest = {
      requestId: this.latestRequestId,
      facelets: this.state.cube,
    };
    this.worker.postMessage(request);
  }

  private applySolverResult(result: SolveResult): void {
    if (result.steps < 0) {
      this.state.nextSteps = [];
      this.ui.renderNextStepCubes([]);
      this.ui.setMainCubeLabel('Solver failed (state explosion). Check the console.');
      return;
    }
    this.state.nextSteps = result.nextSteps;
    this.ui.renderNextStepCubes(result.nextSteps);
    this.ui.setMainCubeLabel(
      `${result.steps} steps to solve. Apply turn by clicking on cube on the right or bottom.`,
    );
  }
}

function staticLabelFor(v: Exclude<CubeValidity, 'valid_unsolved'>): string {
  return v === 'valid_solved'
    ? 'Use the color palette to scramble.'
    : 'Invalid scramble, keep on coloring.';
}
