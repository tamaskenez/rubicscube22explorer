import * as THREE from 'three';
import { Text } from 'troika-three-text';
import {
  COLOR_HEX,
  solvedCube,
  type Color,
  type CubeFacelets,
  type Face,
  type NextStepCube,
} from './state';
import { createCubeView, updateCubeView, type CubeView } from './cube_view';

const BG_COLOR = 0xf0f0f0;

// Each cube has its own perspective camera at distance CAMERA_DISTANCE looking at the cube
// (which sits at the origin of its own scene). The cube's edge in world space is 2, so the
// cube's face on screen fills CUBE_FACE_FILL_RATIO of the cube's viewport.
const CAMERA_DISTANCE = 12;
const CUBE_FOV_DEG = 17;
const CUBE_FACE_FILL_RATIO =
  2 / (2 * CAMERA_DISTANCE * Math.tan((CUBE_FOV_DEG * Math.PI) / 360)); // ≈ 0.536

const MAIN_CUBE_VIEWPORT_FACTOR = 0.45; // viewport side = factor * canvas height
const NEXT_STEP_VIEWPORT_FACTOR = 0.22;

const MAX_TILT_ANGLE = Math.PI / 7; // 45 degrees
const TILT_FACTOR = MAX_TILT_ANGLE / 75; // rad per pixel
const ORIENTATION_DECAY_RATE = 18; // 1/s
const INERT_ZONE_MULTIPLIER = 1.4;

const DRAG_THRESHOLD = 5;
const DRAG_FACTOR = 0.01;

const ARROW_COLOR = 0x333333;
const ARROW_SHAFT_WIDTH = 2;
const ARROW_HEAD_LENGTH = 14;
const ARROW_HEAD_WIDTH = 10;
const ARROW_LABEL_SIZE = 16;
const ARROW_LABEL_OFFSET = 8;
const ARROW_CUBE_RADIUS_FACTOR = 1.4; // arrow endpoints sit on a square slightly bigger than the cube face

const MAIN_LABEL_FONT_SIZE = 18;
const MAIN_LABEL_COLOR = 0x333333;
const MAIN_LABEL_MARGIN = 24; // pixels between the bottom of the label and the top of the main cube viewport

const NEXT_STEP_ANIMATION_MS = 1000;

const KEY_TO_COLOR: Record<string, Color> = {
  w: 'W',
  y: 'Y',
  g: 'G',
  b: 'B',
  r: 'R',
  o: 'O',
};

const FACE_LIST: ReadonlyArray<Face> = ['U', 'D', 'F', 'B', 'L', 'R'];

function parseInstruction(instr: string): { face: Face; angle: number } | null {
  if (instr.length < 1 || instr.length > 2) return null;
  const face = instr[0] as Face;
  if (!FACE_LIST.includes(face)) return null;
  if (instr.length === 1) return { face, angle: -Math.PI / 2 };
  if (instr[1] === '2') return { face, angle: -Math.PI };
  if (instr[1] === "'") return { face, angle: Math.PI / 2 };
  return null;
}

const PALETTE_LAYOUT: ReadonlyArray<readonly [number, number, Color]> = [
  [1, 0, 'W'],
  [0, 1, 'O'],
  [1, 1, 'G'],
  [2, 1, 'R'],
  [3, 1, 'B'],
  [1, 2, 'Y'],
];

const SWATCH_SIZE = 56;
const SWATCH_GAP = 6;
const PALETTE_MARGIN = 16;
const BORDER_NORMAL = 2;
const BORDER_SELECTED = 4;
const CELL_SIZE = SWATCH_SIZE + BORDER_NORMAL * 2;
const BORDER_COLOR = 0x000000;

function mixHex(color: number, bg: number, bgWeight: number): number {
  const cr = (color >> 16) & 0xff;
  const cg = (color >> 8) & 0xff;
  const cb = color & 0xff;
  const br = (bg >> 16) & 0xff;
  const bgg = (bg >> 8) & 0xff;
  const bb = bg & 0xff;
  const w = bgWeight;
  const r = Math.round(cr * (1 - w) + br * w);
  const g = Math.round(cg * (1 - w) + bgg * w);
  const b = Math.round(cb * (1 - w) + bb * w);
  return (r << 16) | (g << 8) | b;
}

interface Swatch {
  color: Color;
  face: THREE.Mesh;
  faceMaterial: THREE.MeshBasicMaterial;
}

interface ManagedCube {
  view: CubeView;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  viewportSize: number;
  screenCenter: { x: number; y: number };
  facelets: CubeFacelets;
  idleOrientation: THREE.Quaternion;
  targetOrientation: THREE.Quaternion;
  currentOrientation: THREE.Quaternion;
  frozen: boolean;
  spinningFace: { face: Face; angle: number } | null;
}

interface ArrowOverlay {
  shaft: THREE.Mesh;
  head: THREE.Mesh;
  label: Text;
}

interface NextStepDisplay {
  cube: ManagedCube;
  arrow: ArrowOverlay;
  instruction: string;
}

function nextStepGridSize(count: number): number {
  return Math.max(4, Math.ceil((count + 1) / 2));
}

function nextStepSlotPosition(
  index: number,
  N: number,
  W: number,
  H: number,
): { x: number; y: number } {
  if (index < N) {
    return {
      x: (W * (2 * N - 1)) / (2 * N),
      y: (H * (2 * index + 1)) / (2 * N),
    };
  }
  const j = index - N + 1;
  return {
    x: (W * (2 * (N - j) - 1)) / (2 * N),
    y: (H * (2 * N - 1)) / (2 * N),
  };
}

export class UI {
  private readonly host: HTMLElement;
  private readonly bodyGeometry: THREE.BufferGeometry;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly overlayScene = new THREE.Scene();
  private readonly overlayCamera: THREE.OrthographicCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private readonly swatches: Swatch[] = [];
  private readonly swatchFaces: THREE.Mesh[] = [];
  private selectedColor: Color | null = null;
  private hoveredColor: Color | null = null;

  private readonly mainCube: ManagedCube;
  private readonly nextStepDisplays: NextStepDisplay[] = [];
  private readonly mainCubeLabel: Text;

  private pointerScreenPos: { x: number; y: number } | null = null;
  private lastFrameTime = 0;
  private dragState: {
    startPointer: { x: number; y: number };
    startOrientation: THREE.Quaternion;
    active: boolean;
    cube: ManagedCube;
  } | null = null;
  private wasDragging = false;

  private readonly tmpAxis = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();

  private readonly arrowShaftGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly arrowShaftMaterial = new THREE.MeshBasicMaterial({
    color: ARROW_COLOR,
    side: THREE.DoubleSide,
    transparent: false,
  });
  private readonly arrowHeadGeometry: THREE.BufferGeometry;
  private readonly arrowHeadMaterial = new THREE.MeshBasicMaterial({
    color: ARROW_COLOR,
    side: THREE.DoubleSide,
    transparent: false,
  });

  private animationState: {
    startTime: number;
    duration: number;
    face: Face;
    targetAngle: number;
    nextStepIndex: number;
  } | null = null;

  onPaletteColorClicked: (color: Color) => void = () => {};
  onMainCubeFaceletClicked: (face: Face, index: number) => void = () => {};
  onNextStepCubeClicked: (index: number) => void = () => {};

  constructor(host: HTMLElement, bodyGeometry: THREE.BufferGeometry) {
    this.host = host;
    this.bodyGeometry = bodyGeometry;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.setClearColor(BG_COLOR);
    this.renderer.autoClear = false;
    host.appendChild(this.renderer.domElement);

    this.overlayCamera = new THREE.OrthographicCamera(
      0,
      host.clientWidth,
      0,
      host.clientHeight,
      0.1,
      100,
    );
    this.overlayCamera.position.z = 10;

    this.arrowHeadGeometry = new THREE.BufferGeometry();
    this.arrowHeadGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, -1, -0.5, 0, -1, 0.5, 0], 3),
    );

    this.mainCube = this.createManagedCube(
      this.viewportSizeFor(MAIN_CUBE_VIEWPORT_FACTOR),
      solvedCube(),
    );

    this.mainCubeLabel = new Text();
    this.mainCubeLabel.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
    });
    this.mainCubeLabel.fontSize = MAIN_LABEL_FONT_SIZE;
    this.mainCubeLabel.color = MAIN_LABEL_COLOR;
    this.mainCubeLabel.anchorX = 'center';
    this.mainCubeLabel.anchorY = 'bottom';
    this.mainCubeLabel.scale.y = -1; // overlay Y is flipped; mirror so glyphs read right-side-up
    this.overlayScene.add(this.mainCubeLabel);

    this.buildPalette();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', (e) => this.onClick(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointerleave', () => this.onPointerLeave());
  }

  start(): void {
    this.lastFrameTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = now;
      this.updateCubeOrientation(this.mainCube, dt);
      for (const display of this.nextStepDisplays) {
        this.updateCubeOrientation(display.cube, dt);
      }
      this.updateAnimation(now);
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private updateAnimation(now: number): void {
    if (!this.animationState) return;
    const elapsed = now - this.animationState.startTime;
    const t = Math.min(elapsed / this.animationState.duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out

    this.mainCube.spinningFace = {
      face: this.animationState.face,
      angle: this.animationState.targetAngle * eased,
    };
    this.applyCubeView(this.mainCube);

    this.setFadeOpacity(1 - eased);

    if (t >= 1) {
      const index = this.animationState.nextStepIndex;
      this.animationState = null;
      this.mainCube.spinningFace = null;
      this.setFadeOpacity(1);
      this.onNextStepCubeClicked(index);
    }
  }

  private setFadeOpacity(opacity: number): void {
    const transparent = opacity < 1;
    this.arrowShaftMaterial.opacity = opacity;
    this.arrowShaftMaterial.transparent = transparent;
    this.arrowHeadMaterial.opacity = opacity;
    this.arrowHeadMaterial.transparent = transparent;

    for (const display of this.nextStepDisplays) {
      const view = display.cube.view;
      view.bodyMaterial.opacity = opacity;
      view.bodyMaterial.transparent = transparent;
      for (const face of FACE_LIST) {
        for (const mat of view.faceletMaterials[face]) {
          mat.opacity = opacity;
          mat.transparent = transparent;
        }
      }
      (display.arrow.label.material as THREE.Material).opacity = opacity;
    }
  }

  private startNextStepAnimation(index: number): void {
    if (this.animationState) return;
    if (index < 0 || index >= this.nextStepDisplays.length) return;
    const instruction = this.nextStepDisplays[index].instruction;
    const parsed = parseInstruction(instruction);
    if (!parsed) {
      // Fall through: jump straight to logic with no animation.
      this.onNextStepCubeClicked(index);
      return;
    }
    this.animationState = {
      startTime: performance.now(),
      duration: NEXT_STEP_ANIMATION_MS,
      face: parsed.face,
      targetAngle: parsed.angle,
      nextStepIndex: index,
    };
  }

  showSelectedColor(color: Color): void {
    this.selectedColor = color;
    this.renderSwatches();
  }

  renderMainCube(facelets: CubeFacelets): void {
    this.mainCube.facelets = facelets;
    this.mainCube.screenCenter = {
      x: this.host.clientWidth / 2,
      y: this.host.clientHeight / 2,
    };
    this.applyCubeView(this.mainCube);
    this.layoutNextSteps();
    this.positionMainCubeLabel();
  }

  setMainCubeLabel(text: string): void {
    this.mainCubeLabel.text = text;
    this.mainCubeLabel.maxWidth = this.host.clientWidth * 0.9;
    this.positionMainCubeLabel();
    this.mainCubeLabel.sync();
  }

  private positionMainCubeLabel(): void {
    const x = this.mainCube.screenCenter.x;
    const y = this.mainCube.screenCenter.y - this.mainCube.viewportSize / 2 - MAIN_LABEL_MARGIN;
    this.mainCubeLabel.position.set(x, y, 1);
  }

  renderNextStepCubes(steps: NextStepCube[]): void {
    while (this.nextStepDisplays.length > steps.length) {
      const display = this.nextStepDisplays.pop()!;
      this.overlayScene.remove(display.arrow.shaft);
      this.overlayScene.remove(display.arrow.head);
      this.overlayScene.remove(display.arrow.label);
    }
    while (this.nextStepDisplays.length < steps.length) {
      const cube = this.createManagedCube(
        this.viewportSizeFor(NEXT_STEP_VIEWPORT_FACTOR),
        solvedCube(),
      );
      const arrow = this.createArrow();
      this.overlayScene.add(arrow.shaft);
      this.overlayScene.add(arrow.head);
      this.overlayScene.add(arrow.label);
      this.nextStepDisplays.push({ cube, arrow, instruction: '' });
    }

    for (let i = 0; i < steps.length; i++) {
      this.nextStepDisplays[i].cube.facelets = steps[i].facelets;
      this.nextStepDisplays[i].instruction = steps[i].instruction;
    }

    this.layoutNextSteps();
  }

  private createManagedCube(viewportSize: number, facelets: CubeFacelets): ManagedCube {
    const view = createCubeView(this.bodyGeometry);
    const scene = new THREE.Scene();
    scene.add(view.group);
    const camera = new THREE.PerspectiveCamera(CUBE_FOV_DEG, 1, 0.1, 100);
    camera.position.set(0, 0, CAMERA_DISTANCE);
    return {
      view,
      scene,
      camera,
      viewportSize,
      screenCenter: { x: 0, y: 0 },
      facelets,
      idleOrientation: new THREE.Quaternion(),
      targetOrientation: new THREE.Quaternion(),
      currentOrientation: new THREE.Quaternion(),
      frozen: false,
      spinningFace: null,
    };
  }

  private viewportSizeFor(factor: number): number {
    return factor * this.host.clientHeight;
  }

  private createArrow(): ArrowOverlay {
    const shaft = new THREE.Mesh(this.arrowShaftGeometry, this.arrowShaftMaterial);
    const head = new THREE.Mesh(this.arrowHeadGeometry, this.arrowHeadMaterial);

    const label = new Text();
    // Provide a DoubleSide base material so the label survives the Y-flipped overlay projection.
    label.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
    });
    label.fontSize = ARROW_LABEL_SIZE;
    label.color = ARROW_COLOR;
    label.anchorX = 'center';
    label.anchorY = 'middle';
    // Overlay camera flips Y in NDC; mirror the glyph geometry vertically so text reads right-side-up.
    label.scale.y = -1;

    return { shaft, head, label };
  }

  private layoutNextSteps(): void {
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    const N = nextStepGridSize(this.nextStepDisplays.length);
    const mainRadius = this.cubeScreenHalfSize(this.mainCube) * ARROW_CUBE_RADIUS_FACTOR;
    for (let i = 0; i < this.nextStepDisplays.length; i++) {
      const display = this.nextStepDisplays[i];
      display.cube.screenCenter = nextStepSlotPosition(i, N, W, H);
      this.applyCubeView(display.cube);
      const nextRadius = this.cubeScreenHalfSize(display.cube) * ARROW_CUBE_RADIUS_FACTOR;
      this.updateArrow(
        display.arrow,
        this.mainCube.screenCenter,
        mainRadius,
        display.cube.screenCenter,
        nextRadius,
        display.instruction,
      );
    }
  }

  private updateArrow(
    arrow: ArrowOverlay,
    from: { x: number; y: number },
    fromRadius: number,
    to: { x: number; y: number },
    toRadius: number,
    instruction: string,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const maxAbs = Math.max(Math.abs(dx), Math.abs(dy));
    if (maxAbs < fromRadius + toRadius + 1) return;

    // Box-intersection: the line from each cube center exits a square of half-size R
    // at parameter R / max(|dx|, |dy|). Top/bottom slots exit through the top/bottom
    // face of the box; side slots exit through the side face.
    const tStart = fromRadius / maxAbs;
    const tEnd = 1 - toRadius / maxAbs;
    const startX = from.x + tStart * dx;
    const startY = from.y + tStart * dy;
    const endX = from.x + tEnd * dx;
    const endY = from.y + tEnd * dy;

    const aDx = endX - startX;
    const aDy = endY - startY;
    const aDist = Math.hypot(aDx, aDy);
    if (aDist < 1) return;

    const dirX = aDx / aDist;
    const dirY = aDy / aDist;
    const angle = Math.atan2(aDy, aDx);
    const shaftLength = Math.max(0, aDist - ARROW_HEAD_LENGTH);

    arrow.shaft.position.set(
      startX + (dirX * shaftLength) / 2,
      startY + (dirY * shaftLength) / 2,
      1,
    );
    arrow.shaft.scale.set(shaftLength, ARROW_SHAFT_WIDTH, 1);
    arrow.shaft.rotation.z = angle;

    arrow.head.position.set(endX, endY, 1);
    arrow.head.scale.set(ARROW_HEAD_LENGTH, ARROW_HEAD_WIDTH, 1);
    arrow.head.rotation.z = angle;

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    arrow.label.position.set(
      midX - dirY * ARROW_LABEL_OFFSET,
      midY + dirX * ARROW_LABEL_OFFSET,
      1,
    );
    arrow.label.text = instruction;
    arrow.label.sync();
  }

  private applyCubeView(cube: ManagedCube): void {
    updateCubeView(cube.view, {
      facelets: cube.facelets,
      orientation: cube.currentOrientation,
      spinningFace: cube.spinningFace,
    });
  }

  private updateCubeOrientation(cube: ManagedCube, dt: number): void {
    if (this.dragState?.cube === cube) return;

    const inertRadius = this.cubeScreenHalfSize(cube) * INERT_ZONE_MULTIPLIER;

    let dx = 0;
    let dy = 0;
    let dist = 0;
    let pointerOutside: boolean;
    if (this.pointerScreenPos) {
      dx = this.pointerScreenPos.x - cube.screenCenter.x;
      dy = this.pointerScreenPos.y - cube.screenCenter.y;
      dist = Math.hypot(dx, dy);
      pointerOutside = dist > inertRadius;
    } else {
      pointerOutside = true;
    }

    if (cube.frozen) {
      if (!pointerOutside) return;
      cube.frozen = false;
    }

    if (this.pointerScreenPos && dist > 0) {
      const angle = Math.min(TILT_FACTOR * dist, MAX_TILT_ANGLE);
      this.tmpAxis.set(-dy / dist, -dx / dist, 0);
      this.tmpQuat.setFromAxisAngle(this.tmpAxis, angle);
      cube.targetOrientation.multiplyQuaternions(this.tmpQuat, cube.idleOrientation);
    } else {
      cube.targetOrientation.copy(cube.idleOrientation);
    }

    const t = 1 - Math.exp(-ORIENTATION_DECAY_RATE * dt);
    cube.currentOrientation.slerp(cube.targetOrientation, t);
    this.applyCubeView(cube);
  }

  private cubeScreenHalfSize(cube: ManagedCube): number {
    return (CUBE_FACE_FILL_RATIO / 2) * cube.viewportSize;
  }

  private findNearestCube(px: number, py: number): ManagedCube {
    let nearest: ManagedCube = this.mainCube;
    let nearestDist = Math.hypot(
      px - this.mainCube.screenCenter.x,
      py - this.mainCube.screenCenter.y,
    );
    for (const display of this.nextStepDisplays) {
      const d = Math.hypot(px - display.cube.screenCenter.x, py - display.cube.screenCenter.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = display.cube;
      }
    }
    return nearest;
  }

  private renderSwatches(): void {
    for (const sw of this.swatches) {
      const isSelected = sw.color === this.selectedColor;
      const isHovered = sw.color === this.hoveredColor;
      const baseHex = COLOR_HEX[sw.color];
      sw.faceMaterial.color.setHex(isHovered ? mixHex(baseHex, 0xffffff, 0.5) : baseHex);
      const borderThickness = isSelected ? BORDER_SELECTED : BORDER_NORMAL;
      const faceSize = CELL_SIZE - borderThickness * 2;
      sw.face.scale.set(faceSize, faceSize, 1);
    }
  }

  private buildPalette(): void {
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: BORDER_COLOR,
      side: THREE.DoubleSide,
    });
    const unitPlane = new THREE.PlaneGeometry(1, 1);

    for (const [col, row, color] of PALETTE_LAYOUT) {
      const cx = PALETTE_MARGIN + col * (SWATCH_SIZE + SWATCH_GAP) + SWATCH_SIZE / 2;
      const cy = PALETTE_MARGIN + row * (SWATCH_SIZE + SWATCH_GAP) + SWATCH_SIZE / 2;

      const border = new THREE.Mesh(unitPlane, borderMaterial);
      border.position.set(cx, cy, 0);
      border.scale.set(CELL_SIZE, CELL_SIZE, 1);
      this.overlayScene.add(border);

      const faceMaterial = new THREE.MeshBasicMaterial({
        color: COLOR_HEX[color],
        side: THREE.DoubleSide,
      });
      const face = new THREE.Mesh(unitPlane, faceMaterial);
      face.position.set(cx, cy, 1);
      face.scale.set(SWATCH_SIZE, SWATCH_SIZE, 1);
      face.userData.paletteColor = color;
      this.overlayScene.add(face);

      this.swatches.push({ color, face, faceMaterial });
      this.swatchFaces.push(face);
    }
  }

  private onResize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.overlayCamera.right = w;
    this.overlayCamera.bottom = h;
    this.overlayCamera.updateProjectionMatrix();
    this.mainCube.viewportSize = this.viewportSizeFor(MAIN_CUBE_VIEWPORT_FACTOR);
    this.mainCube.screenCenter = { x: w / 2, y: h / 2 };
    for (const display of this.nextStepDisplays) {
      display.cube.viewportSize = this.viewportSizeFor(NEXT_STEP_VIEWPORT_FACTOR);
    }
    this.applyCubeView(this.mainCube);
    this.layoutNextSteps();
    this.mainCubeLabel.maxWidth = w * 0.9;
    this.positionMainCubeLabel();
    this.mainCubeLabel.sync();
  }

  private hitTestPalette(event: MouseEvent): Color | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.overlayCamera);
    const hits = this.raycaster.intersectObjects(this.swatchFaces, false);
    if (hits.length === 0) return null;
    return hits[0].object.userData.paletteColor as Color;
  }

  private onClick(event: MouseEvent): void {
    if (this.wasDragging) {
      this.wasDragging = false;
      return;
    }
    if (this.animationState) return;
    const color = this.hitTestPalette(event);
    if (color !== null) {
      this.onPaletteColorClicked(color);
      return;
    }
    const facelet = this.hitTestMainCubeFacelet(event);
    if (facelet) {
      this.onMainCubeFaceletClicked(facelet.face, facelet.index);
      return;
    }
    const nextStepIndex = this.hitTestNextStepCube(event);
    if (nextStepIndex !== null) {
      this.startNextStepAnimation(nextStepIndex);
    }
  }

  private hitTestNextStepCube(event: MouseEvent): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    for (let i = 0; i < this.nextStepDisplays.length; i++) {
      const cube = this.nextStepDisplays[i].cube;
      const halfV = cube.viewportSize / 2;
      const dx = px - cube.screenCenter.x;
      const dy = py - cube.screenCenter.y;
      if (Math.abs(dx) > halfV || Math.abs(dy) > halfV) continue;
      this.pointer.x = dx / halfV;
      this.pointer.y = -dy / halfV;
      this.raycaster.setFromCamera(this.pointer, cube.camera);
      const hits = this.raycaster.intersectObjects(cube.view.faceletMeshes, false);
      if (hits.length > 0) return i;
    }
    return null;
  }

  private hitTestMainCubeFacelet(event: MouseEvent): { face: Face; index: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const cube = this.mainCube;
    const halfV = cube.viewportSize / 2;
    const dx = px - cube.screenCenter.x;
    const dy = py - cube.screenCenter.y;
    if (Math.abs(dx) > halfV || Math.abs(dy) > halfV) return null;
    this.pointer.x = dx / halfV;
    this.pointer.y = -dy / halfV;
    this.raycaster.setFromCamera(this.pointer, cube.camera);
    const hits = this.raycaster.intersectObjects(cube.view.faceletMeshes, false);
    if (hits.length === 0) return null;
    const obj = hits[0].object;
    return {
      face: obj.userData.face as Face,
      index: obj.userData.faceletIndex as number,
    };
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.animationState) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const targetCube = this.findNearestCube(px, py);
    this.dragState = {
      startPointer: { x: px, y: py },
      startOrientation: targetCube.currentOrientation.clone(),
      active: false,
      cube: targetCube,
    };
    this.wasDragging = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  }

  private onPointerUp(_event: PointerEvent): void {
    if (this.dragState?.active) {
      this.dragState.cube.frozen = true;
    }
    this.dragState = null;
  }

  private onPointerMove(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    this.pointerScreenPos = { x: px, y: py };

    if (this.dragState) {
      const dx = px - this.dragState.startPointer.x;
      const dy = py - this.dragState.startPointer.y;
      const dist = Math.hypot(dx, dy);
      if (!this.dragState.active && dist >= DRAG_THRESHOLD) {
        this.dragState.active = true;
        this.wasDragging = true;
      }
      if (this.dragState.active && dist > 0) {
        const angle = DRAG_FACTOR * dist;
        this.tmpAxis.set(dy / dist, dx / dist, 0);
        this.tmpQuat.setFromAxisAngle(this.tmpAxis, angle);
        this.dragState.cube.currentOrientation.multiplyQuaternions(
          this.tmpQuat,
          this.dragState.startOrientation,
        );
        this.applyCubeView(this.dragState.cube);
        this.renderer.domElement.style.cursor = 'grabbing';
        return;
      }
    }

    const color = this.hitTestPalette(event);
    this.renderer.domElement.style.cursor = color !== null ? 'pointer' : 'default';
    if (color !== this.hoveredColor) {
      this.hoveredColor = color;
      this.renderSwatches();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.animationState) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const color = KEY_TO_COLOR[event.key.toLowerCase()];
    if (color !== undefined) {
      this.onPaletteColorClicked(color);
    }
  }

  private onPointerLeave(): void {
    this.pointerScreenPos = null;
    if (!this.dragState) this.renderer.domElement.style.cursor = 'default';
    if (this.hoveredColor !== null) {
      this.hoveredColor = null;
      this.renderSwatches();
    }
  }

  private render(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w, h);
    this.renderer.clear();

    this.renderer.setScissorTest(true);
    this.renderCubeView(this.mainCube);
    for (const display of this.nextStepDisplays) {
      this.renderCubeView(display.cube);
    }
    this.renderer.setScissorTest(false);

    this.renderer.setViewport(0, 0, w, h);
    this.renderer.clearDepth();
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }

  private renderCubeView(cube: ManagedCube): void {
    const h = this.host.clientHeight;
    const vw = cube.viewportSize;
    const vh = cube.viewportSize;
    const vx = cube.screenCenter.x - vw / 2;
    // WebGL's viewport Y is measured from the bottom of the canvas; convert from top-origin pixels.
    const vy = h - cube.screenCenter.y - vh / 2;
    this.renderer.setViewport(vx, vy, vw, vh);
    this.renderer.setScissor(vx, vy, vw, vh);
    this.renderer.clear();
    this.renderer.render(cube.scene, cube.camera);
  }
}
