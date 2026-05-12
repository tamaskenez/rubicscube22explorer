import * as THREE from 'three';
import { COLOR_HEX, type Color, type CubeFacelets } from './state';
import { createCubeView, updateCubeView, type CubeView } from './cube_view';

const BG_COLOR = 0xf0f0f0;
const MAIN_CUBE_ZOOM = 0.6;

const MAX_TILT_ANGLE = Math.PI / 4; // 45 degrees
const TILT_FACTOR = MAX_TILT_ANGLE / 250; // rad per pixel; reaches the clamp ~250 px from cube center
const ORIENTATION_DECAY_RATE = 18; // 1/s; ~95% of distance covered in 1 s
const INERT_ZONE_MULTIPLIER = 1.4; // bounding circle = cube half-size × this

const DRAG_THRESHOLD = 5; // px before a pointer-down becomes a drag
const DRAG_FACTOR = 0.01; // rad per pixel of drag distance

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
  private readonly mainCubeView: CubeView;
  private mainCubeFacelets: CubeFacelets | null = null;
  private readonly mainCubeIdleOrientation = new THREE.Quaternion();
  private readonly mainCubeTargetOrientation = new THREE.Quaternion();
  private readonly mainCubeCurrentOrientation = new THREE.Quaternion();
  private pointerScreenPos: { x: number; y: number } | null = null;
  private lastFrameTime = 0;
  private dragState: {
    startPointer: { x: number; y: number };
    startOrientation: THREE.Quaternion;
    active: boolean;
  } | null = null;
  private wasDragging = false;
  private cubeFrozen = false;

  private readonly tmpAxis = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();

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

    this.mainCubeView = createCubeView();
    this.mainScene.add(this.mainCubeView.group);

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
      this.updateMainCubeOrientation(dt);
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
    this.mainCubeFacelets = facelets;
    this.updateMainCube();
  }

  private updateMainCube(): void {
    if (!this.mainCubeFacelets) return;
    updateCubeView(
      this.mainCubeView,
      {
        facelets: this.mainCubeFacelets,
        screenCenter: { x: this.host.clientWidth / 2, y: this.host.clientHeight / 2 },
        orientation: this.mainCubeCurrentOrientation,
        zoom: MAIN_CUBE_ZOOM,
        spinningFace: null,
      },
      {
        width: this.host.clientWidth,
        height: this.host.clientHeight,
        camera: this.mainCamera,
      },
    );
  }

  private updateMainCubeOrientation(dt: number): void {
    if (this.dragState) return; // freeze auto-return while pointer is down
    const cx = this.host.clientWidth / 2;
    const cy = this.host.clientHeight / 2;
    const inertRadius = this.cubeScreenHalfSize(MAIN_CUBE_ZOOM) * INERT_ZONE_MULTIPLIER;

    let dx = 0;
    let dy = 0;
    let dist = 0;
    let pointerOutside: boolean;
    if (this.pointerScreenPos) {
      dx = this.pointerScreenPos.x - cx;
      dy = this.pointerScreenPos.y - cy;
      dist = Math.hypot(dx, dy);
      pointerOutside = dist > inertRadius;
    } else {
      pointerOutside = true;
    }

    if (this.cubeFrozen) {
      if (!pointerOutside) return;
      this.cubeFrozen = false;
    }

    if (this.pointerScreenPos && dist > 0) {
      const angle = Math.min(TILT_FACTOR * dist, MAX_TILT_ANGLE);
      this.tmpAxis.set(-dy / dist, -dx / dist, 0);
      this.tmpQuat.setFromAxisAngle(this.tmpAxis, angle);
      this.mainCubeTargetOrientation.multiplyQuaternions(this.tmpQuat, this.mainCubeIdleOrientation);
    } else {
      this.mainCubeTargetOrientation.copy(this.mainCubeIdleOrientation);
    }

    const t = 1 - Math.exp(-ORIENTATION_DECAY_RATE * dt);
    this.mainCubeCurrentOrientation.slerp(this.mainCubeTargetOrientation, t);
    this.updateMainCube();
  }

  private cubeScreenHalfSize(zoom: number): number {
    const halfHeight = Math.tan((this.mainCamera.fov * Math.PI) / 360) * this.mainCamera.position.z;
    return (zoom / halfHeight) * (this.host.clientHeight / 2);
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
    const borderMaterial = new THREE.MeshBasicMaterial({ color: BORDER_COLOR, side: THREE.DoubleSide });
    const unitPlane = new THREE.PlaneGeometry(1, 1);

    for (const [col, row, color] of PALETTE_LAYOUT) {
      const cx = PALETTE_MARGIN + col * (SWATCH_SIZE + SWATCH_GAP) + SWATCH_SIZE / 2;
      const cy = PALETTE_MARGIN + row * (SWATCH_SIZE + SWATCH_GAP) + SWATCH_SIZE / 2;

      const border = new THREE.Mesh(unitPlane, borderMaterial);
      border.position.set(cx, cy, 0);
      border.scale.set(CELL_SIZE, CELL_SIZE, 1);
      this.overlayScene.add(border);

      const faceMaterial = new THREE.MeshBasicMaterial({ color: COLOR_HEX[color], side: THREE.DoubleSide });
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
    this.updateMainCube();
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
    this.dragState = {
      startPointer: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
      startOrientation: this.mainCubeCurrentOrientation.clone(),
      active: false,
    };
    this.wasDragging = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  }

  private onPointerUp(_event: PointerEvent): void {
    if (this.dragState?.active) {
      this.cubeFrozen = true;
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
        this.mainCubeCurrentOrientation.multiplyQuaternions(this.tmpQuat, this.dragState.startOrientation);
        this.updateMainCube();
        this.renderer.domElement.style.cursor = 'grabbing';
        return; // skip palette hover updates while actively dragging
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
