import * as THREE from 'three';
// Importiamo il modulo magico ufficiale di Three.js per l'AR
import { ARButton } from 'three/addons/webxr/ARButton.js';

// --- CONFIGURAZIONE GLOBALE ---
const BUTTERFLY_COUNT = 500; 
const dummy = new THREE.Object3D(); // Supporto per calcolare le matrici
const colorStart = new THREE.Color('#ce0058'); // Fucsia (Destra/Inizio)
const colorMid = new THREE.Color('#fe5000');   // Arancio (Sinistra/Centro)

let scene, camera, renderer, butterflyMesh;

// --- INIZIALIZZAZIONE AMBIENTE 3D ---
function init() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  // Telecamera (field of view, aspect ratio, near, far)
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);

  // ILLUMINAZIONE PROFESSIONALE
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Luce base
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 5, 0); // Dall'alto
  scene.add(directionalLight);

  // MOTORE DI RENDERING (Configurato per WebXR)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // ABILITIAMO L'AR NATIVA!
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // AGGIUNGIAMO IL BOTTONE AR UFFICIALE
  // Three.js creerà automaticamente un pulsante "START AR" in fondo allo schermo
  document.body.appendChild(ARButton.createButton(renderer, { 
    requiredFeatures: ['local-floor'], // Richiediamo il pavimento per ancoraggio stabile
    optionalFeatures: ['hand-tracking'] // In preparazione per MediaPipe
  }));

  // Creazione del tunnel geometrico
  createTunnel();

  // Creazione dello sciame di farfalle
  createButterflies();

  window.addEventListener('resize', onWindowResize);

  // In WebXR, il loop di animazione non usa requestAnimationFrame, ma setAnimationLoop del renderer
  renderer.setAnimationLoop(animate);
}

// --- CREAZIONE DEL TUNNEL GEOMETRICO (Misure esatte) ---
function createTunnel() {
  // Materiale wireframe per definire lo spazio ma far vedere la stanza reale
  const tunnelMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444, wireframe: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide
  });
  
  // Dimensioni: 25m Lunghezza, 2.85m Altezza, 6.30m Larghezza
  const L = 25, H = 2.85, W = 6.30; 
  const tunnelGroup = new THREE.Group();

  // Mettiamo il tunnel fisicamente davanti all'utente (asse Z negativo) e centrato a terra
  tunnelGroup.position.set(0, 0, -W/2);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), tunnelMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0); tunnelGroup.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(L, W), tunnelMaterial);
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, H, 0); tunnelGroup.add(ceiling);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), tunnelMaterial);
  backWall.position.set(0, H/2, -W/2); tunnelGroup.add(backWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(L/2, H/2, 0); tunnelGroup.add(rightWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), tunnelMaterial);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-L/2, H/2, 0); tunnelGroup.add(leftWall);

  const gridHelper = new THREE.GridHelper(W, 10, 0x888888, 0x444444);
  gridHelper.position.set(0, 0.01, 0); tunnelGroup.add(gridHelper);

  scene.add(tunnelGroup);
}

// --- CREAZIONE DELLO SCIAME (Instanced Mesh) ---
function createButterflies() {
  const geometry = new THREE.PlaneGeometry(0.15, 0.15); 
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  butterflyMesh = new THREE.InstancedMesh(geometry, material, BUTTERFLY_COUNT);
  
  // Centriamo l'area delle farfalle nella stessa posizione del tunnel (davanti a te)
  butterflyMesh.position.set(0, 0, -6.30 / 2);

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    // Coordinate del tunnel (L=25, H=2.85, W=6.30)
    const x = (Math.random() * 25) - 12.5; // X [-12.5, 12.5]
    const y = Math.random() * 2.85;        // Y [0, 2.85]
    const z = (Math.random() * 6.30) - (6.30 / 2); // Z centrato in profondità
    
    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    butterflyMesh.setMatrixAt(i, dummy.matrix);
    butterflyMesh.setColorAt(i, new THREE.Color());
  }
  scene.add(butterflyMesh);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- IL LOOP DI ANIMAZIONE GESTITO DA WEBXR ---
function animate() {
  // Animiamo solo se lo sciame esiste
  if (butterflyMesh) {
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      // Recupera la matrice della singola istanza
      butterflyMesh.getMatrixAt(i, dummy.matrix);
      dummy.position.setFromMatrixPosition(dummy.matrix);
      
      // MOVIMENTO: Da destra (+X) verso sinistra (-X)
      // Scorrono perpendicolarmente davanti a te
      dummy.position.x -= 0.04; 
      dummy.position.y += Math.sin(Date.now() * 0.005 + i) * 0.005; // Fluttuazione
      
      // RICICLO INFINITO DELLE FARFALLE
      if (dummy.position.x < -12.5) {
        dummy.position.x = 12.5;
      }
      
      // Simula battito ali / volo irregolare
      dummy.rotation.y += 0.1;
      dummy.rotation.x += 0.05;
      
      dummy.updateMatrix();
      butterflyMesh.setMatrixAt(i, dummy.matrix);
      
      // CAMBIO COLORE MATEMATICO: Fucsia (X=12.5) -> Arancio (X<=0)
      const color = new THREE.Color();
      let mixRatio = (dummy.position.x + 12.5) / 25; // Normalizza la posizione X in base alla lunghezza (25m)
      color.lerpColors(colorMid, colorStart, mixRatio);
      butterflyMesh.setColorAt(i, color);
    }
    
    // Segnala che i dati delle istanze (posizioni e colori) sono cambiati
    butterflyMesh.instanceMatrix.needsUpdate = true;
    if (butterflyMesh.instanceColor) butterflyMesh.instanceColor.needsUpdate = true;
  }
  
  // Renderizza la scena
  renderer.render(scene, camera);
}

// --- INIZIALIZZAZIONE ---
init();