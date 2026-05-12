import * as THREE from 'three';

const app = document.getElementById('app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.setClearColor(0xf0f0f0);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  app.clientWidth / app.clientHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 5);

window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
