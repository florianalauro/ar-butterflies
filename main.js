import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
// IMPORTIAMO I MODULI PER I MODELLI 3D E LO SCHELETRO
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// --- CONFIGURAZIONE GLOBALE ---
const BUTTERFLY_COUNT = 120; // Ottimizzato per performance mobile con modelli 3D animati
const butterflies = [];      // Array per tracciare le posizioni e velocità delle farfalle
const mixers = [];           // Array per gestire le animazioni del battito d'ali
let scene, camera, renderer, gltfClip, butterflyTemplate;

// --- 1. ACCENSIONE FOTOCAMERA PER LO SPLASH SCREEN ---
let bgStream;
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

  // Luci potenziate per valorizzare il modello 3D
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(2, 5, 2);
  scene.add(directionalLight);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(ARButton.createButton(renderer, { 
    requiredFeatures: ['local-floor'] 
  }));

  createTunnel();
  
  // CARICAMENTO DEL MODELLO GLB
  loadButterflyModel();

  const startBtn = document.getElementById('start-ar-btn');
  startBtn.addEventListener('click', startARSession);

  window.addEventListener('resize', onWindowResize);
}

// --- 3. CARICATORE DEL MODELLO .GLB ---
function loadButterflyModel() {
  const loader = new GLTFLoader();
  
  // Carica il file (assicurati che si chiami butterfly.glb ed sia nella radice/public)
  loader.load('./butterfly.glb', (gltf) => {
    butterflyTemplate = gltf.scene;
    
    // Se il modello ha delle animazioni incluse, prendiamo la prima (il battito d'ali)
    if (gltf.animations && gltf.animations.length > 0) {
      gltfClip = gltf.animations[0];
    }

    // Una volta caricato il modello base, generiamo lo sciame
    createButterfliesSciame();
  }, undefined, (error) => {
    console.error("Errore nel caricamento del modello GLB:", error);
  });
}

// --- 4. CREAZIONE DELLO SCIAME ANIMATO ---
function createButterfliesSciame() {
  if (!butterflyTemplate) return;

  const L = 25, H = 2.85, W = 6.30;

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    // Clona il modello in modo sicuro per preservare le animazioni ossee (bones)
    const bClone = SkeletonUtils.clone(butterflyTemplate);
    
    // SCALA: Regola la dimensione in base a quanto è grande il tuo modello originale
    // Se nel tunnel è gigante o invisibile, modifica questi tre valori (es. 0.1 o 0.01)
    bClone.scale.set(0.5, 0.5, 0.5); 

    // Posizionamento casuale dentro i confini del tunnel
    const x = (Math.random() * L) - L/2;
    const y = (Math.random() * H);
    const z = (Math.random() * W) - W; // Distribuite nel tunnel davanti a te

    bClone.position.set(x, y, z);
    
    // Rotazione casuale iniziale per non farle volare tutte parallele
    bClone.rotation.set(0, Math.random() * Math.PI, 0);

    scene.add(bClone);

    // GESTIONE ANIMAZIONE NATIVA (.glb)
    let mixer = null;
    if (gltfClip) {
      mixer = new THREE.AnimationMixer(bClone);
      const action = mixer.clipAction(gltfClip);
      action.play();
      // Sfalsa l'inizio dell'animazione così non battono le ali tutte insieme
      action.time = Math.random() * gltfClip.duration;
      // Velocità del battito d'ali leggermente casuale per ogni farfalla
      mixer.timeScale = 0.8 + Math.random() * 0.5;
      mixers.push(mixer);
    }

    // Salviamo i dati della farfalla per muoverla nel loop
    butterflies.push({
      mesh: bClone,
      mixer: mixer,
      speedX: 0.02 + Math.random() * 0.03, // Velocità di volo differenziata
      waveOffset: Math.random() * 100       // Per il volo ondulatorio
    });
  }
}

// --- 5. AVVIO SESSIONE AR ---
async function startARSession() {
  if (bgStream) {
    bgStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('bg-video').style.display = 'none';
  document.getElementById('splash-screen').style.display = 'none';
  document.getElementById('ui-layer').style.display = 'block';

  const sessionInit = { requiredFeatures: ['local-floor'] };
  const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
  renderer.xr.setSession(session);
}

// --- 6. CREAZIONE DEL TUNNEL (Identico) ---
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
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, H, 0); tunnelGroup.add(ceiling);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), tunnelMaterial);
  backWall.position.set(0, H/2, -W/2); tunnelGroup.add(backWall);
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(L/2, H/2, 0); tunnelGroup.add(rightWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-L/2, H/2, 0); tunnelGroup.add(leftWall);
  scene.add(tunnelGroup);
}

// Orologio di Three.js per calcolare il tempo esatto delle animazioni
const clock = new THREE.Clock();

// --- 7. LOOP DI ANIMAZIONE AVANZATO ---
function animate() {
  const delta = clock.getDelta();

  // Aggiorna i battiti d'ali biologici del .glb
  for (const mixer of mixers) {
    mixer.update(delta);
  }

  // Muovi le farfalle nello spazio se la sessione AR è attiva
  if (renderer.xr.isPresenting) {
    const time = Date.now() * 0.002;

    butterflies.forEach((b) => {
      // 1. Spostamento da destra a sinistra
      b.mesh.position.x -= b.speedX;

      // 2. Volo ondulatorio (sinusoide realistica)
      b.mesh.position.y += Math.sin(time + b.waveOffset) * 0.003;
      b.mesh.position.z += Math.cos(time + b.waveOffset) * 0.002;

      // 3. Reset se escono dai confini del tunnel (25m)
      if (b.mesh.position.x < -12.5) {
        b.mesh.position.x = 12.5;
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

// Lancio
startBackgroundCamera();
init();