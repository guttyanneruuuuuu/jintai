// ============================================================
//  Cell Guardian: Neuro Command — エントリポイント
//  「はたらく細胞」風 人体防衛3D + 放置(たまごっち)ゲーム
// ============================================================
import './style.css';
import { createState, loadState, saveState, resetSave } from './state.js';
import { createEngine } from './engine.js';
import { buildWorld } from './world/world.js';
import { Game } from './systems/game.js';
import {
  buildHUD, updateHUD, renderCodex, showOffline, showGameOver,
} from './ui/hud.js';
import { CELL_TYPES } from './config.js';

const app = document.getElementById('app');
const canvas = document.getElementById('scene');

// ---- 状態 + セーブ復元（放置オフライン計算）----
const state = createState();
loadState(state);

// ---- エンジン / ワールド ----
const engine = createEngine(canvas);
const world = buildWorld(engine.scene);

// ---- HUD ----
const el = buildHUD(app);
engine.setFlashElement(el.flash);

// ---- ゲームシステム ----
const fx = {
  flash: (c) => engine.flash(c),
  shake: (a) => engine.shake(a),
};
const game = new Game(engine.scene, world, state, fx);
game.bootstrap();

// ---- 入力：操作で放置タイマーリセット ----
function markInput() {
  state.lastInputAt = state.time;
}
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, markInput, { passive: true })
);

// ---- 細胞派遣ボタン ----
app.querySelectorAll('[data-cell]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!state.alive) return;
    markInput();
    const id = btn.dataset.cell;
    if (id === 'platelet') {
      // 血小板はコスト払って修復オーブも
      if (game.addCell('platelet')) game.repair();
    } else {
      game.addCell(id);
    }
    flashButton(btn);
  });
});

// ---- 脳司令アクション ----
app.querySelectorAll('[data-act]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const act = btn.dataset.act;
    if (act === 'codex') {
      openCodex();
      return;
    }
    if (!state.alive) return;
    markInput();
    if (act === 'feed') game.feed();
    else if (act === 'rest') game.rest();
    else if (act === 'clean') game.clean();
    else if (act === 'repair') game.repair();
    else if (act === 'pulse') game.pulse();
    flashButton(btn);
  });
});

function flashButton(btn) {
  btn.classList.add('tapped');
  setTimeout(() => btn.classList.remove('tapped'), 180);
}

// ---- 図鑑 ----
let codexTab = 'cells';
function openCodex() {
  renderCodex(el, state, codexTab);
  el.codex.classList.remove('hidden');
}
app.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => el.codex.classList.add('hidden'))
);
app.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    app.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    codexTab = t.dataset.tab;
    renderCodex(el, state, codexTab);
  })
);

// ---- オフライン復帰 ----
if (state.offlineReport) {
  showOffline(el, state.offlineReport);
}
app.querySelector('[data-close-offline]')?.addEventListener('click', () => {
  el.offline.classList.add('hidden');
  if (!state.alive) showGameOver(el, state);
});

// ---- ゲームオーバー / リスタート ----
let gameOverShown = false;
el.btnRestart.addEventListener('click', () => {
  resetSave();
  location.reload();
});

// 起動時に既に死亡（放置死）していたら
if (!state.alive && !state.offlineReport) {
  showGameOver(el, state);
  gameOverShown = true;
}

// 操作ヒントを数秒で薄く
setTimeout(() => el.hint?.classList.add('fade'), 5000);

// ---- セーブ ----
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveState(state);
});
window.addEventListener('beforeunload', () => saveState(state));
let saveTimer = 0;

// ---- メインループ ----
let prev = performance.now();
let fpsFrames = 0;
let fpsTimer = 0;

function loop(now) {
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;
  const t = now / 1000;

  game.update(dt, t);
  world.update(dt, t, state.infection);
  engine.update(dt);

  // コア光を健康度で変化
  engine.coreLight.intensity = 1.5 + (state.health / 100) * 1.5;
  engine.coreLight.color.setHSL(
    0.08 + (state.health / 100) * 0.25,
    0.9,
    0.55
  );

  engine.render();
  updateHUD(el, state);

  if (!state.alive && !gameOverShown) {
    gameOverShown = true;
    saveState(state);
    setTimeout(() => showGameOver(el, state), 800);
  }

  // FPS
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    el.fpsChip.textContent = `${Math.round(fpsFrames / fpsTimer)} fps`;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  // 定期セーブ
  saveTimer += dt;
  if (saveTimer > 5 && state.alive) {
    saveTimer = 0;
    saveState(state);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
