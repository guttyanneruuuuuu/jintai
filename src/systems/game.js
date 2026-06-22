// ============================================================
//  ゲームシステム：スポーン / 戦闘 / 放置ティック / スコア
// ============================================================
import * as THREE from 'three';
import { clamp } from '../state.js';
import { createCell, createPathogen, createBurst } from '../entities/factory.js';
import { CELL_TYPES, PATHOGEN_TYPES, ACTIONS, IDLE, WAVE } from '../config.js';

const TMP = new THREE.Vector3();

export class Game {
  constructor(scene, world, state, fx) {
    this.scene = scene;
    this.world = world;
    this.state = state;
    this.fx = fx || {}; // {flash, shake, sfx}
    this.cells = [];
    this.pathogens = [];
    this.projectiles = [];
    this.bursts = [];
    this.healOrbs = [];
    this.spawnTimer = 0;
    this.waveTimer = WAVE.baseInterval;
    this.pathogenKeys = Object.keys(PATHOGEN_TYPES);
  }

  // ---- 初期細胞配置 ----
  bootstrap() {
    for (let i = 0; i < 5; i++) this.addCell('neutrophil', true);
    this.addCell('macrophage', true);
    this.markDiscoveredCell('neutrophil');
    this.markDiscoveredCell('macrophage');
  }

  markDiscoveredCell(id) {
    this.state.discovered.cells[id] = true;
  }
  markDiscoveredPathogen(id) {
    this.state.discovered.pathogens[id] = true;
  }

  // ---- 細胞追加 ----
  addCell(typeId, free = false) {
    const def = CELL_TYPES[typeId];
    if (!free) {
      if (this.state.energy < def.cost) {
        this.state.log = 'エネルギー不足。栄養を投与してください。';
        return false;
      }
      this.state.energy = clamp(this.state.energy - def.cost, 0, 100);
    }
    const cell = createCell(typeId);
    this.scene.add(cell);
    this.cells.push(cell);
    this.markDiscoveredCell(typeId);
    if (typeId === 'platelet') {
      // 血小板は即修復オーブを出す
      cell.userData.repairTimer = 0;
    }
    return true;
  }

  // ---- 病原体スポーン ----
  spawnPathogen(typeId) {
    if (!typeId) {
      // ウェーブが進むほど強敵が出やすい
      const r = Math.random();
      const w = this.state.wave;
      if (w >= 4 && r < 0.22) typeId = 'fungus';
      else if (w >= 3 && r < 0.45) typeId = 'toxin';
      else if (r < 0.6) typeId = 'virus';
      else typeId = 'bacteria';
    }
    const p = createPathogen(typeId);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 12 + Math.random() * 6;
    p.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi) * 0.6,
      radius * Math.sin(phi) * Math.sin(theta)
    );
    // ウェーブで体力を強化
    const hpScale = 1 + (this.state.wave - 1) * 0.18;
    p.userData.hp *= hpScale;
    p.userData.maxHp *= hpScale;
    this.scene.add(p);
    this.pathogens.push(p);
    this.markDiscoveredPathogen(typeId);
  }

  // ---- 脳司令アクション ----
  feed() {
    const a = ACTIONS.feed;
    const s = this.state;
    s.energy = clamp(s.energy + 24, 0, 100);
    s.hunger = clamp(s.hunger + a.hunger, 0, 100);
    s.mood = clamp(s.mood + a.mood, 0, 100);
    s.infection = clamp(s.infection + a.infection, 0, 100);
    s.log = '栄養を投与。エネルギーと機嫌が回復しました。';
    this.fx.flash?.(0x7dff9a);
  }

  rest() {
    const a = ACTIONS.rest;
    const s = this.state;
    s.immunity = clamp(s.immunity + a.immunity, 0, 100);
    s.mood = clamp(s.mood + a.mood, 0, 100);
    s.energy = clamp(s.energy + a.energy, 0, 100);
    s.log = '休息モード。免疫力と機嫌が改善しました。';
    this.fx.flash?.(0x8ab4ff);
  }

  clean() {
    const a = ACTIONS.clean;
    const s = this.state;
    s.hygiene = clamp(s.hygiene + a.clean, 0, 100);
    s.infection = clamp(s.infection + a.infection, 0, 100);
    s.energy = clamp(s.energy + a.energy, 0, 100);
    s.log = '体内を浄化。汚染率が下がりました。';
    this.fx.flash?.(0x6fe3ff);
  }

  pulse() {
    const s = this.state;
    if (s.energy < 22) {
      s.log = 'エネルギー不足で神経パルスを撃てません。';
      return;
    }
    s.energy = clamp(s.energy - 22, 0, 100);
    let killed = 0;
    for (const p of this.pathogens) {
      p.userData.hp -= 4 + s.immunity * 0.03;
      if (p.userData.hp <= 0) killed++;
    }
    s.log = '神経パルス発動！ 全病原体に衝撃波。';
    this.fx.flash?.(0xfff3a0);
    this.fx.shake?.(0.6);
  }

  repair() {
    const s = this.state;
    if (s.energy < 6) {
      s.log = 'エネルギー不足で修復できません。';
      return;
    }
    s.energy = clamp(s.energy - 6, 0, 100);
    s.health = clamp(s.health + 14, 0, 100);
    s.infection = clamp(s.infection - 6, 0, 100);
    s.log = '血小板修復班が出動。組織損傷を修復しました。';
    this.spawnHealOrb(this.world.core.position);
    this.fx.flash?.(0xff9bbb);
  }

  spawnHealOrb(pos) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x8effb0, transparent: true, opacity: 0.9 })
    );
    orb.position.copy(pos).add(
      new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)
    );
    orb.userData = { life: 1.2 };
    this.scene.add(orb);
    this.healOrbs.push(orb);
  }

  // ---- 発射 ----
  shoot(cell, target) {
    const def = cell.userData.def;
    const shot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: def.glow })
    );
    shot.position.copy(cell.position);
    const dir = TMP.copy(target.position).sub(cell.position).normalize();
    shot.userData = {
      vel: dir.clone().multiplyScalar(8),
      life: 1.6,
      dmg: def.dmg + this.state.immunity * 0.015,
    };
    // トレイル用に光のスケール
    shot.scale.setScalar(1 + def.dmg * 0.2);
    this.scene.add(shot);
    this.projectiles.push(shot);
  }

  killPathogen(p, idx) {
    const burst = createBurst(p.position, p.userData.def.color);
    this.scene.add(burst);
    this.bursts.push(burst);
    this.scene.remove(p);
    this.pathogens.splice(idx, 1);

    const s = this.state;
    s.kills++;
    s.score += p.userData.def.score;
    s.coins += Math.ceil(p.userData.def.score / 4);
    s.infection = clamp(s.infection - 0.6, 0, 100);
  }

  // ============================================================
  //  メイン更新
  // ============================================================
  update(dt, t) {
    const s = this.state;
    if (!s.alive) {
      // 死後もエフェクトだけ更新
      this.updateBursts(dt);
      return;
    }

    s.time += dt;
    s.totalTime += dt;
    const idle = s.time - s.lastInputAt;

    this._statTick(dt, idle);
    this._spawnTick(dt);
    this._cellTick(dt, t);
    this._pathogenTick(dt, t);
    this._projectileTick(dt);
    this.updateBursts(dt);
    this._healOrbTick(dt);

    if (s.health <= 0) {
      s.health = 0;
      s.alive = false;
      s.log = '生体機能停止。脳司令の再起動が必要です。';
    }
  }

  // ステータスの自然変動（たまごっち中核）
  _statTick(dt, idle) {
    const s = this.state;

    // 空腹は時間で上昇
    s.hunger = clamp(s.hunger + 0.6 * dt, 0, 100);
    // 衛生はゆっくり低下
    s.hygiene = clamp(s.hygiene - 0.25 * dt, 0, 100);
    // エネルギー消費
    s.energy = clamp(s.energy - 0.7 * dt, 0, 100);

    // 汚染：免疫と衛生が低いほど進む
    const infRate = 0.25 + (100 - s.immunity) * 0.004 + (100 - s.hygiene) * 0.004;
    s.infection = clamp(s.infection + infRate * dt, 0, 100);

    // 機嫌：空腹・汚染が高いと下がる
    const moodDrift = -(s.hunger * 0.004) - (s.infection * 0.004) + 0.02;
    s.mood = clamp(s.mood + moodDrift * dt * 4, 0, 100);

    // 免疫：機嫌が良いと回復、汚染が高いと低下
    const immDrift = (s.mood - 50) * 0.002 - s.infection * 0.003;
    s.immunity = clamp(s.immunity + immDrift * dt * 3, 0, 100);

    // ---- ヘルスへの影響（複合） ----
    let healthDelta = 0;
    // 空腹ダメージ
    if (s.hunger > 70) healthDelta -= (s.hunger - 70) * 0.02;
    // 汚染ダメージ
    healthDelta -= s.infection * 0.014;
    // エネルギー切れダメージ
    if (s.energy <= 0) healthDelta -= 0.3;
    // 良好なら微回復
    if (s.infection < 25 && s.hunger < 50 && s.energy > 20) healthDelta += 0.06;

    // ---- 放置（無管理）ペナルティ ----
    if (idle > IDLE.warnSeconds) {
      const over = idle - IDLE.warnSeconds;
      healthDelta -= IDLE.neglectDecayBase + over * IDLE.neglectDecayRamp * 0.05;
      s.immunity = clamp(s.immunity - 0.15 * dt, 0, 100);
      if (Math.random() < 0.015) {
        s.log = '⚠ 無管理状態が続いています。体内環境が崩壊しつつあります！';
      }
    }

    s.health = clamp(s.health + healthDelta * dt, 0, 100);
  }

  _spawnTick(dt) {
    const s = this.state;
    this.spawnTimer += dt;
    this.waveTimer -= dt;

    // ウェーブ進行
    if (this.waveTimer <= 0) {
      s.wave++;
      this.waveTimer = WAVE.baseInterval;
      s.log = `WAVE ${s.wave} 開始。脅威レベルが上昇しました。`;
      this.fx.flash?.(0xff6b8a);
      // ウェーブ開始で一斉スポーン
      const burst = 2 + Math.floor(s.wave / 2);
      for (let i = 0; i < burst; i++) this.spawnPathogen();
    }

    const gap = Math.max(0.5, WAVE.spawnGapBase - s.wave * 0.08 - s.infection * 0.01);
    if (this.spawnTimer >= gap) {
      this.spawnTimer = 0;
      // 汚染が高いほど多めにスポーン
      this.spawnPathogen();
      if (s.infection > 60 && Math.random() < 0.4) this.spawnPathogen();
    }
  }

  _cellTick(dt, t) {
    for (const cell of this.cells) {
      const d = cell.userData;
      // pop-in アニメ
      if (cell.scale.x < 1) {
        cell.scale.setScalar(Math.min(1, cell.scale.x + dt * 4));
      }

      // 軌道運動
      d.angle += d.speed * dt;
      cell.position.set(
        Math.cos(d.angle) * d.radius,
        Math.sin(d.angle * 1.3) * 0.8 + d.yOffset,
        Math.sin(d.angle) * d.radius
      );
      // 顔をカメラ方向（=おおよそ+Z）に
      d.face.lookAt(d.face.getWorldPosition(TMP).setZ(50));

      if (d.type === 'platelet') {
        d.repairTimer = (d.repairTimer || 0) - dt;
        if (d.repairTimer <= 0) {
          d.repairTimer = 6;
          this.state.health = clamp(this.state.health + 0.6, 0, 100);
        }
        continue;
      }

      // 攻撃
      d.cooldown -= dt;
      if (d.cooldown <= 0 && this.pathogens.length) {
        let target = null;
        let best = Infinity;
        for (const p of this.pathogens) {
          const nd = cell.position.distanceToSquared(p.position);
          if (nd < best) {
            best = nd;
            target = p;
          }
        }
        if (target && best < d.def.range * d.def.range) {
          this.shoot(cell, target);
          d.cooldown = d.def.fireRate;
        }
      }
    }
  }

  _pathogenTick(dt, t) {
    const s = this.state;
    for (let i = this.pathogens.length - 1; i >= 0; i--) {
      const p = this.pathogens[i];
      const d = p.userData;
      if (p.scale.x < 1) p.scale.setScalar(Math.min(1, p.scale.x + dt * 3));

      // コアへ向かう（少し蛇行）
      d.wobble += dt * 2;
      TMP.copy(this.world.core.position).sub(p.position);
      const dist = TMP.length();
      TMP.normalize();
      TMP.x += Math.sin(d.wobble) * 0.3;
      TMP.y += Math.cos(d.wobble * 0.7) * 0.2;
      p.position.addScaledVector(TMP, d.speed * dt);
      d.body.rotation.x += dt;
      d.body.rotation.y += dt * 1.3;
      d.face.lookAt(d.face.getWorldPosition(new THREE.Vector3()).setZ(50));

      // HP表示用：ダメージで赤く
      const hpRatio = d.hp / d.maxHp;
      d.body.material.emissiveIntensity = 0.4 + (1 - hpRatio) * 0.8;

      // コア到達
      if (dist < 2.0) {
        s.health = clamp(s.health - d.def.dmg, 0, 100);
        s.infection = clamp(s.infection + d.def.dmg * 0.8, 0, 100);
        if (d.type === 'toxin') s.energy = clamp(s.energy - 6, 0, 100);
        s.log = `${d.def.name}がコアに侵入！ 健康度が低下。`;
        this.fx.flash?.(0xff2a4a);
        this.fx.shake?.(0.4);
        this.killPathogen(p, i);
        continue;
      }

      if (d.hp <= 0) {
        this.killPathogen(p, i);
      }
    }
  }

  _projectileTick(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const s = this.projectiles[i];
      s.position.addScaledVector(s.userData.vel, dt);
      s.userData.life -= dt;

      let hit = false;
      for (let j = this.pathogens.length - 1; j >= 0; j--) {
        const p = this.pathogens[j];
        if (s.position.distanceToSquared(p.position) < 0.18) {
          p.userData.hp -= s.userData.dmg;
          hit = true;
          if (p.userData.hp <= 0) this.killPathogen(p, j);
          break;
        }
      }
      if (hit || s.userData.life <= 0) {
        this.scene.remove(s);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.userData.life -= dt;
      const pos = b.geometry.attributes.position;
      for (let k = 0; k < b.userData.vel.length; k++) {
        const vel = b.userData.vel[k];
        pos.setXYZ(
          k,
          pos.getX(k) + vel.x * dt,
          pos.getY(k) + vel.y * dt,
          pos.getZ(k) + vel.z * dt
        );
      }
      pos.needsUpdate = true;
      b.material.opacity = Math.max(0, b.userData.life / b.userData.maxLife);
      if (b.userData.life <= 0) {
        this.scene.remove(b);
        this.bursts.splice(i, 1);
      }
    }
  }

  _healOrbTick(dt) {
    for (let i = this.healOrbs.length - 1; i >= 0; i--) {
      const o = this.healOrbs[i];
      o.userData.life -= dt;
      o.position.lerp(this.world.core.position, dt * 3);
      o.material.opacity = Math.max(0, o.userData.life / 1.2);
      o.scale.setScalar(0.5 + o.userData.life);
      if (o.userData.life <= 0) {
        this.scene.remove(o);
        this.healOrbs.splice(i, 1);
      }
    }
  }
}
