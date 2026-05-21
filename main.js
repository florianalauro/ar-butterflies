import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// --- CONFIGURAZIONE GLOBALE ---
const BUTTERFLY_COUNT = 120; 
const butterflies = [];      
const mixers = [];           
let scene, camera, renderer, gltfClip, butterflyTemplate;
let lastTime = 0; 

// --- 1. FOTOCAMERA IN SCONDO PER SPLASH SCREEN ---
let bgStream;
async function startBackgroundCamera() {
  const video = document.getElementById('bg-video');
  if (!video) return;
  try {
    bgStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = bgStream;
  } catch (err) {
    console.warn("Nota: Fotocamera splash non disponibile su questo dispositivo (normale da PC).");
  }
}

// --- 2. INIZIALIZZAZIONE ---
function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(2, 5, 2);
  scene.add(directionalLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  const fakeContainer = document.createElement('div');
  fakeContainer.appendChild(ARButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'hand-tracking'] 
  }));

  createTunnel();
  loadButterflyModel();

  const startBtn = document.getElementById('start-ar-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startARSession);
  }

  window.addEventListener('resize', onWindowResize);
  renderer.setAnimationLoop(animate);
}

// --- 3. CARICAMENTO DEL MODELLO GLB ---
function loadButterflyModel() {
  const loader = new GLTFLoader();
  // Assicurati che butterfly.glb sia nella radice del progetto su GitHub
  loader.load('./butterfly.glb', (gltf) => {
    butterflyTemplate = gltf.scene;
    if (gltf.animations && gltf.animations.length > 0) {
      gltfClip = gltf.animations[0];
    }
    createButterfliesSciame();
  }, undefined, (error) => {
    console.error("Errore critico nel caricamento del file butterfly.glb:", error);
  });
}

// --- 4. CREAZIONE SCIAME (Con Scala Aumentata e Rotazione Fissa) ---
function createButterfliesSciame() {
  if (!butterflyTemplate) return;
  const L = 25, H = 2.85, W = 6.30;

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const bClone = SkeletonUtils.clone(butterflyTemplate);
    
    // ⬇️ MODIFICA 1: Aumentiamo la scala per farle più grandi
    // Prova con 0.15 (prima era 0.05, quindi ora sono 3 volte più grandi). 
    // Regola a piacimento.
    bClone.scale.set(0.15, 0.15, 0.15); 

    const x = (Math.random() * L) - L/2;
    const y = (Math.random() * H);
    const z = (Math.random() * W) - W; 

    bClone.position.set(x, y, z);
    
    // ⬇️ MODIFICA 2: Orientiamo tutte verso destra (asse +X)
    // Three.js importa i modelli .glb rivolti verso Z positivo. 
    // Ruotiamo di +90 gradi (Math.PI / 2) sull'asse Y per farle guardare a destra.
    // Rimuoviamo la rotazione casuale Math.random() di prima.
    bClone.rotation.set(0, Math.PI / 2, 0); 
    
    scene.add(bClone);

    let mixer = null;
    if (gltfClip) {
      mixer = new THREE.AnimationMixer(bClone);
      const action = mixer.clipAction(gltfClip);
      action.play();
      action.time = Math.random() * gltfClip.duration;
      mixer.timeScale = 0.8 + Math.random() * 0.5;
      mixers.push(mixer);
    }

    butterflies.push({
      mesh: bClone,
      mixer: mixer,
      speedX: 0.02 + Math.random() * 0.03, // Velocità casuale
      waveOffset: Math.random() * 100
    });
  }
}

// --- 5. AVVIO SESSIONE AR AUTOMATICA (Identico) ---
async function startARSession() {
  if (bgStream) {
    bgStream.getTracks().forEach(track => track.stop());
  }
  const bgVideo = document.getElementById('bg-video');
  const splash = document.getElementById('splash-screen');
  const ui = document.getElementById('ui-layer');
  if (bgVideo) bgVideo.style.display = 'none';
  if (splash) splash.style.display = 'none';
  if (ui) ui.style.display = 'block';
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['local-floor', 'hand-tracking']
    });
    renderer.xr.setSession(session);
  } catch (err) {
    console.error("Impossibile avviare la sessione WebXR AR:", err);
    alert("Il tuo browser o dispositivo non supporta WebXR AR.");
  }
}

// --- 6. TUNNEL (Identico) ---
function createTunnel() {
  const tunnelMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444, wireframe: true, transparent: true, opacity: 0.15, side: THREE.DoubleSide
  });
  const L = 25, H = 2.85, W = 6.30; 
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(0, 0, -W/2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), tunnelMaterial);
  floor.rotation.x = -Math.PI / 2; tunnelGroup.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(L, W), tunnelMaterial);
  ceiling.rotation.x = Math.PI / 2; tunnelGroup.add(ceiling);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), tunnelMaterial);
  backWall.position.set(0, H/2, -W/2); tunnelGroup.add(backWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(L/2, H/2, 0); tunnelGroup.add(rightWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-L/2, H/2, 0); tunnelGroup.add(leftWall);
  scene.add(tunnelGroup);
}

// --- 7. LOOP ANIMAZIONE (Con Moto Invertito verso Destra) ---
function animate(timestamp) {
  if (!timestamp) timestamp = performance.now();
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  for (const mixer of mixers) {
    mixer.update(delta);
  }

  if (renderer.xr.isPresenting) {
    const time = timestamp * 0.002;

    butterflies.forEach((b) => {
      // ⬇️ MODIFICA 3: Invertiamo il moto da sinistra (-=) a DESTRA (+=)
      b.mesh.position.x += b.speedX; 

      // Manteniamo il volo fluttuante sugli assi Y e Z
      b.mesh.position.y += Math.sin(time + b.waveOffset) * 0.003;
      b.mesh.position.z += Math.cos(time + b.waveOffset) * 0.002;

      // ⬇️ MODIFICA 4: Aggiorniamo la logica di riciclo per il moto verso destra
      // Se escono dal confine destro (X > 12.5m)
      if (b.mesh.position.x > 12.5) {
        // Le rimetiamo al confine sinistro (X = -12.5m) per ricominciare il volo
        b.mesh.position.x = -12.5; 
        // Cambiamo casualmente l'altezza per evitare ripetizioni
        b.mesh.position.y = Math.random() * 2.85; 
      }
    });
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Partenza
startBackgroundCamera();
init();