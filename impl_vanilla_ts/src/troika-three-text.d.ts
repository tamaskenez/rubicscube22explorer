declare module 'troika-three-text' {
  import * as THREE from 'three';

  export class Text extends THREE.Mesh {
    text: string;
    fontSize: number;
    color: number | string | THREE.Color;
    anchorX: 'left' | 'center' | 'right' | number | string;
    anchorY:
      | 'top'
      | 'top-baseline'
      | 'middle'
      | 'bottom-baseline'
      | 'bottom'
      | number
      | string;
    font: string;
    outlineColor: number | string | THREE.Color;
    outlineWidth: number | string;
    maxWidth: number;
    sync(callback?: () => void): void;
    dispose(): void;
  }

  export function preloadFont(options: unknown, callback: () => void): void;
}
