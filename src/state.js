// ============================================================
//  ゲーム状態 + セーブ/ロード（放置オフライン計算込み）
// ============================================================
import { SAVE_KEY, INITIAL_STATS, IDLE } from './config.js';

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function createState() {
  return {
    ...structuredClone(INITIAL_STATS),
    alive: true,
    time: 0,            // ゲーム内経過秒（セッション）
    totalTime: 0,       // 累計生存秒（セーブ込み）
    lastInputAt: 0,
    lastSavedAt: Date.now(),
    wave: 1,
    score: 0,
    coins: 30,
    kills: 0,
    log: '脳司令: 体内ネットワーク起動。脅威監視を開始します。',
    discovered: { cells: {}, pathogens: {} },
    offlineReport: null, // 復帰時に表示するレポート
  };
}

export function saveState(state) {
  state.lastSavedAt = Date.now();
  const payload = {
    health: state.health,
    immunity: state.immunity,
    energy: state.energy,
    infection: state.infection,
    hunger: state.hunger,
    hygiene: state.hygiene,
    mood: state.mood,
    alive: state.alive,
    totalTime: state.totalTime,
    wave: state.wave,
    score: state.score,
    coins: state.coins,
    kills: state.kills,
    discovered: state.discovered,
    lastSavedAt: state.lastSavedAt,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (_) {
    /* storage full / blocked */
  }
}

// 放置のキモ：オフライン中の劣化を計算
export function loadState(state) {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (_) {
    return;
  }
  if (!raw) return;

  let p;
  try {
    p = JSON.parse(raw);
  } catch (_) {
    return;
  }

  state.health = p.health ?? state.health;
  state.immunity = p.immunity ?? state.immunity;
  state.energy = p.energy ?? state.energy;
  state.infection = p.infection ?? state.infection;
  state.hunger = p.hunger ?? state.hunger;
  state.hygiene = p.hygiene ?? state.hygiene;
  state.mood = p.mood ?? state.mood;
  state.totalTime = p.totalTime ?? 0;
  state.wave = p.wave ?? 1;
  state.score = p.score ?? 0;
  state.coins = p.coins ?? state.coins;
  state.kills = p.kills ?? 0;
  state.discovered = p.discovered ?? { cells: {}, pathogens: {} };
  state.alive = p.alive ?? true;

  if (state.alive === false) {
    // 死亡状態で離脱→セーブそのまま（ゲームオーバー画面表示）
    return;
  }

  const now = Date.now();
  const awaySec = Math.max(0, (now - (p.lastSavedAt || now)) / 1000);
  if (awaySec < IDLE.offlineMinSeconds) return;

  // オフライン劣化（放置で死ぬ）
  // 免疫が高いほど劣化を抑える
  const immuneFactor = 1 - (state.immunity / 100) * IDLE.offlineImmuneSuppress;
  const healthLoss = awaySec * IDLE.offlineHealthDecayPerSec * immuneFactor;
  const infectionRise = awaySec * IDLE.offlineInfectionRisePerSec * immuneFactor;
  const hungerRise = awaySec * IDLE.offlineHungerRisePerSec;

  const beforeHealth = state.health;
  state.health = clamp(state.health - healthLoss, 0, 100);
  state.infection = clamp(state.infection + infectionRise, 0, 100);
  state.hunger = clamp(state.hunger + hungerRise, 0, 100);
  state.hygiene = clamp(state.hygiene - awaySec * 0.05, 0, 100);
  state.mood = clamp(state.mood - awaySec * 0.04, 0, 100);

  const died = state.health <= 0;
  if (died) state.alive = false;

  state.offlineReport = {
    awaySec: Math.floor(awaySec),
    healthLost: Math.round(beforeHealth - state.health),
    died,
  };

  state.log = died
    ? '放置が続き、生体機能が停止していました…'
    : `${formatDuration(awaySec)}ぶりの帰還。体内の状態が悪化しています。`;
}

export function formatDuration(sec) {
  sec = Math.floor(sec);
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}分${sec % 60}秒`;
  const h = Math.floor(m / 60);
  return `${h}時間${m % 60}分`;
}

export function resetSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (_) { /* noop */ }
}
