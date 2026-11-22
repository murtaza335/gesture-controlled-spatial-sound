import { CONFIG } from '../config.js';
import { sphericalToCartesian } from '../mapping/handToAudio.js';
import { spectrumToColor } from './color.js';
import { sourceHue } from './sourceColors.js';

const SCALE = 0.9; // metres → scene units
const BARS = 64;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/**
 * Three.js scene, same coordinates as the audio (listener at origin facing −Z).
 * Loaded lazily; resolves to null if WebGL is unavailable.
 */
export async function createScene3d(canvas) {
  const THREE = await import('three');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL unavailable', err);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0c12, 8, 18);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camera.position.set(0, 2.3, 4.8);
  const lookAt = new THREE.Vector3(0, 0.2, -1);
  camera.lookAt(lookAt);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.PointLight(0x9bb8ff, 18, 20);
  key.position.set(2, 4, 3);
  scene.add(key);

  // floor
  const grid = new THREE.GridHelper(14, 28, 0x34406a, 0x1b2238);
  grid.position.y = -1.1;
  grid.material.transparent = true;
  grid.material.opacity = 0.7;
  scene.add(grid);

  // listener head
  const head = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xaab4d0, roughness: 0.5, metalness: 0.1 });
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 24), skin));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0xffc07a }));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -0.3);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.1), new THREE.MeshStandardMaterial({ color: 0x7aa2ff }));
    ear.position.set(sx * 0.27, 0, 0);
    head.add(ear);
  }
  scene.add(head);

  // frequency ring: instanced thin boxes
  const ring = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 1, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    BARS,
  );
  const col = new THREE.Color();
  for (let i = 0; i < BARS; i++) ring.setColorAt(i, col.setHSL((25 + (185 * i) / BARS) / 360, 0.9, 0.58));
  ring.position.y = -1.05; // sits on the floor grid
  scene.add(ring);
  const dummy = new THREE.Object3D();
  const bars = new Float32Array(BARS);
  let freq = null;

  // glow texture
  const gc = document.createElement('canvas');
  gc.width = gc.height = 128;
  const g2 = gc.getContext('2d');
  const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(gc);

  // sources
  const nodes = new Map(); // id → { group, sphere, glow, line, pos, freq }
  function makeNode(s) {
    const color = new THREE.Color().setHSL(sourceHue(s.id) / 360, 0.9, 0.58);
    const group = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 18),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 }),
    );
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    group.add(sphere, glow);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 }));
    scene.add(group, line);
    const p = sphericalToCartesian(s.az, s.el, s.dist);
    group.position.set(p.x * SCALE, p.y * SCALE, p.z * SCALE);
    return { group, sphere, glow, line, lineGeo, scale: 0, freq: null };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    resize,
    render(now, dt, st, analysers, sampleRate) {
      const t = now / 1000;
      camera.position.x = Math.sin(t * 0.12) * 0.35;
      camera.lookAt(lookAt);

      // frequency ring from the master analyser (log-spaced bands)
      const master = analysers.master;
      if (master) {
        if (!freq) freq = new Uint8Array(master.frequencyBinCount);
        master.getByteFrequencyData(freq);
        const binHz = sampleRate / master.fftSize;
        const lo = Math.log(30);
        const hi = Math.log(16000);
        for (let b = 0; b < BARS; b++) {
          const i0 = Math.floor(Math.exp(lo + ((hi - lo) * b) / BARS) / binHz);
          const i1 = Math.max(i0, Math.floor(Math.exp(lo + ((hi - lo) * (b + 1)) / BARS) / binHz));
          let m = 0;
          for (let i = i0; i <= Math.min(i1, freq.length - 1); i++) m = Math.max(m, freq[i]);
          const v = m / 255;
          bars[b] = v > bars[b] ? v : damp(bars[b], v, 8, dt);
        }
      }
      for (let i = 0; i < BARS; i++) {
        const a = (i / BARS) * Math.PI * 2;
        const h = 0.05 + bars[i] * 0.8;
        dummy.position.set(Math.sin(a) * 1.1, h / 2, -Math.cos(a) * 1.1);
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        ring.setMatrixAt(i, dummy.matrix);
      }
      ring.instanceMatrix.needsUpdate = true;

      // sources
      const seen = new Set();
      for (const s of st.sources) {
        seen.add(s.id);
        let n = nodes.get(s.id);
        if (!n) {
          n = makeNode(s);
          nodes.set(s.id, n);
        }
        const p = sphericalToCartesian(s.az, s.el, s.dist);
        const grabbed = st.grabbedSourceId === s.id;
        const k = grabbed ? 30 : 12;
        n.group.position.x = damp(n.group.position.x, p.x * SCALE, k, dt);
        n.group.position.y = damp(n.group.position.y, p.y * SCALE, k, dt);
        n.group.position.z = damp(n.group.position.z, p.z * SCALE, k, dt);

        const an = analysers.perSource.get(s.id);
        let c = { hue: 25, light: 45, energy: 0 };
        if (an) {
          if (!n.freq) n.freq = new Uint8Array(an.frequencyBinCount);
          an.getByteFrequencyData(n.freq);
          c = spectrumToColor(n.freq, sampleRate, an.fftSize);
        }
        n.glow.material.color.setHSL(c.hue / 360, 0.95, Math.min(0.75, c.light / 100));
        const target = (grabbed ? 1.5 : st.focusedSourceId === s.id ? 1.2 : 1) * (1 + Math.min(1, c.energy * 3) * 0.35);
        n.scale = damp(n.scale || 1, target, 14, dt);
        n.sphere.scale.setScalar(n.scale);
        n.glow.scale.setScalar(0.7 + n.scale * 0.9 + c.energy * 2);
        n.glow.material.opacity = 0.5 + Math.min(0.5, c.energy * 2);
        n.sphere.material.emissiveIntensity = grabbed ? 1.8 : 0.7 + c.energy * 2;

        const pos = n.lineGeo.attributes.position;
        pos.setXYZ(1, n.group.position.x, n.group.position.y, n.group.position.z);
        pos.needsUpdate = true;
        n.line.material.opacity = grabbed ? 0.75 : 0.25;
      }
      for (const [id, n] of nodes) {
        if (seen.has(id)) continue;
        scene.remove(n.group, n.line);
        n.lineGeo.dispose();
        nodes.delete(id);
      }

      renderer.render(scene, camera);
    },
  };
}
