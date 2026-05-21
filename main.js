import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let scene, camera, renderer, butterflyMesh, bgStream;
const dummy = new THREE.Object3D();
const BUTTERFLY_COUNT = 500;
const colorStart = new THREE.Color('#ce0058');
const colorMid = new THREE.Color('#fe5000');

// --- 1. ACCENSIONE FOTOCAMERA PER LO SPLASH SCREEN ---
async function startBackgroundCamera() {
  const video = document.getElementById('bg-video');
  try {
    bgStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = bgStream;
  } catch (err) {
    console.error("Errore fotocamera splash:", err);
  }
}

// --- 2. INIZIALIZZAZIONE THREE.JS ---
function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 5, 0);
  scene.add(directionalLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Creazione del tunnel e farfalle (nascoste finché non parte l'AR)
  createTunnel();
  createButterflies();

  // Gestione pulsante START
  const startBtn = document.getElementById('start-ar-btn');
  startBtn.addEventListener('click', startARSession);

  window.addEventListener('resize', onWindowResize);
  renderer.setAnimationLoop(animate);
}

// --- 3. AVVIO SESSIONE AR (WebXR) ---
async function startARSession() {
  // Spegniamo il video di sfondo dello splash screen
  if (bgStream) {
    bgStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('bg-video').style.display = 'none';
  document.getElementById('splash-screen').style.display = 'none';
  document.getElementById('ui-layer').style.display = 'block';

  // Attiviamo la sessione AR di WebXR
  // Nota: WebXR richiede un'interazione utente per partire, startBtn soddisfa questo requisito.
  const sessionInit = { requiredFeatures: ['local-floor'] };
  const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
  renderer.xr.setSession(session);
}

// --- LOGICA TUNNEL E FARFALLE (Identica alla precedente) ---
function createTunnel() {
  const tunnelMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444, wireframe: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide
  });
  const L = 25, H = 2.85, W = 6.30; 
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(0, 0, -W/2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), tunnelMaterial);
  floor.rotation.x = -Math.PI / 2; tunnelGroup.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(L, W), tunnelMaterial);
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, H, 0); tunnelGroup.add(ceiling);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), tunnelMaterial);
  backWall.position.set(0, H/2, -W/2); tunnelGroup.add(backWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(L/2, H/2, 0); tunnelGroup.add(rightWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-L/2, H/2, 0); tunnelGroup.add(leftWall);
  scene.add(tunnelGroup);
}

function createButterflies() {
  const geometry = new THREE.PlaneGeometry(0.15, 0.15); 
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  butterflyMesh = new THREE.InstancedMesh(geometry, material, BUTTERFLY_COUNT);
  butterflyMesh.position.set(0, 0, -3.15);
  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const x = (Math.random() * 25) - 12.5; 
    const y = Math.random() * 2.85;        
    const z = (Math.random() * 6.30) - 3.15;
    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    butterflyMesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(butterflyMesh);
}

function animate() {
  if (renderer.xr.isPresenting && butterflyMesh) {
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      butterflyMesh.getMatrixAt(i, dummy.matrix);
      dummy.position.setFromMatrixPosition(dummy.matrix);
      dummy.position.x -= 0.04; 
      if (dummy.position.x < -12.5) dummy.position.x = 12.5;
      dummy.rotation.y += 0.1;
      dummy.updateMatrix();
      butterflyMesh.setMatrixAt(i, dummy.matrix);
      const color = new THREE.Color();
      color.lerpColors(colorMid, colorStart, (dummy.position.x + 12.5) / 25);
      butterflyMesh.setColorAt(i, color);
    }
    butterflyMesh.instanceMatrix.needsUpdate = true;
    butterflyMesh.instanceColor.needsUpdate = true;
  }
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Lancio
startBackgroundCamera();
init();