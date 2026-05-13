import * as THREE from 'three';
import { Text } from 'troika-three-text';
import {
  COLOR_HEX,
  solvedCube,
  type Color,
  type CubeFacelets,
  type NextStepCube,
} from './state';
import { createCubeView, updateCubeView, type CubeView } from './cube_view';

const BG_COLOR = 0xf0f0f0;
const MAIN_CUBE_ZOOM = 0.6;
const NEXT_STEP_CUBE_ZOOM = 0.3;

const MAX_TILT_ANGLE = Math.PI / 4; // 45 degrees
const TILT_FACTOR = MAX_TILT_ANGLE / 250; // rad per pixel
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
  zoom: number;
  screenCenter: { x: number; y: number };
  facelets: CubeFacelets;
  idleOrientation: THREE.Quaternion;
  targetOrientation: THREE.Quaternion;
  currentOrientation: THREE.Quaternion;
  frozen: boolean;
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
  private readonly renderer: THREE.WebGLRenderer;
  private readonly mainScene = new THREE.Scene();
  private readonly mainCamera: THREE.PerspectiveCamera;
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
  });
  private readonly arrowHeadGeometry: THREE.BufferGeometry;
  private readonly arrowHeadMaterial = new THREE.MeshBasicMaterial({
    color: ARROW_COLOR,
    side: THREE.DoubleSide,
  });

  onPaletteColorClicked: (color: Color) => void = () => {};

  constructor(host: HTMLElement) {
    this.host = host;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.setClearColor(BG_COLOR);
    this.renderer.autoClear = false;
    host.appendChild(this.renderer.domElement);

    this.mainCamera = new THREE.PerspectiveCamera(
      50,
      host.clientWidth / host.clientHeight,
      0.1,
      100,
    );
    this.mainCamera.position.set(0, 0, 5);

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

    this.mainCube = this.createManagedCube(MAIN_CUBE_ZOOM, solvedCube());
    this.mainScene.add(this.mainCube.view.group);

    this.buildPalette();

    window.addEventListener('resize', () => this.onResize());

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
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
  }

  renderNextStepCubes(steps: NextStepCube[]): void {
    while (this.nextStepDisplays.length > steps.length) {
      const display = this.nextStepDisplays.pop()!;
      this.mainScene.remove(display.cube.view.group);
      this.overlayScene.remove(display.arrow.shaft);
      this.overlayScene.remove(display.arrow.head);
      this.overlayScene.remove(display.arrow.label);
    }
    while (this.nextStepDisplays.length < steps.length) {
      const cube = this.createManagedCube(NEXT_STEP_CUBE_ZOOM, solvedCube());
      this.mainScene.add(cube.view.group);
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

  private createManagedCube(zoom: number, facelets: CubeFacelets): ManagedCube {
    return {
      view: createCubeView(),
      zoom,
      screenCenter: { x: 0, y: 0 },
      facelets,
      idleOrientation: new THREE.Quaternion(),
      targetOrientation: new THREE.Quaternion(),
      currentOrientation: new THREE.Quaternion(),
      frozen: false,
    };
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
    const mainRadius =
      this.cubeScreenHalfSize(this.mainCube.zoom) * ARROW_CUBE_RADIUS_FACTOR;
    for (let i = 0; i < this.nextStepDisplays.length; i++) {
      const display = this.nextStepDisplays[i];
      display.cube.screenCenter = nextStepSlotPosition(i, N, W, H);
      this.applyCubeView(display.cube);
      const nextRadius =
        this.cubeScreenHalfSize(display.cube.zoom) * ARROW_CUBE_RADIUS_FACTOR;
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
    updateCubeView(
      cube.view,
      {
        facelets: cube.facelets,
        screenCenter: cube.screenCenter,
        orientation: cube.currentOrientation,
        zoom: cube.zoom,
        spinningFace: null,
      },
      {
        width: this.host.clientWidth,
        height: this.host.clientHeight,
        camera: this.mainCamera,
      },
    );
  }

  private updateCubeOrientation(cube: ManagedCube, dt: number): void {
    if (this.dragState?.cube === cube) return;

    const inertRadius = this.cubeScreenHalfSize(cube.zoom) * INERT_ZONE_MULTIPLIER;

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

  private cubeScreenHalfSize(zoom: number): number {
    const halfHeight = Math.tan((this.mainCamera.fov * Math.PI) / 360) * this.mainCamera.position.z;
    return (zoom / halfHeight) * (this.host.clientHeight / 2);
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
    this.mainCamera.aspect = w / h;
    this.mainCamera.updateProjectionMatrix();
    this.overlayCamera.right = w;
    this.overlayCamera.bottom = h;
    this.overlayCamera.updateProjectionMatrix();
    this.mainCube.screenCenter = { x: w / 2, y: h / 2 };
    this.applyCubeView(this.mainCube);
    this.layoutNextSteps();
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
    const color = this.hitTestPalette(event);
    if (color !== null) this.onPaletteColorClicked(color);
  }

  private onPointerDown(event: PointerEvent): void {
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

  private onPointerLeave(): void {
    this.pointerScreenPos = null;
    if (!this.dragState) this.renderer.domElement.style.cursor = 'default';
    if (this.hoveredColor !== null) {
      this.hoveredColor = null;
      this.renderSwatches();
    }
  }

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.mainScene, this.mainCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }
}
