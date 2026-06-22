// ============================================================
//  HUD / UI 管理：DOM生成・更新・図鑑・モーダル
// ============================================================
import { CELL_TYPES, PATHOGEN_TYPES, IDLE } from '../config.js';
import { formatDuration } from '../state.js';

export function buildHUD(root) {
  root.innerHTML = `
    <div id="flash" class="flash"></div>

    <header class="hud topbar">
      <div class="title">
        <span class="logo">⬢</span>
        <div>
          <h1>Cell Guardian</h1>
          <small>Neuro Command — 人体防衛シミュレーター</small>
        </div>
      </div>
      <div class="chips">
        <span class="chip wave" id="waveChip">WAVE 1</span>
        <span class="chip" id="statusChip">安定</span>
        <span class="chip" id="coinChip">🪙 0</span>
        <span class="chip ghost" id="fpsChip">-- fps</span>
      </div>
    </header>

    <!-- 左：バイタル -->
    <section class="hud panel vitals">
      <h2>生体バイタル</h2>
      <div class="bars">
        ${bar('health', '健康度', 'hp')}
        ${bar('infection', '汚染率', 'inf')}
        ${bar('immunity', '免疫力', 'imm')}
        ${bar('energy', 'エネルギー', 'en')}
        ${bar('hunger', '空腹', 'hun')}
        ${bar('hygiene', '衛生', 'hyg')}
        ${bar('mood', '機嫌', 'mood')}
      </div>
      <div class="idle-meter">
        <span id="idleText">最終操作: 0秒前</span>
        <div class="idle-track"><div id="idleFill" class="idle-fill"></div></div>
      </div>
      <p id="logLine" class="log">脳司令: 体内ネットワーク起動。</p>
    </section>

    <!-- 右：細胞派遣 -->
    <section class="hud panel commands">
      <h2>細胞を派遣</h2>
      <div class="cell-grid">
        ${cellBtn('neutrophil')}
        ${cellBtn('killerT')}
        ${cellBtn('macrophage')}
        ${cellBtn('platelet')}
      </div>
    </section>

    <!-- 下：脳司令アクション -->
    <nav class="hud actionbar">
      <button class="act" data-act="feed"><span>🍔</span>栄養</button>
      <button class="act" data-act="rest"><span>💤</span>休息</button>
      <button class="act" data-act="clean"><span>🧼</span>浄化</button>
      <button class="act" data-act="repair"><span>🩹</span>修復</button>
      <button class="act danger" data-act="pulse"><span>⚡</span>神経パルス</button>
      <button class="act ghost" data-act="codex"><span>📖</span>図鑑</button>
    </nav>

    <!-- 図鑑モーダル -->
    <div id="codex" class="overlay hidden">
      <div class="modal">
        <button class="close" data-close>✕</button>
        <h2>体内図鑑</h2>
        <div class="codex-tabs">
          <button class="tab active" data-tab="cells">細胞ユニット</button>
          <button class="tab" data-tab="pathogens">病原体</button>
        </div>
        <div id="codexBody" class="codex-body"></div>
      </div>
    </div>

    <!-- オフライン復帰 -->
    <div id="offline" class="overlay hidden">
      <div class="modal small">
        <h2>おかえりなさい</h2>
        <p id="offlineText"></p>
        <button class="primary" data-close-offline>体内に戻る</button>
      </div>
    </div>

    <!-- ゲームオーバー -->
    <div id="gameOver" class="overlay hidden">
      <div class="modal small">
        <h2 class="dead">生体反応 停止</h2>
        <p>人体の防衛網が崩壊しました。</p>
        <p id="finalScore" class="final"></p>
        <button class="primary" id="btnRestart">脳を再起動する</button>
      </div>
    </div>

    <!-- 操作ヒント -->
    <div class="hint" id="hint">ドラッグで視点回転 / ピンチでズーム</div>
  `;

  const el = {};
  ['health', 'infection', 'immunity', 'energy', 'hunger', 'hygiene', 'mood'].forEach((k) => {
    el[`${k}Fill`] = document.getElementById(`${k}Fill`);
    el[`${k}Val`] = document.getElementById(`${k}Val`);
  });
  el.waveChip = document.getElementById('waveChip');
  el.statusChip = document.getElementById('statusChip');
  el.coinChip = document.getElementById('coinChip');
  el.fpsChip = document.getElementById('fpsChip');
  el.idleText = document.getElementById('idleText');
  el.idleFill = document.getElementById('idleFill');
  el.logLine = document.getElementById('logLine');
  el.codex = document.getElementById('codex');
  el.codexBody = document.getElementById('codexBody');
  el.offline = document.getElementById('offline');
  el.offlineText = document.getElementById('offlineText');
  el.gameOver = document.getElementById('gameOver');
  el.finalScore = document.getElementById('finalScore');
  el.btnRestart = document.getElementById('btnRestart');
  el.flash = document.getElementById('flash');
  el.hint = document.getElementById('hint');
  return el;
}

function bar(id, label, cls) {
  return `
    <div class="bar-row">
      <label>${label}</label>
      <div class="bar ${cls}"><div id="${id}Fill" class="fill"></div></div>
      <span id="${id}Val" class="val">0</span>
    </div>`;
}

function cellBtn(id) {
  const c = CELL_TYPES[id];
  const hex = '#' + c.glow.toString(16).padStart(6, '0');
  return `
    <button class="cell-btn" data-cell="${id}" style="--glow:${hex}">
      <span class="cell-dot"></span>
      <span class="cell-name">${c.name.split('（')[0]}</span>
      <span class="cell-role">${c.role}</span>
      <span class="cell-cost">⚡${c.cost}</span>
    </button>`;
}

// ----- HUD 更新 -----
const STAT_ORDER = ['health', 'infection', 'immunity', 'energy', 'hunger', 'hygiene', 'mood'];
export function updateHUD(el, state) {
  for (const k of STAT_ORDER) {
    const v = Math.round(state[k]);
    if (el[`${k}Fill`]) el[`${k}Fill`].style.width = `${v}%`;
    if (el[`${k}Val`]) el[`${k}Val`].textContent = k === 'infection' ? `${v}%` : v;
  }
  el.waveChip.textContent = `WAVE ${state.wave}`;
  el.coinChip.textContent = `🪙 ${state.coins}`;
  el.logLine.textContent = state.log;

  const idle = Math.floor(state.time - state.lastInputAt);
  el.idleText.textContent = `最終操作: ${idle}秒前`;
  const idleRatio = Math.min(1, idle / IDLE.warnSeconds);
  el.idleFill.style.width = `${idleRatio * 100}%`;
  el.idleFill.classList.toggle('warn', idle > IDLE.warnSeconds);

  let status = '安定';
  el.statusChip.className = 'chip';
  if (!state.alive) {
    status = '停止';
    el.statusChip.classList.add('dead');
  } else if (state.health < 30 || state.infection > 75) {
    status = '危険';
    el.statusChip.classList.add('danger');
  } else if (idle > IDLE.warnSeconds) {
    status = '無管理';
    el.statusChip.classList.add('warn');
  }
  el.statusChip.textContent = status;
}

// ----- 図鑑 -----
export function renderCodex(el, state, tab = 'cells') {
  const isCells = tab === 'cells';
  const data = isCells ? CELL_TYPES : PATHOGEN_TYPES;
  const found = isCells ? state.discovered.cells : state.discovered.pathogens;
  el.codexBody.innerHTML = Object.values(data)
    .map((d) => {
      const known = found[d.id];
      const hex = '#' + (d.glow ?? d.color).toString(16).padStart(6, '0');
      if (!known) {
        return `<div class="codex-card locked"><div class="ico">?</div><div><b>？？？</b><p>未発見。ゲームを進めて遭遇しよう。</p></div></div>`;
      }
      const stats = isCells
        ? `攻撃力 ${d.dmg} / 射程 ${d.range} / コスト⚡${d.cost}`
        : `体力 ${d.hp} / 速度 ${d.speed} / スコア ${d.score}`;
      return `
        <div class="codex-card" style="--c:${hex}">
          <div class="ico" style="background:${hex}"></div>
          <div>
            <b>${d.name}</b> <span class="role">${d.role || ''}</span>
            <p>${d.desc}</p>
            <small>${stats}</small>
          </div>
        </div>`;
    })
    .join('');
}

export function showOffline(el, report) {
  if (!report) return;
  const dur = formatDuration(report.awaySec);
  el.offlineText.innerHTML = report.died
    ? `${dur}の放置で人体は限界を迎えていました…<br>健康度 -${report.healthLost}`
    : `${dur}ぶりの帰還です。<br>放置中に健康度が <b>${report.healthLost}</b> 低下しました。<br>すぐにケアしてあげましょう！`;
  el.offline.classList.remove('hidden');
}

export function showGameOver(el, state) {
  el.gameOver.classList.remove('hidden');
  el.finalScore.innerHTML = `生存 ${formatDuration(state.totalTime)} / スコア ${state.score} / 撃破 ${state.kills}`;
}
