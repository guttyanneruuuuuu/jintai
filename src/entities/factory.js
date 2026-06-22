// ============================================================
//  細胞ユニット / 病原体 の 3D モデルファクトリ
//  「はたらく細胞」風に、顔つきのデフォルメキャラとして生成
// ============================================================
import * as THREE from 'three';
import { CELL_TYPES, PATHOGEN_TYPES } from '../config.js';

// --- 顔テクスチャをCanvasで生成（白血球の目など）---
const faceCache = {};
function makeFaceTexture(kind) {
  if (faceCache[kind]) return faceCache[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);

  // 透明背景、中央に目
  const eyeY = 150;
  const drawEye = (x, angry) => {
    g.fillStyle = '#10141f';
    g.beginPath();
    g.ellipse(x, eyeY, 16, angry ? 14 : 20, 0, 0, Math.PI * 2);
    g.fill();
    // ハイライト
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x - 5, eyeY - 6, 5, 0, Math.PI * 2);
    g.fill();
  };

  if (kind === 'cell') {
    drawEye(98, false);
    drawEye(158, false);
  } else if (kind === 'enemy') {
    // 怒り目
    drawEye(98, true);
    drawEye(158, true);
    g.strokeStyle = '#10141f';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(80, 124); g.lineTo(112, 138);
    g.moveTo(176, 124); g.lineTo(144, 138);
    g.stroke();
    // 口
    g.beginPath();
    g.arc(128, 196, 16, Math.PI, 0, true);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  faceCache[kind] = tex;
  return tex;
}

// ---------------- 免疫細胞 ----------------
const cellGeoCache = {};
export function createCell(typeId) {
  const def = CELL_TYPES[typeId];
  const group = new THREE.Group();

  // 本体
  const key = `cell_${def.radius}`;
  if (!cellGeoCache[key]) {
    cellGeoCache[key] = new THREE.SphereGeometry(def.radius, 20, 16);
  }
  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.glow,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.97,
  });
  const body = new THREE.Mesh(cellGeoCache[key], bodyMat);
  group.add(body);

  // 顔（板）
  const faceMat = new THREE.MeshBasicMaterial({
    map: makeFaceTexture('cell'),
    transparent: true,
    depthWrite: false,
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(def.radius * 1.9, def.radius * 1.9),
    faceMat
  );
  face.position.z = def.radius * 0.96;
  group.add(face);

  // タイプ別の追加パーツ
  if (typeId === 'macrophage') {
    // 大きめ + 触手っぽい突起
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bump = new THREE.Mesh(
        new THREE.SphereGeometry(def.radius * 0.4, 8, 8),
        bodyMat
      );
      bump.position.set(Math.cos(a) * def.radius, Math.sin(a) * def.radius, 0);
      group.add(bump);
    }
  } else if (typeId === 'killerT') {
    // ナイフ風の鋭いコーン
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(def.radius * 0.35, def.radius * 1.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfff2c0,
        emissive: 0xffb73a,
        emissiveIntensity: 1.0,
        metalness: 0.6,
        roughness: 0.2,
      })
    );
    blade.position.set(def.radius * 0.9, 0, 0);
    blade.rotation.z = -Math.PI / 2;
    group.add(blade);
  } else if (typeId === 'platelet') {
    // 帽子（小さい工事帽）
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(def.radius * 0.9, def.radius * 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0x8a6a00, emissiveIntensity: 0.4 })
    );
    hat.position.y = def.radius * 0.95;
    group.add(hat);
  }

  group.userData = {
    type: typeId,
    def,
    angle: Math.random() * Math.PI * 2,
    radius: 2.4 + Math.random() * 1.6,
    yOffset: (Math.random() - 0.5) * 2.4,
    speed: 0.35 + Math.random() * 0.4,
    cooldown: Math.random() * def.fireRate,
    face,
    body,
    spawnScale: 0,
  };
  group.scale.setScalar(0.01); // pop-in
  return group;
}

// ---------------- 病原体 ----------------
export function createPathogen(typeId) {
  const def = PATHOGEN_TYPES[typeId];
  const group = new THREE.Group();
  const baseR = 0.26 + Math.random() * 0.12;

  let geo;
  if (typeId === 'bacteria') {
    geo = new THREE.CapsuleGeometry(baseR * 0.7, baseR, 6, 12);
  } else if (typeId === 'virus') {
    geo = new THREE.IcosahedronGeometry(baseR, 1);
  } else if (typeId === 'fungus') {
    geo = new THREE.DodecahedronGeometry(baseR * 1.2, 0);
  } else {
    geo = new THREE.OctahedronGeometry(baseR * 1.1, 1);
  }

  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.glow,
    emissiveIntensity: 0.6,
    roughness: 0.45,
    metalness: 0.15,
  });
  const body = new THREE.Mesh(geo, mat);
  group.add(body);

  // 顔
  const faceMat = new THREE.MeshBasicMaterial({
    map: makeFaceTexture('enemy'),
    transparent: true,
    depthWrite: false,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(baseR * 2, baseR * 2), faceMat);
  face.position.z = baseR * 1.05;
  group.add(face);

  // ウイルスのトゲ
  if (typeId === 'virus') {
    const spikeMat = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.glow,
      emissiveIntensity: 0.5,
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(baseR * 0.12, baseR * 0.7, 5),
        spikeMat
      );
      spike.position.set(Math.cos(a) * baseR, Math.sin(a) * baseR, 0);
      spike.rotation.z = a - Math.PI / 2;
      group.add(spike);
    }
  }

  group.userData = {
    type: typeId,
    def,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * (0.85 + Math.random() * 0.3),
    body,
    face,
    wobble: Math.random() * Math.PI * 2,
  };
  group.scale.setScalar(0.01);
  return group;
}

// 死亡エフェクト（破裂パーティクル）
export function createBurst(position, color) {
  const count = 14;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    arr[i * 3] = position.x;
    arr[i * 3 + 1] = position.y;
    arr[i * 3 + 2] = position.z;
    vel.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      )
    );
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.14,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { vel, life: 0.7, maxLife: 0.7 };
  return pts;
}
