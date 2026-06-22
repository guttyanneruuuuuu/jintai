// ============================================================
//  レンダリングエンジン：シーン / カメラ / ライト / Bloom / 自動旋回
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0410);
  scene.fog = new THREE.FogExp2(0x12030f, 0.018);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 3, 12);

  // ---- ライティング ----
  scene.add(new THREE.AmbientLight(0x6a86c0, 0.5));

  const key = new THREE.DirectionalLight(0xffe8d0, 1.2);
  key.position.set(6, 10, 8);
  scene.add(key);

  const fill = new THREE.PointLight(0xff5a8a, 2.0, 60);
  fill.position.set(-10, -4, -4);
  scene.add(fill);

  const rim = new THREE.PointLight(0x5a9cff, 1.6, 60);
  rim.position.set(8, 6, -6);
  scene.add(rim);

  // コアを照らす内部光
  const coreLight = new THREE.PointLight(0xffd86b, 2.5, 25);
  coreLight.position.set(0, 0, 0);
  scene.add(coreLight);

  // ---- ポストプロセス（Bloom）----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85,  // strength
    0.55,  // radius
    0.18   // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- カメラ操作（ドラッグ旋回 + ピンチズーム + 自動旋回）----
  const cam = {
    azimuth: 0,
    polar: 0.18,
    distance: 12,
    targetDistance: 12,
    autoRotate: true,
    target: new THREE.Vector3(0, 0, 0),
  };

  let dragging = false;
  let lastX = 0, lastY = 0;
  let pinchStart = 0;

  const onDown = (x, y) => { dragging = true; lastX = x; lastY = y; cam.autoRotate = false; };
  const onMove = (x, y) => {
    if (!dragging) return;
    cam.azimuth -= (x - lastX) * 0.005;
    cam.polar = Math.max(-1.2, Math.min(1.2, cam.polar - (y - lastY) * 0.005));
    lastX = x; lastY = y;
  };
  const onUp = () => { dragging = false; };

  canvas.addEventListener('pointerdown', (e) => onDown(e.clientX, e.clientY));
  window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('pointerup', onUp);

  canvas.addEventListener('wheel', (e) => {
    cam.targetDistance = Math.max(5, Math.min(26, cam.targetDistance + e.deltaY * 0.01));
  }, { passive: true });

  // タッチ pinch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchStart = touchDist(e.touches);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const d = touchDist(e.touches);
      const delta = pinchStart - d;
      cam.targetDistance = Math.max(5, Math.min(26, cam.targetDistance + delta * 0.02));
      pinchStart = d;
    }
  }, { passive: true });

  // ---- 画面揺れ + フラッシュ ----
  let shakeAmount = 0;
  let flashEl = null;

  const engine = {
    renderer, scene, camera, composer, bloom, cam, coreLight,
    shake(amount) { shakeAmount = Math.max(shakeAmount, amount); },
    setFlashElement(el) { flashEl = el; },
    flash(color) {
      if (!flashEl) return;
      const hex = '#' + color.toString(16).padStart(6, '0');
      flashEl.style.background = `radial-gradient(circle at center, ${hex}00 40%, ${hex}55 100%)`;
      flashEl.style.opacity = '1';
      requestAnimationFrame(() => {
        flashEl.style.opacity = '0';
      });
    },
    update(dt) {
      if (cam.autoRotate) cam.azimuth += dt * 0.06;
      cam.distance += (cam.targetDistance - cam.distance) * Math.min(1, dt * 4);

      const r = cam.distance;
      const cx = Math.sin(cam.azimuth) * Math.cos(cam.polar) * r;
      const cy = Math.sin(cam.polar) * r + 1.5;
      const cz = Math.cos(cam.azimuth) * Math.cos(cam.polar) * r;

      // shake
      let sx = 0, sy = 0;
      if (shakeAmount > 0.001) {
        sx = (Math.random() - 0.5) * shakeAmount;
        sy = (Math.random() - 0.5) * shakeAmount;
        shakeAmount *= 0.86;
      }
      camera.position.set(cx + sx, cy + sy, cz);
      camera.lookAt(cam.target);
    },
    render() {
      composer.render();
    },
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    },
  };

  window.addEventListener('resize', () => engine.resize());
  return engine;
}

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}
