import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as dat from 'dat.gui';

// ================= SCENE =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a); // dark cinematic background
scene.fog = new THREE.Fog(0x0a0a0a, 5, 15);

// ================= CAMERA =================
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.2, 3);

// ================= RENDERER =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ================= LIGHTING =================

// Very low ambient light (almost dark)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
scene.add(ambientLight);

// Spotlight on character
const spotLight = new THREE.SpotLight(0xffffff, 2);
spotLight.position.set(0.2, 2.1, 0.7);      // light position
spotLight.angle = Math.PI / 6;        // spotlight cone
spotLight.penumbra = 0.4;             // soft edges
spotLight.decay = 2;
spotLight.distance = 20;
spotLight.intensity = 10;  // strong spotlight
spotLight.angle = Math.PI / 6;
spotLight.castShadow = true;
scene.add(spotLight);
scene.add(spotLight.target);

// Optional subtle fill light
const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
fillLight.position.set(-3, 2, -3);
scene.add(fillLight);

// ================= FLOOR =================
const floorGeometry = new THREE.PlaneGeometry(5, 5);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 }); // dark floor
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1;
floor.receiveShadow = true;
scene.add(floor);

// ================= CONTROLS =================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ================= LOAD GLB =================
const loader = new GLTFLoader();

loader.load(
  '/models/good-alt-less-faces-15000.glb',
  (gltf) => {
    const model = gltf.scene;

    // Center + scale
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    model.scale.setScalar(scale);

    // Ensure materials react to light and cast/receive shadows
    model.traverse((child) => {
      if (child.isMesh) {
        const mat = child.material;
        mat.side = THREE.FrontSide;

        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.needsUpdate = true;

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(model);

    // Make spotlight target the character
    spotLight.target = model;
  },
  (progress) => {
    console.log('Loading:', (progress.loaded / progress.total) * 100);
  },
  (error) => {
    console.error('Error loading GLB:', error);
  }
);

// ================= WINDOW RESIZE =================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ================= ANIMATE =================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

const gui = new dat.GUI();

const lightFolder = gui.addFolder('SpotLight');
lightFolder.add(spotLight, 'intensity', 0, 5, 0.1);
lightFolder.add(spotLight, 'angle', 0, Math.PI / 2, 0.01);
lightFolder.add(spotLight.position, 'x', -10, 10, 0.1);
lightFolder.add(spotLight.position, 'y', 0, 10, 0.1);
lightFolder.add(spotLight.position, 'z', -10, 10, 0.1);
lightFolder.open();

const ambientFolder = gui.addFolder('AmbientLight');
ambientFolder.add(ambientLight, 'intensity', 0, 1, 0.01);
ambientFolder.open();

animate();