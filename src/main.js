import * as THREE from 'three';
import './style.css';

const STORAGE_KEY = 'jintai_guardian_save_v1';
const IDLE_LIMIT = 18;
const DEAD_LIMIT = 0;

const el = {
  healthBar: document.getElementById('healthBar'),
  immunityBar: document.getElementById('immunityBar'),
  energyBar: document.getElementById('energyBar'),
  infectionBar: document.getElementById('infectionBar'),
  healthText: document.getElementById('healthText'),
  immunityText: document.getElementById('immunityText'),
  energyText: document.getElementById('energyText'),
  infectionText: document.getElementById('infectionText'),
  statusChip: document.getElementById('statusChip'),
  fpsChip: document.getElementById('fpsChip'),
  logLine: document.getElementById('logLine'),
  idleText: document.getElementById('idleText'),
  gameOver: document.getElementById('gameOver'),
  finalScore: document.getElementById('finalScore'),
  btnDispatch: document.getElementById('btnDispatch'),
  btnPlatelet: document.getElementById('btnPlatelet'),
  btnNutrition: document.getElementById('btnNutrition'),
  btnRest: document.getElementById('btnRest'),
  btnPulse: document.getElementById('btnPulse'),
  btnRestart: document.getElementById('btnRestart')
};

const state = {
  health: 100,
  immunity: 70,
  energy: 80,
  infection: 5,
  alive: true,
  time: 0,
  lastInputAt: 0,
  lastSavedAt: Date.now(),
  log: '脳司令: 体内ネットワーク起動。脅威監視を開始。',
  pathogens: [],
  immuneCells: [],
  projectiles: []
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080d1c, 0.035);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.8, 8.7);

scene.add(new THREE.AmbientLight(0x88bbff, 0.72));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(4, 8, 5);
scene.add(key);
const rim = new THREE.PointLight(0x8f4dff, 1.5, 50);
rim.position.set(-8, -2, -2);
scene.add(rim);

const starGeo = new THREE.BufferGeometry();
const starCount = 1200;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 90;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 90;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xaed2ff, size: 0.05, transparent: true, opacity: 0.7 })
);
scene.add(stars);

const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.6, 3),
  new THREE.MeshPhysicalMaterial({
    color: 0x8bc7ff,
    emissive: 0x244cff,
    emissiveIntensity: 0.65,
    roughness: 0.12,
    metalness: 0.2,
    transmission: 0.32,
    thickness: 0.7,
    transparent: true,
    opacity: 0.95
  })
);
scene.add(core);

const pulseShell = new THREE.Mesh(
  new THREE.SphereGeometry(2.2, 40, 32),
  new THREE.MeshBasicMaterial({ color: 0x3f89ff, transparent: true, opacity: 0.1, wireframe: true })
);
scene.add(pulseShell);

const vesselMat = new THREE.MeshStandardMaterial({ color: 0x5fa4ff, emissive: 0x172b77, emissiveIntensity: 0.9 });
for (let i = 0; i < 12; i++) {
  const tube = new THREE.Mesh(new THREE.TorusGeometry(2.6 + i * 0.14, 0.015, 8, 100), vesselMat);
  tube.rotation.x = Math.random() * Math.PI;
  tube.rotation.y = Math.random() * Math.PI;
  tube.rotation.z = Math.random() * Math.PI;
  scene.add(tube);
}

function spawnImmuneCell() {
  const cell = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xf5fcff, emissive: 0x8bbaff, emissiveIntensity: 0.7 })
  );
  cell.userData = {
    angle: Math.random() * Math.PI * 2,
    radius: 2.3 + Math.random() * 0.8,
    speed: 0.4 + Math.random() * 0.45,
    yOffset: (Math.random() - 0.5) * 1.4,
    cooldown: 0.2 + Math.random()
  };
  scene.add(cell);
  state.immuneCells.push(cell);
}

function spawnPathogen() {
  const geo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.15, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff4d86, emissive: 0x700b30, roughness: 0.45, metalness: 0.12 });
  const p = new THREE.Mesh(geo, mat);
  const theta = Math.random() * Math.PI * 2;
  const radius = 6 + Math.random() * 3;
  p.position.set(Math.cos(theta) * radius, (Math.random() - 0.5) * 4, Math.sin(theta) * radius);
  p.userData = { speed: 0.24 + Math.random() * 0.5, hp: 1 + Math.random() * 2.5 };
  scene.add(p);
  state.pathogens.push(p);
}

function shoot(cell, target) {
  const shot = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x89e3ff })
  );
  shot.position.copy(cell.position);
  shot.userData = {
    vel: target.position.clone().sub(cell.position).normalize().multiplyScalar(5),
    life: 2
  };
  scene.add(shot);
  state.projectiles.push(shot);
}

function pulseAttack() {
  state.pathogens.forEach((p) => {
    p.userData.hp -= 2.3;
  });
  state.energy = clamp(state.energy - 18, 0, 100);
  state.log = '神経パルス発動。周辺病原体をまとめて弱体化。';
}

function restorePlatelet() {
  state.health = clamp(state.health + 16, 0, 100);
  state.infection = clamp(state.infection - 8, 0, 100);
  state.energy = clamp(state.energy - 6, 0, 100);
  state.log = '血小板修復班が出動。組織損傷を緊急修復。';
}

function onUserInput(actionText = '') {
  state.lastInputAt = state.time;
  if (actionText) state.log = actionText;
}

el.btnDispatch.addEventListener('click', () => {
  if (!state.alive || state.energy < 6) return;
  spawnImmuneCell();
  state.energy = clamp(state.energy - 6, 0, 100);
  onUserInput('白血球を増員。防衛ラインを強化しました。');
});

el.btnPlatelet.addEventListener('click', () => {
  if (!state.alive || state.energy < 6) return;
  restorePlatelet();
  onUserInput();
});

el.btnNutrition.addEventListener('click', () => {
  if (!state.alive) return;
  state.energy = clamp(state.energy + 24, 0, 100);
  state.infection = clamp(state.infection + 2, 0, 100);
  onUserInput('栄養投与。エネルギーは回復したが汚染率が微増。');
});

el.btnRest.addEventListener('click', () => {
  if (!state.alive) return;
  state.immunity = clamp(state.immunity + 20, 0, 100);
  state.energy = clamp(state.energy + 8, 0, 100);
  onUserInput('休息モード。神経負荷を軽減し免疫力を改善。');
});

el.btnPulse.addEventListener('click', () => {
  if (!state.alive || state.energy < 18) return;
  pulseAttack();
  onUserInput();
});

el.btnRestart.addEventListener('click', () => {
  location.reload();
});

document.addEventListener('pointerdown', () => onUserInput());
document.addEventListener('keydown', () => onUserInput());
document.addEventListener('touchstart', () => onUserInput(), { passive: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveState();
  }
});

function saveState() {
  state.lastSavedAt = Date.now();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      health: state.health,
      immunity: state.immunity,
      energy: state.energy,
      infection: state.infection,
      lastSavedAt: state.lastSavedAt
    })
  );
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const awaySec = Math.max(0, (now - (parsed.lastSavedAt || now)) / 1000);
    state.health = parsed.health ?? state.health;
    state.immunity = parsed.immunity ?? state.immunity;
    state.energy = parsed.energy ?? state.energy;
    state.infection = parsed.infection ?? state.infection;

    if (awaySec > 10) {
      const decay = awaySec * 0.09;
      const infectionRise = awaySec * 0.07;
      state.health = clamp(state.health - decay, 0, 100);
      state.infection = clamp(state.infection + infectionRise, 0, 100);
      state.log = `オフライン中 ${Math.floor(awaySec)}秒 経過。体調が悪化しました。`;
    }
  } catch {
    // ignore
  }
}

let spawnTimer = 0;
let fpsFrames = 0;
let fpsTimer = 0;

function updateHud() {
  el.healthBar.value = state.health;
  el.immunityBar.value = state.immunity;
  el.energyBar.value = state.energy;
  el.infectionBar.value = state.infection;
  el.healthText.textContent = Math.round(state.health);
  el.immunityText.textContent = Math.round(state.immunity);
  el.energyText.textContent = Math.round(state.energy);
  el.infectionText.textContent = `${Math.round(state.infection)}%`;
  el.logLine.textContent = state.log;

  const idleSeconds = Math.floor(state.time - state.lastInputAt);
  el.idleText.textContent = `最終操作: ${idleSeconds}秒前`;

  if (!state.alive) {
    el.statusChip.textContent = '状態: 生体反応停止';
    return;
  }

  if (state.health < 35 || state.infection > 75) {
    el.statusChip.textContent = '状態: 危険';
  } else if (idleSeconds > IDLE_LIMIT) {
    el.statusChip.textContent = '状態: 無管理';
  } else {
    el.statusChip.textContent = '状態: 安定';
  }
}

function die() {
  state.alive = false;
  el.gameOver.classList.remove('hidden');
  el.finalScore.textContent = `生存時間: ${Math.floor(state.time)}秒`;
  state.log = '生体機能停止。脳司令の再起動が必要です。';
}

function cleanupDeadEntities() {
  state.pathogens = state.pathogens.filter((p) => {
    if (p.userData.hp <= 0) {
      scene.remove(p);
      state.infection = clamp(state.infection - 0.8, 0, 100);
      state.energy = clamp(state.energy + 0.2, 0, 100);
      return false;
    }
    return true;
  });

  state.projectiles = state.projectiles.filter((s) => {
    if (s.userData.life <= 0) {
      scene.remove(s);
      return false;
    }
    return true;
  });
}

function tick(dt) {
  if (!state.alive) return;

  state.time += dt;
  const idleSeconds = state.time - state.lastInputAt;

  spawnTimer += dt;
  const spawnRate = Math.max(0.45, 2.2 - state.infection * 0.02);
  if (spawnTimer >= spawnRate) {
    spawnPathogen();
    spawnTimer = 0;
  }

  const passiveInfection = 0.35 + (100 - state.immunity) * 0.005;
  state.infection = clamp(state.infection + passiveInfection * dt, 0, 100);

  if (idleSeconds > IDLE_LIMIT) {
    const over = idleSeconds - IDLE_LIMIT;
    state.health = clamp(state.health - (0.5 + over * 0.12) * dt, 0, 100);
    state.immunity = clamp(state.immunity - 0.25 * dt, 0, 100);
    if (Math.random() < 0.03) {
      state.log = '無管理状態が継続。炎症が拡大しています。';
    }
  } else {
    state.health = clamp(state.health + 0.03 * dt, 0, 100);
  }

  state.health = clamp(state.health - state.infection * 0.012 * dt, 0, 100);
  state.energy = clamp(state.energy - 0.9 * dt, 0, 100);
  if (state.energy <= 0) {
    state.health = clamp(state.health - 0.28 * dt, 0, 100);
  }

  core.rotation.y += dt * 0.38;
  core.rotation.x += dt * 0.14;
  pulseShell.rotation.y -= dt * 0.2;
  pulseShell.rotation.x += dt * 0.15;
  pulseShell.scale.setScalar(1 + Math.sin(state.time * 2.4) * 0.06);

  for (const cell of state.immuneCells) {
    const d = cell.userData;
    d.angle += d.speed * dt;
    cell.position.set(
      Math.cos(d.angle) * d.radius,
      Math.sin(d.angle * 1.3) * 0.65 + d.yOffset,
      Math.sin(d.angle) * d.radius
    );

    d.cooldown -= dt;
    if (d.cooldown <= 0 && state.pathogens.length) {
      let target = null;
      let dist = Infinity;
      for (const p of state.pathogens) {
        const nd = cell.position.distanceToSquared(p.position);
        if (nd < dist) {
          dist = nd;
          target = p;
        }
      }
      if (target && dist < 20) {
        shoot(cell, target);
        d.cooldown = 0.35 + Math.random() * 0.7;
      }
    }
  }

  for (const p of state.pathogens) {
    const dir = core.position.clone().sub(p.position).normalize();
    p.position.addScaledVector(dir, p.userData.speed * dt);
    p.rotation.x += dt;
    p.rotation.y += dt * 1.4;

    if (p.position.length() < 1.65) {
      state.health = clamp(state.health - 3.5, 0, 100);
      state.infection = clamp(state.infection + 4.2, 0, 100);
      p.userData.hp = 0;
      state.log = '病原体がコアに侵入。健康度が急落しました。';
    }
  }

  for (const s of state.projectiles) {
    s.position.addScaledVector(s.userData.vel, dt);
    s.userData.life -= dt;

    for (const p of state.pathogens) {
      if (s.position.distanceToSquared(p.position) < 0.1) {
        p.userData.hp -= 1.1 + state.immunity * 0.01;
        s.userData.life = 0;
        break;
      }
    }
  }

  cleanupDeadEntities();

  if (state.health <= DEAD_LIMIT) {
    die();
  }
}

function bootstrap() {
  loadState();
  for (let i = 0; i < 6; i++) spawnImmuneCell();
}

let prev = performance.now();
function animate(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;

  tick(dt);
  updateHud();

  stars.rotation.y += dt * 0.02;
  renderer.render(scene, camera);

  fpsFrames += 1;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    el.fpsChip.textContent = `FPS: ${Math.round(fpsFrames / fpsTimer)}`;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  if (state.alive && Math.random() < 0.03) saveState();

  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
});

bootstrap();
requestAnimationFrame(animate);
