import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import stlUrl from '../../assets/cube_rounded_25.stl?url';
import { Logic } from './logic';
import { UI } from './ui';

const host = document.getElementById('app')!;

function normalizeBodyGeometry(geom: THREE.BufferGeometry): void {
  // Assume an axis-aligned cube. Center on origin and scale so the largest extent is 1.
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  geom.translate(-center.x, -center.y, -center.z);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSize = Math.max(size.x, size.y, size.z);
  geom.scale(1 / maxSize, 1 / maxSize, 1 / maxSize);
}

async function start(): Promise<void> {
  const loader = new STLLoader();
  const bodyGeometry = await loader.loadAsync(stlUrl);
  normalizeBodyGeometry(bodyGeometry);

  const ui = new UI(host, bodyGeometry);
  const logic = new Logic(ui);
  ui.onPaletteColorClicked = (color) => logic.onPaletteColorClicked(color);
  ui.onMainCubeFaceletClicked = (face, index) => logic.onMainCubeFaceletClicked(face, index);
  ui.onNextStepCubeClicked = (index) => logic.onNextStepCubeClicked(index);

  logic.start();
  ui.start();
  console.log('Application initialized successfully.');
}

start();
