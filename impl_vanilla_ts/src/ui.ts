import * as THREE from 'three';
import { COLOR_HEX, type Color, type CubeFacelets } from './state';
import { createCubeView, updateCubeView, type CubeView } from './cube_view';

const BG_COLOR = 0xf0f0f0;
const MAIN_CUBE_ZOOM = 0.6;

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
  private mainCubeOrientation = new THREE.Quaternion();

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
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerleave', () => this.onPointerLeave());
  }

  start(): void {
    const tick = () => {
      this.render();
      requestAnimationFrame(tick);
    };
    tick();
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
        orientation: this.mainCubeOrientation,
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
    const color = this.hitTestPalette(event);
    if (color !== null) this.onPaletteColorClicked(color);
  }

  private onPointerMove(event: PointerEvent): void {
    const color = this.hitTestPalette(event);
    this.renderer.domElement.style.cursor = color !== null ? 'pointer' : 'default';
    if (color !== this.hoveredColor) {
      this.hoveredColor = color;
      this.renderSwatches();
    }
  }

  private onPointerLeave(): void {
    this.renderer.domElement.style.cursor = 'default';
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
