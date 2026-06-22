// ============================================================
//  Cell Guardian: Neuro Command
//  ゲームバランス・定数・データ定義
// ============================================================

export const SAVE_KEY = 'jintai_guardian_save_v2';

// 放置（たまごっち）パラメータ
export const IDLE = {
  // この秒数を超えて操作が無いと「無管理」状態へ
  warnSeconds: 20,
  // 無管理時の追加ヘルス減衰係数
  neglectDecayBase: 0.55,
  neglectDecayRamp: 0.10,
  // オフライン中の毎秒ヘルス減衰
  offlineHealthDecayPerSec: 0.08,
  offlineInfectionRisePerSec: 0.06,
  offlineHungerRisePerSec: 0.10,
  // オフライン経過がこの秒数を超えると計算開始
  offlineMinSeconds: 8,
  // 自動戦闘（オフライン中も免疫が病原体を倒す）でのオフライン汚染抑制
  offlineImmuneSuppress: 0.5,
};

// 各ステータスの初期値
export const INITIAL_STATS = {
  health: 100,
  immunity: 65,
  energy: 80,
  infection: 4,
  hunger: 20,      // 空腹（たまごっち要素）。上がるとヘルス低下
  hygiene: 90,     // 衛生。下がると汚染が進む
  mood: 80,        // 機嫌。低いと免疫が落ちる
};

// 臓器ステージ定義（人体マップ）
export const ORGANS = [
  {
    id: 'heart',
    name: '心臓',
    desc: '全身に血液を送るポンプ。血流が速く敵の侵攻も速い。',
    color: 0xff5a6e,
    accent: 0xff97a6,
    pos: [0, 0.4, 0],
    threatBias: 1.15,
  },
  {
    id: 'lung',
    name: '肺',
    desc: '酸素を取り込む器官。外気から病原体が侵入しやすい。',
    color: 0xff8fb0,
    accent: 0xffd0de,
    pos: [-6.5, 1.2, -2],
    threatBias: 1.25,
  },
  {
    id: 'brain',
    name: '脳',
    desc: '司令塔。ここが汚染されると全機能が低下する最重要拠点。',
    color: 0xc9a6ff,
    accent: 0xe6d4ff,
    pos: [6.0, 3.0, -1.5],
    threatBias: 0.9,
  },
  {
    id: 'stomach',
    name: '胃',
    desc: '強酸性の環境。一部の病原体には有効だが細胞も消耗する。',
    color: 0xffc36e,
    accent: 0xffe0a8,
    pos: [-5.0, -2.6, 1.0],
    threatBias: 1.0,
  },
  {
    id: 'liver',
    name: '肝臓',
    desc: '解毒を担う巨大な化学工場。汚染を緩やかに浄化してくれる。',
    color: 0xc98a5a,
    accent: 0xe8b487,
    pos: [4.5, -2.2, 1.5],
    threatBias: 0.85,
  },
];

// 細胞ユニット定義（図鑑兼用）
export const CELL_TYPES = {
  neutrophil: {
    id: 'neutrophil',
    name: '好中球（白血球）',
    role: '攻撃',
    desc: '体内防衛の主力。病原体を発見すると素早く接近し攻撃する。',
    color: 0xf3f9ff,
    glow: 0x9ccbff,
    radius: 0.22,
    dmg: 1.2,
    fireRate: 0.55,
    range: 4.2,
    cost: 8,
  },
  killerT: {
    id: 'killerT',
    name: 'キラーT細胞',
    role: '殲滅',
    desc: '感染細胞・強敵を狙う精鋼の暗殺者。高火力だが燃費が悪い。',
    color: 0xfff0c0,
    glow: 0xffcf5a,
    radius: 0.26,
    dmg: 3.0,
    fireRate: 0.8,
    range: 5.2,
    cost: 18,
  },
  macrophage: {
    id: 'macrophage',
    name: 'マクロファージ',
    role: '防御',
    desc: '大食い細胞。敵を丸ごと貪食し、コア近辺を守る盾となる。',
    color: 0xbfe0c0,
    glow: 0x6fe39a,
    radius: 0.34,
    dmg: 2.0,
    fireRate: 1.2,
    range: 3.0,
    cost: 14,
  },
  platelet: {
    id: 'platelet',
    name: '血小板',
    role: '修復',
    desc: '幼くも働き者。損傷した組織を塞ぎ、健康度を回復させる。',
    color: 0xffd0dc,
    glow: 0xff9bbb,
    radius: 0.18,
    dmg: 0,
    fireRate: 0,
    range: 0,
    cost: 6,
  },
};

// 病原体定義（図鑑兼用）
export const PATHOGEN_TYPES = {
  bacteria: {
    id: 'bacteria',
    name: '細菌',
    desc: '分裂して増殖する基本的な敵。数で押し寄せてくる。',
    color: 0xff4d86,
    glow: 0x9c0030,
    hp: 3,
    speed: 0.55,
    dmg: 3.2,
    score: 10,
  },
  virus: {
    id: 'virus',
    name: 'ウイルス',
    desc: '高速で動き回るトゲ状の脅威。細胞をすり抜けコアを狙う。',
    color: 0xff7a3c,
    glow: 0x7c2a00,
    hp: 2,
    speed: 0.95,
    dmg: 2.4,
    score: 14,
  },
  fungus: {
    id: 'fungus',
    name: '真菌',
    desc: '鈍いが頑丈。倒すまで時間がかかり、汚染を撒き散らす。',
    color: 0x9bff5a,
    glow: 0x2f6e00,
    hp: 7,
    speed: 0.32,
    dmg: 4.5,
    score: 22,
  },
  toxin: {
    id: 'toxin',
    name: '毒素塊',
    desc: '危険な紫の塊。エネルギーを吸い取りながら接近する。',
    color: 0xb15aff,
    glow: 0x3c0070,
    hp: 5,
    speed: 0.45,
    dmg: 3.8,
    score: 18,
  },
};

// 脳司令アクション（コスト・効果）
export const ACTIONS = {
  feed: { energy: -2, hunger: -35, mood: +6, infection: +1.5 },
  rest: { immunity: +22, mood: +12, energy: +6 },
  clean: { hygiene: +30, infection: -10, energy: -4 },
  pulse: { energy: -22 },     // 全体ダメージは別計算
};

// ウェーブ進行
export const WAVE = {
  baseInterval: 22,    // 次のウェーブまでの基準秒
  spawnGapBase: 2.0,   // 1体スポーンのベース間隔
};
