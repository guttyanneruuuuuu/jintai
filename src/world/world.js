// ============================================================
//  3D 人体ワールド（体内環境・臓器・血管・浮遊粒子）
//  Three.js procedural geometry で「血管に包まれた体内空間」を構築
// ============================================================
import * as THREE from 'three';
import { ORGANS } from '../config.js';

export function buildWorld(scene) {
  const world = {
    organs: [],
    vessels: new THREE.Group(),
    core: null,
    coreShell: null,
    membrane: null,
    motes: null,
    redCells: [],
    update: () => {},
  };

  // ---- 体内の包膜（巨大な内側球：血管壁のような有機質）----
  const membraneGeo = new THREE.SphereGeometry(34, 64, 48);
  const membraneMat = new THREE.MeshStandardMaterial({
    color: 0x2a0d22,
    emissive: 0x3a0f1e,
    emissiveIntensity: 0.35,
    roughness: 1,
    metalness: 0,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.96,
  });
  // 有機的な凹凸
  const pos = membraneGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const noise =
      Math.sin(n.x * 3.1) * Math.cos(n.y * 2.7) * 1.4 +
      Math.sin(n.z * 4.3 + n.y * 2) * 0.9;
    v.addScaledVector(n, noise);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  membraneGeo.computeVertexNormals();
  const membrane = new THREE.Mesh(membraneGeo, membraneMat);
  scene.add(membrane);
  world.membrane = membrane;

  // ---- 中央コア（プレイヤー = 脳司令の象徴）----
  const core = buildCore();
  scene.add(core.group);
  world.core = core.group;
  world.coreShell = core.shell;

  // ---- 臓器ステージ ----
  for (const def of ORGANS) {
    const organ = buildOrgan(def);
    world.organs.push(organ);
    scene.add(organ.group);
  }

  // ---- 血管ネットワーク（コアから各臓器へ伸びるチューブ）----
  buildVessels(world);
  scene.add(world.vessels);

  // ---- 赤血球の流れ（環境演出）----
  buildRedCellFlow(world, scene);

  // ---- 浮遊微粒子（体液中のダスト）----
  world.motes = buildMotes();
  scene.add(world.motes);

  // ---- 更新関数 ----
  world.update = (dt, t, infection) => {
    core.shell.rotation.y += dt * 0.18;
    core.shell.rotation.x += dt * 0.07;
    core.inner.rotation.y -= dt * 0.4;
    const pulse = 1 + Math.sin(t * 2.2) * 0.05;
    core.shell.scale.setScalar(pulse);
    // 汚染度で膜の色を変える
    const inf = infection / 100;
    membraneMat.emissive.setRGB(0.22 + inf * 0.5, 0.06, 0.12 - inf * 0.05);
    membraneMat.emissiveIntensity = 0.3 + inf * 0.4;

    for (const o of world.organs) o.update(dt, t);

    // 赤血球の流れ
    for (const rc of world.redCells) {
      rc.u = (rc.u + dt * rc.speed) % 1;
      rc._pt.copy(rc.start).lerp(rc.end, rc.u).add(rc.offset);
      // 軽い蛇行
      rc._pt.y += Math.sin(rc.u * 9 + t) * 0.25;
      rc.mesh.position.copy(rc._pt);
      rc.mesh.rotation.x += dt * 2;
      rc.mesh.rotation.z += dt * 1.4;
    }

    world.motes.rotation.y += dt * 0.012;
    world.vessels.children.forEach((m) => {
      if (m.material && m.material.emissiveIntensity !== undefined) {
        m.material.emissiveIntensity = 0.6 + Math.sin(t * 1.5 + m.position.x) * 0.25;
      }
    });
  };

  return world;
}

function buildCore() {
  const group = new THREE.Group();

  // 外殻：半透明の脈動シェル
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.7, 4),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fd0ff,
      emissive: 0x2f5cff,
      emissiveIntensity: 0.6,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.55,
      thickness: 1.2,
      transparent: true,
      opacity: 0.9,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    })
  );
  group.add(shell);

  // 内核：明るいエネルギー体（神経核）
  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 2),
    new THREE.MeshStandardMaterial({
      color: 0xfff6cf,
      emissive: 0xffd86b,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    })
  );
  group.add(inner);

  // 神経のリング（土星の輪のような）
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.03, 12, 120),
    new THREE.MeshBasicMaterial({ color: 0x6fb0ff, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2.2;
  group.add(ring);

  const ring2 = ring.clone();
  ring2.rotation.x = Math.PI / 1.7;
  ring2.rotation.z = Math.PI / 4;
  ring2.scale.setScalar(1.12);
  group.add(ring2);

  // ぼんやりした光のハロー
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x3f89ff,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    })
  );
  group.add(halo);

  return { group, shell, inner };
}

function buildOrgan(def) {
  const group = new THREE.Group();
  group.position.set(...def.pos);

  // 臓器本体：歪ませた球で有機質感
  const geo = new THREE.SphereGeometry(1.5, 40, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const bump =
      Math.sin(n.x * 4) * 0.18 +
      Math.cos(n.y * 5) * 0.14 +
      Math.sin(n.z * 3.5) * 0.12;
    v.addScaledVector(n, bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.color,
    emissiveIntensity: 0.25,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
  });
  const body = new THREE.Mesh(geo, mat);
  group.add(body);

  // 内側のグロー
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 24, 18),
    new THREE.MeshBasicMaterial({
      color: def.accent,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    })
  );
  group.add(glow);

  const baseScale = 0.6 + Math.random() * 0.4;
  group.scale.setScalar(baseScale);

  const phase = Math.random() * Math.PI * 2;
  const update = (dt, t) => {
    body.rotation.y += dt * 0.12;
    const beat = 1 + Math.sin(t * 1.6 + phase) * 0.045;
    group.scale.setScalar(baseScale * beat);
  };

  return { group, body, def, update, baseScale };
}

function buildVessels(world) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff6f8a,
    emissive: 0x5a1326,
    emissiveIntensity: 0.7,
    roughness: 0.4,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });

  for (const organ of world.organs) {
    const start = new THREE.Vector3(0, 0, 0);
    const end = organ.group.position.clone();
    const mid = start.clone().lerp(end, 0.5);
    mid.x += (Math.random() - 0.5) * 3;
    mid.y += (Math.random() - 0.5) * 3;
    mid.z += (Math.random() - 0.5) * 3;
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().lerp(mid, 0.5),
      mid,
      mid.clone().lerp(end, 0.5),
      end,
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.12, 10, false),
      mat.clone()
    );
    tube.position.x = (Math.random() - 0.5) * 0.01;
    world.vessels.add(tube);
    organ.vesselStart = start.clone();
    organ.vesselEnd = end.clone();
  }

  // 装飾的な毛細血管リング
  for (let i = 0; i < 16; i++) {
    const r = 4 + Math.random() * 6;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.02, 6, 90),
      new THREE.MeshBasicMaterial({
        color: 0xff8aa0,
        transparent: true,
        opacity: 0.12,
      })
    );
    ring.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    world.vessels.add(ring);
  }
}

function buildRedCellFlow(world, scene) {
  const geo = new THREE.TorusGeometry(0.13, 0.06, 8, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd83a4a,
    emissive: 0x5a0d18,
    emissiveIntensity: 0.5,
    roughness: 0.6,
  });
  for (const organ of world.organs) {
    if (!organ.vesselStart) continue;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      world.redCells.push({
        mesh,
        start: organ.vesselStart,
        end: organ.vesselEnd,
        u: i / count,
        speed: 0.04 + Math.random() * 0.05,
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6
        ),
        _pt: new THREE.Vector3(),
      });
    }
  }
}

function buildMotes() {
  const count = 1400;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 6 + Math.random() * 24;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffd0d8,
    size: 0.07,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}
