import * as THREE from 'three';
import { createSmokeState } from './core/hello.js';

const root = document.getElementById('app');
if (root) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 4, 8);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  root.appendChild(renderer.domElement);

  const lantern = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8, 0),
    new THREE.MeshStandardMaterial({ color: 0xffc857, emissive: 0xff9f1c, emissiveIntensity: 0.7 })
  );
  lantern.position.y = 1.2;
  scene.add(lantern);

  const light = new THREE.PointLight(0xffcf6b, 3, 25);
  light.position.set(0, 2.5, 2);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x334466, 0.8));

  const state = createSmokeState();
  const badge = document.createElement('div');
  badge.textContent = `${state.title} — CP0 Ready`;
  badge.style.cssText = 'position:absolute;top:12px;left:12px;padding:6px 10px;background:rgba(0,0,0,0.6);border-radius:6px;';
  root.appendChild(badge);

  const animate = () => {
    lantern.rotation.y += 0.01;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
}
