import * as THREE from 'three';

// --- 1. BLOCCO SCORRIMENTO MOBILE ---
document.addEventListener('touchmove', function(event) {
  event.preventDefault();
}, { passive: false });

// --- 2. VARIABILI GLOBALI DELLO SCIAME ---
const BUTTERFLY_COUNT = 500; 
const dummy = new THREE.Object3D(); 
const colorStart = new THREE.Color('#ce0058'); 
const colorMid = new THREE.Color('#fe5000');   
let butterflyMesh;

// --- 3. CREAZIONE DEL TUNNEL FISICO ---
function createTunnel(scene) {
  const tunnelMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x444444, wireframe: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide
  });
  const L = 25, H = 2.85, W = 6.30; 

  const tunnelGroup = new THREE.Group();
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

// --- 4. CREAZIONE DELLE FARFALLE ---
function createButterflies(scene) {
  const geometry = new THREE.PlaneGeometry(0.15, 0.15); 
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  butterflyMesh = new THREE.InstancedMesh(geometry, material, BUTTERFLY_COUNT);
  
  butterflyMesh.position.set(0, 0, -6.30 / 2); 

  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const x = (Math.random() * 25) - 12.5; 
    const y = Math.random() * 2.85;        
    const z = (Math.random() * 6.30) - (6.30 / 2);    
    
    dummy.position.set(x, y, z);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    butterflyMesh.setMatrixAt(i, dummy.matrix);
    butterflyMesh.setColorAt(i, new THREE.Color());
  }
  scene.add(butterflyMesh);
}

// --- 5. TRADUTTORE CUSTOM (CORRETTO PER EVITARE IL FREEZE) ---
const tunnelPipelineModule = () => {
  let scene, camera, renderer;

  return {
    name: 'tunnel-pipeline-custom',
    
    onStart: () => {
      const canvas = document.getElementById('webgl-canvas');
      
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      
      // IL FIX: Chiediamo a 8th Wall il contesto grafico esatto che sta usando la fotocamera
      const glContext = XR8.GlRenderer.context(); 

      renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        context: glContext, // Forziamo lo stesso identico canale della GPU
        alpha: true, 
        antialias: true 
      });
      
      renderer.autoClear = false; 
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(0, 2.85, 0);
      scene.add(directionalLight);
      
      createTunnel(scene);
      createButterflies(scene);
    },
    
    onUpdate: (args) => {
      // Aggiorna la telecamera con lo SLAM reale
      if (args.processCpuResult && args.processCpuResult.reality) {
        const { position, rotation } = args.processCpuResult.reality;
        camera.position.set(position.x, position.y, position.z);
        camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }

      // Animazione farfalle
      if (butterflyMesh) {
        for (let i = 0; i < BUTTERFLY_COUNT; i++) {
          butterflyMesh.getMatrixAt(i, dummy.matrix);
          dummy.position.setFromMatrixPosition(dummy.matrix);
          
          dummy.position.x -= 0.04; 
          dummy.position.y += Math.sin(Date.now() * 0.005 + i) * 0.005; 
          
          if (dummy.position.x < -12.5) dummy.position.x = 12.5;
          
          dummy.rotation.y += 0.1;
          dummy.rotation.x += 0.05;
          
          dummy.updateMatrix();
          butterflyMesh.setMatrixAt(i, dummy.matrix);
          
          const color = new THREE.Color();
          let mixRatio = (dummy.position.x + 12.5) / 25; 
          color.lerpColors(colorMid, colorStart, mixRatio);
          butterflyMesh.setColorAt(i, color);
        }
        butterflyMesh.instanceMatrix.needsUpdate = true;
        if (butterflyMesh.instanceColor) butterflyMesh.instanceColor.needsUpdate = true;
      }
      
      // Sblocchiamo il rendering concorrente ad ogni frame
      renderer.state.reset();
      renderer.render(scene, camera);
    }
  }
};

// --- 6. INIZIALIZZAZIONE ---
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');

const onxrloaded = () => {
  startBtn.style.display = 'block';
  startBtn.innerText = 'ENTRA NEL TUNNEL AR';

  startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';

    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.XrController.pipelineModule(),
      tunnelPipelineModule(),
    ]);

    XR8.run({ canvas: document.getElementById('webgl-canvas') });
  });
};

if (window.XR8) {
  onxrloaded();
} else {
  window.addEventListener('xrloaded', onxrloaded);
}