import * as THREE from 'three';
import { COLOR_HEX, CubeFacelets, Face } from './state';

const CUBIE_CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1],
  [+1, -1, -1],
  [-1, +1, -1],
  [+1, +1, -1],
  [-1, -1, +1],
  [+1, -1, +1],
  [-1, +1, +1],
  [+1, +1, +1],
];

// For each face, the cubie indices for facelet positions [top-left, top-right, bottom-left, bottom-right]
// as viewed from outside the cube.
const FACELET_TO_CUBIE: Record<Face, readonly [number, number, number, number]> = {
  U: [2, 3, 6, 7],
  D: [4, 5, 0, 1],
  F: [6, 7, 4, 5],
  B: [3, 2, 1, 0],
  L: [2, 6, 0, 4],
  R: [7, 3, 5, 1],
};

const FACE_AXIS: Record<Face, readonly [number, number, number]> = {
  U: [0, +1, 0],
  D: [0, -1, 0],
  F: [0, 0, +1],
  B: [0, 0, -1],
  L: [-1, 0, 0],
  R: [+1, 0, 0],
};

const ALL_FACES: ReadonlyArray<Face> = ['U', 'D', 'F', 'B', 'L', 'R'];

const FACELET_SIZE = 0.9;
const FACELET_OFFSET = 0.501;
const FACELET_POLYGON_OFFSET_FACTOR = -1;
const FACELET_POLYGON_OFFSET_UNITS = -4;

interface Cubie {
  basePos: THREE.Vector3;
  group: THREE.Group;
}

type FaceletQuad = [
  THREE.MeshBasicMaterial,
  THREE.MeshBasicMaterial,
  THREE.MeshBasicMaterial,
  THREE.MeshBasicMaterial,
];

export interface CubeView {
  group: THREE.Group;
  cubies: Cubie[];
  faceletMaterials: Record<Face, FaceletQuad>;
  faceletMeshes: THREE.Mesh[];
  bodyMaterial: THREE.MeshBasicMaterial;
}

export interface CubeViewParams {
  facelets: CubeFacelets;
  orientation: THREE.Quaternion;
  spinningFace: { face: Face; angle: number } | null;
}

export function createCubeView(bodyGeometry: THREE.BufferGeometry): CubeView {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const cubies: Cubie[] = [];
  for (let i = 0; i < 8; i++) {
    const [sx, sy, sz] = CUBIE_CORNERS[i];
    const basePos = new THREE.Vector3(sx * 0.5, sy * 0.5, sz * 0.5);
    const cubieGroup = new THREE.Group();
    cubieGroup.position.copy(basePos);
    cubieGroup.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
    cubies.push({ basePos, group: cubieGroup });
    group.add(cubieGroup);
  }

  const faceletGeometry = new THREE.PlaneGeometry(FACELET_SIZE, FACELET_SIZE);
  const faceletMaterials = {} as Record<Face, FaceletQuad>;
  const faceletMeshes: THREE.Mesh[] = [];

  for (const face of ALL_FACES) {
    const cubieIndices = FACELET_TO_CUBIE[face];
    const [ax, ay, az] = FACE_AXIS[face];
    const materials: THREE.MeshBasicMaterial[] = [];

    for (let i = 0; i < 4; i++) {
      const cubie = cubies[cubieIndices[i]];
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        polygonOffset: true,
        polygonOffsetFactor: FACELET_POLYGON_OFFSET_FACTOR,
        polygonOffsetUnits: FACELET_POLYGON_OFFSET_UNITS,
      });
      const mesh = new THREE.Mesh(faceletGeometry, material);

      mesh.position.set(ax * FACELET_OFFSET, ay * FACELET_OFFSET, az * FACELET_OFFSET);

      switch (face) {
        case 'R': mesh.rotation.y = Math.PI / 2; break;
        case 'L': mesh.rotation.y = -Math.PI / 2; break;
        case 'U': mesh.rotation.x = -Math.PI / 2; break;
        case 'D': mesh.rotation.x = Math.PI / 2; break;
        case 'F': break;
        case 'B': mesh.rotation.y = Math.PI; break;
      }

      mesh.userData.face = face;
      mesh.userData.faceletIndex = i;

      cubie.group.add(mesh);
      materials.push(material);
      faceletMeshes.push(mesh);
    }

    faceletMaterials[face] = materials as FaceletQuad;
  }

  return { group, cubies, faceletMaterials, faceletMeshes, bodyMaterial };
}

const tmpQuaternion = new THREE.Quaternion();
const tmpAxis = new THREE.Vector3();
const tmpPos = new THREE.Vector3();

export function updateCubeView(view: CubeView, params: CubeViewParams): void {
  view.group.quaternion.copy(params.orientation);

  const spin = params.spinningFace;
  for (const cubie of view.cubies) {
    if (spin && cubieIsOnFace(cubie.basePos, spin.face)) {
      const [ax, ay, az] = FACE_AXIS[spin.face];
      tmpAxis.set(ax, ay, az);
      tmpQuaternion.setFromAxisAngle(tmpAxis, spin.angle);
      tmpPos.copy(cubie.basePos).applyQuaternion(tmpQuaternion);
      cubie.group.position.copy(tmpPos);
      cubie.group.quaternion.copy(tmpQuaternion);
    } else {
      cubie.group.position.copy(cubie.basePos);
      cubie.group.quaternion.identity();
    }
  }

  for (const face of ALL_FACES) {
    const colors = params.facelets[face];
    const materials = view.faceletMaterials[face];
    for (let i = 0; i < 4; i++) {
      materials[i].color.setHex(COLOR_HEX[colors[i]]);
    }
  }
}

function cubieIsOnFace(pos: THREE.Vector3, face: Face): boolean {
  switch (face) {
    case 'U': return pos.y > 0;
    case 'D': return pos.y < 0;
    case 'F': return pos.z > 0;
    case 'B': return pos.z < 0;
    case 'L': return pos.x < 0;
    case 'R': return pos.x > 0;
  }
}
