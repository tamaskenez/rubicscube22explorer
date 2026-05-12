import * as THREE from 'three';
import type { Color } from './state';

const BG_COLOR = 0xf0f0f0;

const COLOR_HEX: Record<Color, number> = {
  R: 0xba0c2f,
  G: 0x009a44,
  B: 0x003da5,
  O: 0xfe5000,
  Y: 0xffd700,
  W: 0xffffff,
};

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
  border: THREE.Mesh;
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

    this.buildPalette();

    window.addEventListener('resize', () => this.onResize());

    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', (e) => this.onClick(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
  }

  start(): void {
    const tick = () => {
      this.render();
      requestAnimationFrame(tick);
    };
    tick();
  }

  showSelectedColor(color: Color): void {
    for (const sw of this.swatches) {
      const selected = sw.color === color;
      const baseHex = COLOR_HEX[sw.color];
      sw.faceMaterial.color.setHex(selected ? baseHex : mixHex(baseHex, BG_COLOR, 0.25));
      const borderThickness = selected ? BORDER_SELECTED : BORDER_NORMAL;
      const size = SWATCH_SIZE + borderThickness * 2;
      sw.border.scale.set(size, size, 1);
    }
  }

  private buildPalette(): void {
    const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    const unitPlane = new THREE.PlaneGeometry(1, 1);
    const faceGeometry = new THREE.PlaneGeometry(SWATCH_SIZE, SWATCH_SIZE);

    for (const [col, row, color] of PALETTE_LAYOUT) {
      const cx = PALETTE_MARGIN + col * (SWATCH_SIZE + SWATCH_GAP) + SWATCH_SIZE / 2;
      const cy = PALETTE_MARGIN + row * (SWATCH_SIZE + SWATCH_GAP) + SWATCH_SIZE / 2;

      const border = new THREE.Mesh(unitPlane, blackMaterial);
      border.position.set(cx, cy, 0);
      const initialSize = SWATCH_SIZE + BORDER_NORMAL * 2;
      border.scale.set(initialSize, initialSize, 1);
      this.overlayScene.add(border);

      const faceMaterial = new THREE.MeshBasicMaterial({ color: COLOR_HEX[color], side: THREE.DoubleSide });
      const face = new THREE.Mesh(faceGeometry, faceMaterial);
      face.position.set(cx, cy, 1);
      face.userData.paletteColor = color;
      this.overlayScene.add(face);

      this.swatches.push({ color, border, faceMaterial });
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
  }

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.mainScene, this.mainCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }
}
