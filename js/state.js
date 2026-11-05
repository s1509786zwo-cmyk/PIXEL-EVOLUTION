/* ===========================================================
   オリキャラファイターズ / セーブ・進行・成長ロジック
   =========================================================== */
import {
  VERSION, MAX_LEVEL_BASE, RARITIES, RARITY, RARITY_ORDER, STAT_KEYS,
  SKILLS, SKILL, JOB, JOBS, EQUIPMENT, EQUIP_BY_ID, ITEM, ITEMS, ENEMIES, ENEMY,
  RANKS, QUESTS, ACHIEVEMENTS, TITLES, TITLE, EXCHANGE, STYLES, SLOTS,
  AWAKENING_NAMES, collectedSkills, CHAR_RARITIES, CHAR_RARITY, CHAR_RARITY_ORDER,
  charRankIndex, EVOLUTION_RULES, EVOLUTION_BY_FROM, RATE_TOTAL,
  SKILL_COUNT, LEARNABLE_SKILLS, ULTIMATE_IDS, JOB_ULTIMATE, GOD_ULTIMATE_ID,
  SPECIAL_ULTIMATE, specialNameKey, SPECIAL_NAME_LABEL, GOD_JOB_ID, GOD_SKILL_IDS,
  GOD_EQUIPMENT_IDS, GOD_EQUIPMENT, ULTIMATE_GAUGE_MAX,
  toCoreStats, LEGACY_TO_CORE, LEGACY_STAT_KEYS,
  TUTORIAL_STEPS, TUTORIAL_STEP_COUNT, TUTORIAL_ENEMY,
} from './data.js?v=2';
import { MATERIAL_ITEMS, MATERIAL_BY_ID, MAT_RANKS, MAT_RANK_INFO, RANK_REQUIREMENTS, materialUpgradeTarget } from './materials.js?v=2';
import {
  currentBanner, bannerRates, pickupDefIds, normalDefIds, allDefIds,
  isPickup, isHidden, PICKUP_SHARE,
} from './gacha.js?v=2';

/* ---------- ユーティリティ ---------- */
export const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
const clone = o => JSON.parse(JSON.stringify(o));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = n => Math.round(n).toLocaleString('ja-JP');
export const nowDate = () => new Date().toISOString().slice(0, 10);
export const rand = arr => arr[Math.floor(Math.random() * arr.length)];
export const xpForLevel = lv => Math.round(70 + lv * lv * 16 + lv * 22);
export const jobXpForLevel = lv => Math.round(30 + lv * 24);
export const levelCap = c => MAX_LEVEL_BASE + (c.rebirth || 0) * 10;

/* ---------- セーブ（IndexedDB / localStorage フォールバック） ---------- */
const DB_NAME = 'original_character_fighters';
const STORE = 'saves';
const LS_KEY = 'ocf_save_v3';
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(e => { dbPromise = null; throw e; });
  return dbPromise;
}

export async function loadState() {
  try {
    const db = await openDB();
    const data = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get('main');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (data && data.state) return migrate(data.state);
  } catch (e) { /* 下のフォールバック */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { /* no save */ }
  return null;
}

let saveTimer = null;
let pendingState = null;
export function saveState(state, immediate = false) {
  pendingState = state;
  if (!state.settings.autosave && !immediate) return Promise.resolve();
  clearTimeout(saveTimer);
  const run = async () => {
    const snapshot = clone(state);
    snapshot.savedAt = new Date().toISOString();
    try { localStorage.setItem('ocf_has_save', '1'); } catch (e) {}
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ state: snapshot }, 'main');
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); } catch (e2) {
        console.warn('セーブ容量不足', e2);
      }
    }
  };
  if (immediate) { clearTimeout(saveTimer); return run(); }
  return new Promise(res => { saveTimer = setTimeout(() => run().then(res), 300); });
}

export async function eraseSave() {
  try {
    const db = await openDB();
    await new Promise(res => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('main');
      tx.oncomplete = res; tx.onerror = res;
    });
  } catch (e) {}
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem('ocf_has_save');
}

export function exportSave(state) {
  const blob = new Blob([JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 0)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `オリキャラファイターズ_セーブ_${nowDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export function importSave(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.characters)) throw new Error('セーブデータの形式が正しくありません');
  return migrate(data);
}

function normalizePity(p) {
  const src = p || {};
  const legacy = src.count || 0;
  return {
    legendary: typeof src.legendary === 'number' ? src.legendary : legacy,
    mythic: typeof src.mythic === 'number' ? src.mythic : legacy,
    total: src.total || 0,
    history: Array.isArray(src.history) ? src.history.slice(-60) : [],
  };
}

function migrate(s) {
  const d = newState();
  const merged = { ...d, ...s };
  merged.settings = { ...d.settings, ...(s.settings || {}) };
  merged.inventory = { ...d.inventory, ...(s.inventory || {}) };
  merged.stats = { ...d.stats, ...(s.stats || {}) };
  merged.catalog = { ...d.catalog, ...(s.catalog || {}) };
  merged.pity = { weapon: normalizePity(s.pity?.weapon), armor: normalizePity(s.pity?.armor) };
  merged.catalog.materials = s.catalog?.materials || [];
  merged.stats.evolutions = s.stats?.evolutions || 0;
  merged.stats.equipEvolutions = s.stats?.equipEvolutions || 0;
  merged.draftSave = s.draftSave || null;
  delete merged.pendingLevelUp;
  merged.dungeon = { ...d.dungeon, ...(s.dungeon || {}) };
  merged.quests = s.quests || {};
  merged.achievements = s.achievements || {};
  merged.characters = (s.characters || []).map(c => ({
    ...blankCharacter(), ...c,
    alloc: { ...emptyStats(), ...(c.alloc || {}) },
    jobLevels: c.jobLevels || {}, jobExp: c.jobExp || {},
    skills: c.skills || [], equippedSkills: c.equippedSkills || [],
    equipment: { weapon:null,armor:null,accessory:null,ornament:null, ...(c.equipment || {}) },
    spriteSettings: { ...defaultPixelSettings(), ...(c.spriteSettings || {}) },
    imageSettings: { ...defaultImageSettings(), ...(c.imageSettings || {}) },
    rarity: c.rarity || 'R',
    transparentData: c.transparentData || '',
    skillMastery: c.skillMastery || {},
    record: { wins:0,losses:0,streak:0,bestStreak:0,damage:0, ...(c.record || {}) },
  }));
  merged.inventory.equipment = (merged.inventory.equipment || []).map(eq => ({ rank: eq.rank || 'R', ...eq }));
  merged.version = VERSION;
  merged.home = { ...d.home, ...(s.home || {}) };
  merged.story = { ...d.story, ...(s.story || {}), seen:s.story?.seen || [], cleared:s.story?.cleared || [] };
  merged.tutorial = normalizeTutorial(s.tutorial, merged);
  merged.settings = { ...d.settings, ...(s.settings || {}) };
  merged.settings.autoSpeed = clamp(Number(merged.settings.autoSpeed) || 1, 1, 3);
  merged.settings.autoUltimate = merged.settings.autoUltimate !== false;
  merged.settings.autoOn = !!merged.settings.autoOn;
  merged.characters = merged.characters.map(c => normalizeCharacter(c, merged));
  if (merged.lastDaily !== nowDate()) resetDailyQuests(merged);
  return merged;
}
function foldLegacyStats(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of LEGACY_STAT_KEYS) {
    const v = Number(obj[k]);
    if (!v) { delete obj[k]; continue; }
    const to = LEGACY_TO_CORE[k] || 'atk';
    obj[to] = (Number(obj[to]) || 0) + Math.round(v * 0.5);
    delete obj[k];
  }
}
/** 旧セーブに新しい進行データを補う（名前ギミックの判定は 1 回だけ） */
function normalizeCharacter(c, state) {
  // 旧セーブの 8 ステータスを 4 ステータスへ 1 回だけ換算（二重加算を防ぐ）
  if (c.statVersion !== 2) {
    foldLegacyStats(c.alloc);
    foldLegacyStats(c.evolutionBonus);
    c.statVersion = 2;
  }
  const eb = c.evolutionBonus || {};
  c.evolutionBonus = { ...Object.fromEntries(STAT_KEYS.map(k => [k, 0])), ...eb,
    effects: { crit:0, critDamage:0, ultimatePower:0, ...(eb.effects || {}) } };
  c.equipmentBonus = c.equipmentBonus || null;
  c.jobChangeHistory = Array.isArray(c.jobChangeHistory) ? c.jobChangeHistory : [];
  c.ultimateSkills = Array.isArray(c.ultimateSkills) ? c.ultimateSkills : [];
  if (!c.specialChecked) {
    // 旧セーブ移行時だけ現在名で 1 回判定。以後の改名では再発動しない。
    c.specialKey = specialNameKey(c.name) || null;
    c.specialChecked = true;
  }
  if (c.specialKey === undefined) c.specialKey = null;
  c.godUnlocked = !!c.godUnlocked || !!c.specialKey;
  c.specialUltimateId = c.specialUltimateId || (c.specialKey ? SPECIAL_ULTIMATE[c.specialKey] : null);
  // 既に進化済みのキャラにも、習得条件を満たした奥義を 1 回だけ付与
  const has = id => c.skills.some(k => k.id === id);
  if (c.specialKey && charRankIndex(c.rarity) >= 1 && c.specialUltimateId && !has(c.specialUltimateId)) {
    learnSkillDirect(c, state, c.specialUltimateId, true);
  }
  if (charRankIndex(c.rarity) >= 4) {
    const uidv = c.jobId === GOD_JOB_ID ? GOD_ULTIMATE_ID : JOB_ULTIMATE[c.jobId];
    if (uidv && !has(uidv)) learnSkillDirect(c, state, uidv, true);
  }
  for (const k of c.skills) if (ULTIMATE_IDS.has(k.id) && !c.ultimateSkills.includes(k.id)) c.ultimateSkills.push(k.id);
  syncEquipmentSnapshot(state, c);
  return c;
}
export { normalizeCharacter };

export function hasSaveFlag() {
  try { return localStorage.getItem('ocf_has_save') === '1'; } catch (e) { return false; }
}

/* ---------- 初期データ ---------- */
const emptyStats = () => Object.fromEntries(STAT_KEYS.map(k => [k, 0]));

/* 画像の表示設定（元画像は一切加工せず、表示時に CSS で適用する） */
export function defaultImageSettings() {
  return {
    scale: 1.00,          // 拡大率
    offsetX: 0, offsetY: 0, // 表示位置（%）
    brightness: 100,      // 明るさ %
    contrast: 100,        // コントラスト %
    saturate: 100,        // 彩度 %
    hue: 0,               // 色相 deg
    temperature: 0,       // 色温度 -100(寒)〜+100(暖)
    flip: false,          // 左右反転
    transparent: false,   // 背景透過
    battleScale: 1.00,    // 戦闘画面での表示サイズ
    fit: 'full',          // full / face（全身・顔アップ）
  };
}
export function normalizeImageSettings(x) { return { ...defaultImageSettings(), ...(x || {}) }; }
/** 旧セーブ互換のため残すエイリアス */
export const defaultPixelSettings = defaultImageSettings;

function blankCharacter() {
  return {
    id: '', name: '', createdAt: '', original: '', sprite: '', spriteSettings: defaultPixelSettings(),
    imageSettings: defaultImageSettings(), transparentData: '', rarity: 'R',
    level: 1, exp: 0, statPoints: 3, alloc: emptyStats(),
    hp: 0, mp: 0, hpMaxCache: 0, mpMaxCache: 0,
    jobId: 'warrior', jobLevels: {}, jobExp: {},
    skills: [], equippedSkills: [], skillMastery: {},
    awakening: 0, evolution: 0, rebirth: 0,
    equipment: { weapon:null, armor:null, accessory:null, ornament:null },
    // ---- 追加システム（すべてセーブ対象）----
    evolutionBonus: null,           // ランク進化で得た永続ボーナス（装備とは別管理）
    equipmentBonus: null,           // 装備由来の上昇分のスナップショット
    specialKey: null,               // 作成時に確定した特殊ギミック名（後から変えない）
    specialChecked: false,          // 旧セーブ移行で 1 回だけ判定した印
    godUnlocked: false,             // 特殊役職「神」の解放状況
    specialUltimateId: null,        // 習得した特殊奥義
    jobChangeHistory: [],           // ランクアップ／転生時の役職変更履歴
    ultimateSkills: [],             // 習得済み奥義（重複防止）
    styleId: 'balanced', titleId: 't_none', aura: 'none', frame: 'gold',
    record: { wins:0, losses:0, streak:0, bestStreak:0, damage:0 },
  };
}

export function newState() {
  return {
    version: VERSION,
    createdAt: new Date().toISOString(), savedAt: null,
    characters: [], activeId: null,
    coins: 1200, bp: 0, rankPoints: 0,
    winStreak: 0, bestStreak: 0,
    wins: 0, losses: 0,
    settings: { sfx: true, bgm: false, animSpeed: 1, autosave: true,
      autoOn: false, autoSpeed: 1, autoUltimate: true },
    home: { started:false, lastVisit:null, lastMenu:null },
    story: { chapter:1, seen:[], cleared:[] },
    tutorial: defaultTutorial(),
    inventory: { items: { potion_s:3, ether_s:2, antidote:1, mat_ore:2, evo_stone_R:3, weapon_ore_R:2 }, equipment: [] },
    pity: { weapon: normalizePity(), armor: normalizePity() },
    catalog: { equipment: [], skills: [], jobs: [], enemies: [], titles: ['t_none'], materials: ['evo_stone_R','weapon_ore_R'] },
    draftSave: null,
    achievements: {},
    titles: ['t_none'],
    quests: {},
    questsDate: nowDate(),
    trainingQuests: {},
    dungeon: { floor:1, best:0, active:false, hard:false, claimed:[] },
    rankClaimed: [],
    exchangePurchased: [],
    stats: { battles:0, wins:0, losses:0, pulls:0, trainings:0, awakenings:0, rebirths:0,
      bossKills:0, hiddenKills:0, skillLearned:0, coinsEarned:0, damageDealt:0, maxDamage:0,
      floors:0, syntheses:0, questsClaimed:0, gachaLegendary:0, evolutions:0, equipEvolutions:0 },
    log: [],
    lastDaily: nowDate(),
  };
}

/* ---------- キャラクター作成 ---------- */
export function createCharacter(state, opts) {
  const job = JOB[opts.jobId] || JOB.warrior;
  const style = STYLES.find(s => s.id === opts.styleId) || STYLES[0];
  const c = blankCharacter();
  c.id = uid(); c.name = (opts.name || '名無し').slice(0, 16); c.createdAt = new Date().toISOString();
  c.original = opts.original || '';
  c.sprite = opts.sprite || opts.original || '';   // ドット絵変換せず元画像をそのまま使用
  c.transparentData = opts.transparentData || '';
  c.spriteSettings = { ...defaultPixelSettings(), ...(opts.spriteSettings || {}) };
  c.imageSettings = normalizeImageSettings(opts.imageSettings);
  c.rarity = 'R';
  c.jobId = job.id; c.styleId = style.id;
  c.jobLevels = { [job.id]: 1 }; c.jobExp = { [job.id]: 0 };
  c.frame = 'gold';
  // 特殊ギミック：判定は作成時の名前だけで 1 回。後から改名しても増加しない。
  c.specialChecked = true;
  c.specialKey = specialNameKey(c.name);
  c.godUnlocked = !!c.specialKey;
  c.specialUltimateId = c.specialKey ? SPECIAL_ULTIMATE[c.specialKey] : null;
  if (c.specialKey) logEvent(state, `「${c.name}」に特殊ギミックが発動！特殊役職「神」への道と専用奥義が解放された。`, 'create');
  // 初期装備：選んだ武器系統のノーマル品
  const weaponType = opts.weaponType || job.weapons[0];
  const weaponDef = EQUIPMENT.find(e => e.slot === 'weapon' && e.type === weaponType && e.rarity === 'N')
    || EQUIPMENT.find(e => e.slot === 'weapon' && e.rarity === 'N');
  const inst = makeEquipmentInstance(weaponDef.id);
  state.inventory.equipment.push(inst);
  addCatalog(state.catalog.equipment, inst.defId);
  c.equipment.weapon = inst.uid;
  // 初期技：職業の最初の2つ + 基本攻撃
  ['sk_none_slash', 'sk_charge', ...job.skills.slice(0, 2)].forEach(id => learnSkillDirect(c, state, id, true));
  syncEquipmentSnapshot(state, c);
  const st = computeStats(c, state);
  c.hp = st.hp; c.mp = st.mp; c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  state.characters.push(c);
  state.activeId = c.id;
  addCatalog(state.catalog.jobs, job.id);
  addCatalog(state.catalog.materials, 'evo_stone_R');
  logEvent(state, `「${c.name}」が${job.name}として誕生した（レアリティ R）。`, 'create');
  checkAchievements(state);
  return c;
}

export function activeChar(state) {
  return state.characters.find(c => c.id === state.activeId) || state.characters[0] || null;
}

/* ---------- 装備インスタンスと能力値 ---------- */
export function makeEquipmentInstance(defId, enhance = 0) {
  return { uid: uid(), defId, enhance, rank: 'R' };
}
export function instanceRank(inst) { return inst?.rank || 'R'; }
export function charRank(c) { return CHAR_RARITY[c?.rarity || 'R'] || CHAR_RARITY.R; }
export function instanceDef(inst) { return EQUIP_BY_ID[inst?.defId] || null; }

/* -----------------------------------------------------------
   装備による能力強化
   - レアリティが高いほど上昇幅が大きい（N<R<E<L<M<S）
   - 上昇幅は「装備のレアリティ × キャラのレベル × キャラのランク」だけで決まり、
     職業・スタイル・振り分けには依存しない（同じ装備なら不自然に性能が変わらない）
   - 装備を外せば消え、同じ uid を複数スロットに入れても重複加算しない
   ----------------------------------------------------------- */
const RARITY_EQUIP_SCALE = { N:1.0, R:2.0, E:3.4, L:5.4, M:8.0, S:12.0 };
const STAT_WEIGHT = { atk:1, def:0.55, hp:0.5, mp:0.5 };
const HIGH_EFFECT_POOL = [
  'crit','critDamage','ultimatePower','normalAttackPower','extraDamage','ignoreDef',
  'lifesteal','counter','firstStrike','extraStrike','damageCut','hpRegen','mpRegen','statusGuard',
  'element_fire','element_water','element_wind','element_earth','element_thunder',
  'element_ice','element_light','element_dark','element_star',
];
const HIGH_EFFECT_BASE = {
  crit:9, critDamage:34, ultimatePower:28, normalAttackPower:24, extraDamage:45,
  ignoreDef:14, lifesteal:8, counter:12, firstStrike:20, extraStrike:12,
  damageCut:8, hpRegen:3, mpRegen:5, statusGuard:30,
};
function effectValue(id, ri, seed) {
  const base = HIGH_EFFECT_BASE[id] || (id.startsWith('element_') ? 26 : 10);
  return Math.max(1, Math.round(base * (1 + ri * 0.42) + (seed % 7)));
}

export function equipmentStats(inst, c = null) {
  const def = instanceDef(inst);
  if (!def) return { ...emptyStats(), effects: [] };
  const rankMult = CHAR_RARITY[instanceRank(inst)]?.mult || 1;
  const enhance = inst.enhance || 0;
  const m = (1 + enhance * 0.11) * rankMult;
  const ri = Math.max(0, RARITY_ORDER.indexOf(instanceRarity(inst)));
  const rarityScale = c ? (RARITY_EQUIP_SCALE[instanceRarity(inst)] || 1) : 1;
  const levelScale = c ? 1 + Math.min(1.6, (Math.max(1, c.level || 1) - 1) * 0.024) : 1;
  const rankScale = c ? 1 + charRankIndex(c.rarity) * 0.22 : 1;
  const scale = rarityScale * levelScale * rankScale;
  const out = { ...emptyStats(), effects: [] };
  const rawStats = toCoreStats(def.stats);   // 旧装備データの速度・魔力等を 4 種へ換算
  for (const k of STAT_KEYS) {
    const raw = (rawStats[k] || 0) * m + enhance * (k === 'hp' ? 6 : k === 'mp' ? 2 : 1);
    out[k] = Math.round(raw * scale * (STAT_WEIGHT[k] || 1));
  }
  // 元々の定義効果
  out.effects = (def.stats.effects || []).map(x => ({
    ...x, value: Math.round(x.value * (1 + enhance * 0.06) * rankMult * (c ? 1 + ri * 0.18 : 1)),
  }));
  // 高レアリティほど多数の強力な特殊効果（攻撃力以外も強化）
  const seed = [...String(def.id)].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const count = inst?.enemy ? 0
    : ri >= 5 ? 5 : ri >= 4 ? 4 : ri >= 3 ? 3 : ri >= 2 ? 2 : 0;
  for (let i = 0; i < count; i++) {
    const id = HIGH_EFFECT_POOL[(seed + i * 7 + ri * 3) % HIGH_EFFECT_POOL.length];
    out.effects.push({ id, value: effectValue(id, ri, seed + i) });
  }
  // 高レアには攻撃力以外の「強力な特殊効果」を必ず保証する
  if (!inst?.enemy && ri >= 3) {
    const guaranteed = ri >= 5
      ? ['crit','critDamage','ultimatePower','normalAttackPower','ignoreDef','extraDamage']
      : ri >= 4 ? ['crit','critDamage','ultimatePower','ignoreDef']
      : ['crit','ultimatePower'];
    for (const id of guaranteed) {
      out.effects.push({ id, value: effectValue(id, ri, seed + 11) });
    }
    const el = ['element_fire','element_water','element_wind','element_earth','element_thunder',
      'element_ice','element_light','element_dark','element_star'][seed % 9];
    out.effects.push({ id:el, value: effectValue(el, ri, seed + 3) });
  }
  // 装備ランク進化で付く効果（武器の種類・形状は維持）
  const eqRi = charRankIndex(instanceRank(inst));
  if (eqRi > 0) {
    const pool = ['crit','lifesteal','mpRegen','hpRegen','counter','ignoreDef','extraStrike','damageCut','ultimatePower','critDamage'];
    const base = { crit:4, lifesteal:4, mpRegen:3, hpRegen:2, counter:6, ignoreDef:8,
      extraStrike:5, damageCut:4, ultimatePower:8, critDamage:12 };
    const id = pool[(seed + eqRi) % pool.length];
    out.effects.push({ id, value: Math.max(1, Math.round(base[id] * eqRi * rankMult)) });
    if (eqRi >= 3) out.effects.push({ id:'critDamage', value: Math.max(1, Math.round(9 * eqRi * rankMult)) });
  }
  return out;
}
export function instanceRarity(inst) { return instanceDef(inst)?.rarity || 'N'; }
export function findInstance(state, uidv) { return state.inventory.equipment.find(e => e.uid === uidv); }

/** 装備中のインスタンス。同じ uid は 1 回だけ（重複装着による不正加算を防止） */
export function equippedInstances(c, state) {
  const seen = new Set();
  const out = [];
  for (const slot of SLOTS) {
    const uidv = c.equipment?.[slot];
    if (!uidv || seen.has(uidv)) continue;
    const inst = findInstance(state, uidv);
    if (!inst) continue;
    seen.add(uidv);
    out.push(inst);
  }
  return out;
}
/** 装備由来の上昇分だけを取り出す（進化ボーナスとは完全に別） */
export function equipmentBonuses(c, state) {
  const stats = emptyStats(), effects = [];
  for (const inst of equippedInstances(c, state)) {
    const es = equipmentStats(inst, c);
    for (const k of STAT_KEYS) stats[k] += es[k] || 0;
    effects.push(...es.effects);
  }
  return { stats, effects };
}
/** セーブ用スナップショット（装備変更後も進化ボーナスは失われない） */
export function syncEquipmentSnapshot(state, c) {
  const eq = equipmentBonuses(c, state);
  c.equipmentBonus = { ...eq.stats, effects: eq.effects.reduce((a, e) => {
    a[e.id] = (a[e.id] || 0) + e.value; return a;
  }, {}) };
  return c.equipmentBonus;
}

/** 進化・覚醒・転生・称号・レベル・職業・振り分けから成る「素の能力値」（4 種のみ） */
function coreStats(c, state) {
  const job = JOB[c.jobId] || JOB.warrior;
  const style = STYLES.find(x => x.id === c.styleId) || STYLES[0];
  const title = TITLE[c.titleId] || TITLE.t_none;
  const lv = c.level - 1;
  const growth = toCoreStats(job.growth);
  const styleB = toCoreStats(style.bonus);
  const titleB = toCoreStats(title.bonus);
  const alloc = toCoreStats(c.alloc);
  const evo = toCoreStats(c.evolutionBonus);
  const base = { hp:130, atk:40, def:40, mp:60 };
  const s = {};
  for (const k of STAT_KEYS) {
    s[k] = base[k] + growth[k] * lv + alloc[k] + styleB[k] + titleB[k] + evo[k];
  }
  const rankMult = CHAR_RARITY[c.rarity || 'R']?.mult || 1;
  const mult = (1 + c.awakening * 0.13 + c.evolution * 0.05 + (c.rebirth || 0) * 0.12) * rankMult;
  for (const k of STAT_KEYS) s[k] = Math.round(s[k] * mult);
  return s;
}

export function computeStats(c, state) {
  const core = coreStats(c, state);
  const eq = equipmentBonuses(c, state);
  const s = { ...core };
  for (const k of STAT_KEYS) s[k] += eq.stats[k] || 0;
  s.hp = Math.max(120, Math.round(s.hp));
  s.mp = Math.max(20, Math.round(s.mp));
  s.atk = Math.max(1, Math.round(s.atk));
  s.def = Math.max(1, Math.round(s.def));
  const eff = aggregateEffects(c, state, eq.effects);
  s.effects = eff;
  // 以下は「基本ステータス」ではなく技・装備の特殊効果を処理するための内部値。
  // STAT_KEYS に含まれないため、どの画面にも基本ステータスとしては表示されない。
  s.hit = 88 + (eff.hit || 0);
  s.dodge = 5 + (eff.dodge || 0);
  s.crit = 6 + (eff.crit || 0);
  s.critDamage = 165 + (eff.critDamage || 0);
  s.ultimatePower = (eff.ultimatePower || 0) + charRankIndex(c.rarity) * 12 + (c.jobId === GOD_JOB_ID ? 35 : 0);
  s.normalAttackPower = eff.normalAttackPower || 0;
  s.extraDamage = eff.extraDamage || 0;
  s.ignoreDef = eff.ignoreDef || 0;
  return s;
}

function aggregateEffects(c, state, eqEffects = []) {
  const acc = {};
  const push = (id, v) => { acc[id] = (acc[id] || 0) + v; };
  for (const e of eqEffects) push(e.id, e.value);
  const title = TITLE[c.titleId] || TITLE.t_none;
  // 旧称号の速度・魔力などは基本ステータスへ換算済みなので効果としては加算しない
  for (const [k, v] of Object.entries(title.bonus))
    if (!STAT_KEYS.includes(k) && !LEGACY_STAT_KEYS.includes(k)) push(k, v);
  const eb = c.evolutionBonus?.effects || {};
  for (const [k, v] of Object.entries(eb)) if (v) push(k, v);
  if (c.awakening >= 2) push('crit', 3 + c.awakening * 2);
  if (c.awakening >= 4) push('lifesteal', 4);
  if (c.styleId === 'critical') push('crit', 6);
  return acc;
}

export function powerScore(c, state) {
  const s = computeStats(c, state);
  return Math.round(s.hp / 4 + s.mp / 5 + s.atk * 2 + s.def * 1.8
    + (s.critDamage - 165) * 0.6 + (s.ultimatePower || 0) * 0.4
    + c.awakening * 120 + charRankIndex(c.rarity) * 220 + c.level * 8);
}

/* ---------- ログ・通貨 ---------- */
export function logEvent(state, text, kind = 'info') {
  state.log.unshift({ t: new Date().toISOString(), text, kind });
  if (state.log.length > 140) state.log.length = 140;
}
export function addCatalog(arr, id) { if (!arr.includes(id)) arr.push(id); }
export function addCoins(state, n, countEarned = true) {
  state.coins = Math.max(0, Math.round(state.coins + n));
  if (n > 0 && countEarned) state.stats.coinsEarned += n;
}
export function addBP(state, n) { state.bp = Math.max(0, Math.round(state.bp + n)); }
export function addItem(state, id, n = 1) {
  state.inventory.items[id] = (state.inventory.items[id] || 0) + n;
}
export function removeItem(state, id, n = 1) {
  if ((state.inventory.items[id] || 0) < n) return false;
  state.inventory.items[id] -= n;
  if (state.inventory.items[id] <= 0) delete state.inventory.items[id];
  return true;
}
export function itemCount(state, id) { return state.inventory.items[id] || 0; }

/* ---------- レベル・ステータス振り分け ---------- */
export function grantExp(state, c, amount, reason = '経験値') {
  const beforeStats = computeStats(c, state);
  const eff = { ...beforeStats.effects, ...(TITLE[c.titleId]?.bonus || {}) };
  const expBonus = 1 + ((eff.expBonus || 0) + (TITLE[c.titleId]?.bonus?.expBonus || 0)) / 100;
  const gain = Math.round(amount * expBonus);
  c.exp += gain;
  let levels = 0;
  while (c.level < levelCap(c) && c.exp >= xpForLevel(c.level)) {
    c.exp -= xpForLevel(c.level);
    c.level++; c.statPoints += 4; levels++;
    bump(state, 'level', 1);
    logEvent(state, `${c.name}が Lv.${c.level} に上がった！ステータスポイント+4`, 'level');
  }
  if (c.level >= levelCap(c)) c.exp = Math.min(c.exp, xpForLevel(c.level));
  if (levels) {
    const st = computeStats(c, state);
    const before = c.level - levels;
    state.pendingLevelUp = {
      name: c.name, from: before, to: c.level,
      gains: STAT_KEYS.filter(k => st[k] > beforeStats[k]).map(k => ({ key:k, value: st[k]-beforeStats[k] })),
      expNeed: xpForLevel(c.level),
    };
    c.hp = st.hp; c.mp = st.mp; c.hpMaxCache = st.hp; c.mpMaxCache = st.mp; // レベルアップで全回復
    // 職業スキルの自動習得
    const job = JOB[c.jobId];
    for (let i = 0; i < Math.min(job.skills.length, c.level / 6); i++) learnSkillDirect(c, state, job.skills[i], true);
    checkAchievements(state);
  } else {
    const st = computeStats(c, state);
    c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  }
  return { gain, levels };
}

export function allocateStat(state, c, key, n = 1) {
  if (!STAT_KEYS.includes(key) || c.statPoints < n) return false;
  c.statPoints -= n;
  c.alloc[key] = (c.alloc[key] || 0) + n * (key === 'hp' ? 12 : key === 'mp' ? 6 : 3);
  const st = computeStats(c, state);
  c.hp = Math.min(st.hp, c.hp + (key === 'hp' ? n * 12 : 0));
  c.mp = Math.min(st.mp, c.mp + (key === 'mp' ? n * 6 : 0));
  c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  return true;
}

export function resetAllocs(state, c) {
  if (state.coins < 1000) return { ok:false, msg:'1,000コインが必要です' };
  const per = k => k === 'hp' ? 12 : k === 'mp' ? 6 : 3;
  const refund = STAT_KEYS.reduce((a,k) => a + Math.round((c.alloc[k] || 0) / per(k)), 0);
  if (!refund) return { ok:false, msg:'振り分けたポイントがありません' };
  addCoins(state, -1000, false);
  c.statPoints += refund;
  c.alloc = emptyStats();
  const st = computeStats(c, state);
  c.hp = Math.min(c.hp, st.hp); c.mp = Math.min(c.mp, st.mp);
  c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  logEvent(state, `${c.name}の能力値振り分けをリセットした（${refund}P返却）。`, 'train');
  return { ok:true, msg:`振り分けをリセット：${refund}ポイント返却` };
}

export function restoreFull(state, c) {
  const st = computeStats(c, state);
  c.hp = st.hp; c.mp = st.mp; c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
}

/* ---------- 職業 ---------- */
export function jobUnlocked(state, c, job) {
  if (!job.req) return true;
  const r = job.req;
  if (r.god) return !!c.specialKey && !!c.godUnlocked;
  if (r.level && c.level < r.level) return false;
  if (r.awakening && c.awakening < r.awakening) return false;
  if (r.jobs) for (const [id, lv] of Object.entries(r.jobs)) if ((c.jobLevels[id] || 0) < lv) return false;
  return true;
}
export function jobReqText(job) {
  if (job.req?.god) return '指定名ギミック解放 / ランクアップ・転生時のみ変更可';
  if (!job.req) return '初期から選択可能';
  const r = job.req, p = [];
  if (r.level) p.push(`Lv.${r.level}`);
  if (r.awakening) p.push(`覚醒${r.awakening}段階`);
  if (r.jobs) for (const [id, lv] of Object.entries(r.jobs)) p.push(`${JOB[id]?.name || id} Lv.${lv}`);
  return p.join(' / ');
}
export function changeJob(state, c, jobId, allow = false) {
  // 役職変更は「ランクアップ時」か「転生時」だけ。通常画面からは不可。
  if (!allow) return { ok:false, msg:'役職変更はランクアップ時・転生時のみ可能です' };
  const job = JOB[jobId];
  if (!job || !jobUnlocked(state, c, job)) return { ok:false, msg:'解放条件を満たしていません' };
  if (job.req?.god && !c.specialKey) return { ok:false, msg:'この役職は指定された名前にのみ解放されます' };
  if (c.jobId === jobId) return { ok:false, msg:'すでに就いている職業です' };
  const cost = job.tier * 500;
  if (state.coins < cost) return { ok:false, msg:`コインが ${fmt(cost)} 必要です` };
  addCoins(state, -cost, false);
  c.jobId = jobId;
  if (!c.jobLevels[jobId]) c.jobLevels[jobId] = 1;
  if (!c.jobExp[jobId]) c.jobExp[jobId] = 0;
  addCatalog(state.catalog.jobs, jobId);
  // 就いた時点で習得できる技（神は専用技を全部）
  job.skills.slice(0, job.req?.god ? job.skills.length : Math.max(1, job.tier + 1))
    .forEach(id => learnSkillDirect(c, state, id, true));
  // 既に LR なら変更先の奥義も即座に適用
  if (charRankIndex(c.rarity) >= 4) {
    const uidv = jobId === GOD_JOB_ID ? GOD_ULTIMATE_ID : JOB_ULTIMATE[jobId];
    if (uidv) learnSkillDirect(c, state, uidv, true);
  }
  // 神専用装備を 1 つだけ授与（重複付与しない）
  if (job.req?.god && !state.inventory.equipment.some(e => e.defId === 'eq_god_weapon')) {
    addEquipment(state, 'eq_god_weapon');
  }
  logEvent(state, `${c.name}が「${job.name}」に役職変更した。`, 'job');
  checkAchievements(state);
  return { ok:true, msg:`${job.name}になった！（-${fmt(cost)}コイン）` };
}
/** 役職変更の機会があるか（ランクアップ／転生の選択肢 UI 用） */
export function jobChangeCandidates(state, c) {
  return JOBS.filter(j => jobUnlocked(state, c, j) && j.id !== c.jobId);
}
export function grantJobExp(state, c, amount) {
  const id = c.jobId;
  c.jobLevels[id] = c.jobLevels[id] || 1;
  c.jobExp[id] = (c.jobExp[id] || 0) + amount;
  let ups = 0;
  while (c.jobExp[id] >= jobXpForLevel(c.jobLevels[id]) && c.jobLevels[id] < 30) {
    c.jobExp[id] -= jobXpForLevel(c.jobLevels[id]);
    c.jobLevels[id]++; ups++;
    const job = JOB[id];
    const idx = c.jobLevels[id] - 1;
    if (idx < job.skills.length) {
      const learned = learnSkillDirect(c, state, job.skills[idx], true);
      if (learned) logEvent(state, `職業Lv.${c.jobLevels[id]}：技「${SKILL[job.skills[idx]].name}」を習得！`, 'skill');
    }
    c.statPoints += 1;
  }
  if (ups) checkAchievements(state);
  return ups;
}

/* ---------- 技 ---------- */
export function hasSkill(c, id) { return c.skills.some(s => s.id === id); }
function learnSkillDirect(c, state, id, silent = false) {
  if (!SKILL[id] || hasSkill(c, id)) return false;
  c.skills.push({ id, mastery: 0, learnedAt: new Date().toISOString() });
  if (c.equippedSkills.length < 8) c.equippedSkills.push(id);
  if (SKILL[id]?.ultimate) {
    c.ultimateSkills = Array.isArray(c.ultimateSkills) ? c.ultimateSkills : [];
    if (!c.ultimateSkills.includes(id)) c.ultimateSkills.push(id);
  }
  addCatalog(state.catalog.skills, id);
  state.stats.skillLearned++;
  bump(state, 'skill', 1);
  if (!silent) logEvent(state, `技「${SKILL[id].name}」を習得した。`, 'skill');
  return true;
}
export function learnSkill(state, c, id, cost, useBook) {
  if (SKILL[id]?.ultimate || SKILL[id]?.source === 'god')
    return { ok:false, msg:'この技はランク進化・特殊ギミックでしか習得できません' };
  if (hasSkill(c, id)) return { ok:false, msg:'すでに習得済みです' };
  if (SKILL[id].cat === '覚醒限定技' && c.awakening < 1) return { ok:false, msg:'覚醒後に解放されます' };
  if (useBook) {
    if (!removeItem(state, useBook, 1)) return { ok:false, msg:'技の書が足りません' };
  } else if (state.bp < cost) return { ok:false, msg:`対戦ポイントが ${fmt(cost)} 必要です` };
  else addBP(state, -cost);
  learnSkillDirect(c, state, id);
  checkAchievements(state);
  return { ok:true, msg:`「${SKILL[id].name}」を習得！` };
}
export function toggleEquippedSkill(c, id) {
  if (!hasSkill(c, id)) return false;
  const i = c.equippedSkills.indexOf(id);
  if (i >= 0) { c.equippedSkills.splice(i, 1); return true; }
  if (c.equippedSkills.length >= 8) return false;
  c.equippedSkills.push(id); return true;
}
export function useSkillBook(state, c, bookId) {
  const book = ITEM[bookId];
  if (!removeItem(state, bookId, 1)) return { ok:false, msg:'技の書がありません' };
  let pool;
  if (bookId === 'book_basic') pool = SKILLS.filter(s => s.tier <= 2);
  else if (bookId === 'book_mid') pool = SKILLS.filter(s => s.tier >= 3 && s.tier <= 5);
  else if (bookId === 'book_high') pool = SKILLS.filter(s => s.tier >= 5);
  else pool = SKILLS.filter(s => s.cat === '覚醒限定技' || s.cat === '必殺技');
  const unknown = pool.filter(s => !hasSkill(c, s.id) && s.cat !== '覚醒限定技');
  const list = (unknown.length ? unknown : pool.filter(s => !hasSkill(c, s.id)))
    .filter(s => !s.ultimate && s.source !== 'god');
  if (!list.length) {
    addCoins(state, 600);
    return { ok:true, msg:'習得可能な技がなかったため、600コインに変換しました' };
  }
  const pick = rand(list);
  learnSkillDirect(c, state, pick.id);
  checkAchievements(state);
  return { ok:true, msg:`技の書から「${pick.name}」を習得！` };
}

/* ---------- 覚醒・進化・転生 ---------- */
export const AWAKEN_STAGES = [
  { level:10, jobSum:4,  boss:0, coins:800,   materials:{ mat_crystal:2, mat_ore:3 },         skill:'sk_awaken1' },
  { level:20, jobSum:9,  boss:1, coins:2500,  materials:{ mat_stone:2, mat_crystal:4 },       skill:'sk_awaken1', evolution:true },
  { level:32, jobSum:15, boss:2, coins:7000,  materials:{ mat_stardust:2, mat_stone:3 },      skill:'sk_awaken2' },
  { level:45, jobSum:23, boss:3, coins:18000, materials:{ mat_stardust:4, mat_proof:1 },      skill:'sk_eclipse' },
  { level:60, jobSum:33, boss:5, coins:42000, materials:{ mat_stardust:8, mat_proof:2 },      skill:'sk_genesis' },
];
export function awakenStatus(state, c) {
  const st = AWAKEN_STAGES[c.awakening];
  if (!st) return { max:true, stage:null, ok:false, reasons:[] };
  const jobSum = Object.values(c.jobLevels).reduce((a,b) => a + b, 0);
  const reasons = [];
  if (c.level < st.level) reasons.push(`Lv.${st.level}（現在 ${c.level}）`);
  if (jobSum < st.jobSum) reasons.push(`職業熟練度 合計${st.jobSum}（現在 ${jobSum}）`);
  if (state.stats.bossKills < st.boss) reasons.push(`ボス撃破${st.boss}体（現在 ${state.stats.bossKills}）`);
  if (state.coins < st.coins) reasons.push(`コイン ${fmt(st.coins)}`);
  for (const [id,n] of Object.entries(st.materials)) {
    if (itemCount(state,id) < n) reasons.push(`${ITEM[id].name} ×${n}（現在 ${itemCount(state,id)}）`);
  }
  return { max:false, stage:st, jobSum, ok:reasons.length===0, reasons };
}
export function doAwaken(state, c) {
  const a = awakenStatus(state, c);
  if (!a.ok) return { ok:false, msg:a.max ? '最終段階です' : '条件が揃っていません' };
  const st = a.stage;
  addCoins(state, -st.coins, false);
  for (const [id,n] of Object.entries(st.materials)) removeItem(state, id, n);
  c.awakening++;
  c.statPoints += 10;
  if (st.evolution) c.evolution++;
  if (st.skill) learnSkillDirect(c, state, st.skill);
  if (c.awakening >= 3) learnSkillDirect(c, state, 'sk_awaken3');
  if (c.awakening >= 5) learnSkillDirect(c, state, 'sk_secret');
  state.stats.awakenings++;
  restoreFull(state, c);
  bump(state, 'awake', 1);
  logEvent(state, `${c.name}が「${AWAKENING_NAMES[c.awakening]}」に覚醒！能力値が大幅に上昇した。`, 'awaken');
  addCatalog(state.catalog.titles, `覚醒${c.awakening}`);
  checkAchievements(state);
  return { ok:true, msg:`${AWAKENING_NAMES[c.awakening]} へ覚醒！全能力上昇・ステータスポイント+10` };
}

/* ---------- キャラクターのランク進化（レベルとは別管理） ---------- */
export function emptyEvolutionBonus() {
  return { ...Object.fromEntries(STAT_KEYS.map(k => [k, 0])),
    effects:{ crit:0, critDamage:0, ultimatePower:0 } };
}
export function mergeEvolutionBonus(base, add) {
  const out = { ...emptyEvolutionBonus(), ...(base || {}) };
  for (const k of STAT_KEYS) out[k] = (out[k] || 0) + (add[k] || 0);
  out.effects = { ...out.effects };
  for (const [k,v] of Object.entries(add.effects || {})) out.effects[k] = (out.effects[k] || 0) + v;
  return out;
}
/** 進化で得る全ステータスの大幅上昇（装備・職業に依存しない永続値） */
export function rankUpBonus(state, c, to) {
  // 装備を外した「素の能力値」を基準に、ランクが上がるほど大きな割合で強化
  const bare = { ...c, equipment:{ weapon:null, armor:null, accessory:null, ornament:null } };
  const base = coreStats(bare, state);
  const idx = charRankIndex(to);
  const rate = EVOLUTION_BY_FROM[c.rarity]?.rate || 0.22 + idx * 0.1;
  const b = emptyEvolutionBonus();
  for (const k of STAT_KEYS) b[k] = Math.max(3, Math.round(base[k] * rate));
  b.effects = { crit: 2 + idx * 2, critDamage: 8 + idx * 6, ultimatePower: 10 + idx * 9 };
  return b;
}
export function evolutionPreview(state, c) {
  const rule = EVOLUTION_BY_FROM[c.rarity || 'R'];
  if (!rule) return { max:true, rule:null, mats:[], ok:false, reasons:['最終ランク LR に到達済み'] };
  const req = RANK_REQUIREMENTS[rule.to] || [];
  const mats = req.map(m => ({ ...m, have: itemCount(state, m.id), item: MATERIAL_BY_ID[m.id] }));
  const reasons = [];
  if (c.level < rule.level) reasons.push(`Lv.${rule.level}（現在 Lv.${c.level}）`);
  if (state.coins < rule.coins) reasons.push(`コイン ${fmt(rule.coins)}`);
  for (const m of mats) if (m.have < m.n) reasons.push(`${MATERIAL_BY_ID[m.id]?.name || m.id} ×${m.n}（現在 ${m.have}）`);
  const beforeStats = computeStats(c, state);
  const bonus = rankUpBonus(state, c, rule.to);
  const afterStats = computeStats({ ...c, rarity: rule.to,
    evolutionBonus: mergeEvolutionBonus(c.evolutionBonus, bonus) }, state);
  const gains = STAT_KEYS.filter(k => afterStats[k] > beforeStats[k])
    .map(k => ({ key:k, value:afterStats[k]-beforeStats[k] }));
  return { max:false, rule, mats, reasons, ok:reasons.length === 0, beforeStats, afterStats,
    bonus, gains, nextRank: CHAR_RARITY[rule.to], skill: SKILL[rule.skill],
    jobUltimate: rule.to === 'LR' ? SKILL[c.jobId === GOD_JOB_ID ? GOD_ULTIMATE_ID : JOB_ULTIMATE[c.jobId]] : null,
    specialUltimate: c.specialUltimateId ? SKILL[c.specialUltimateId] : null };
}
export function evolveCharacter(state, c) {
  const p = evolutionPreview(state, c);
  if (p.max) return { ok:false, msg:'最終ランク LR です' };
  if (!p.ok) return { ok:false, msg:`条件が揃っていません：${p.reasons.join(' / ')}` };
  const rule = p.rule;
  addCoins(state, -rule.coins, false);
  for (const m of p.mats) removeItem(state, m.id, m.n);
  // レベル・EXP・名前・元画像・職業・習得済み技・装備・戦績は一切変更しない
  c.evolutionBonus = mergeEvolutionBonus(c.evolutionBonus, p.bonus);
  c.rarity = rule.to;
  c.statPoints += 6;
  learnSkillDirect(c, state, rule.skill);
  // 特殊奥義：最初の R → SR 進化で習得（通常職の奥義は LR のまま）
  let learnedSpecial = null;
  if (rule.from === 'R' && c.specialKey && c.specialUltimateId) {
    if (learnSkillDirect(c, state, c.specialUltimateId)) learnedSpecial = SKILL[c.specialUltimateId];
  }
  // LR 進化で職業（神含む）に応じた奥義を習得
  let learnedUltimate = null;
  if (rule.to === 'LR') {
    const uidv = c.jobId === GOD_JOB_ID ? GOD_ULTIMATE_ID : JOB_ULTIMATE[c.jobId];
    if (uidv && learnSkillDirect(c, state, uidv)) learnedUltimate = SKILL[uidv];
  }
  state.stats.evolutions++;
  restoreFull(state, c);
  syncEquipmentSnapshot(state, c);
  const extraLog = [learnedSpecial && `特殊奥義「${learnedSpecial.name}」`,
    learnedUltimate && `奥義「${learnedUltimate.name}」`].filter(Boolean).join(' / ');
  logEvent(state, `「${c.name}」が ${rule.from} → ${rule.to} に進化！全ステータスが大幅上昇${extraLog ? `、${extraLog}を習得` : ''}。`, 'evolution');
  checkAchievements(state);
  return { ok:true, msg:`${rule.from} → ${rule.to} 進化成功！ ${rule.gain}${extraLog?` / ${extraLog}`:''}`, rule,
    gains:p.gains, learnedSpecial, learnedUltimate,
    jobChangeOffer:{ reason:'rank', from:rule.from, to:rule.to } };
}

/* ---------- 武器・装備のランク進化 ---------- */
export function equipmentEvolvePreview(state, instUid) {
  const inst = findInstance(state, instUid);
  if (!inst) return { ok:false, msg:'装備が見つかりません' };
  const cur = instanceRank(inst), i = CHAR_RARITY_ORDER.indexOf(cur);
  if (i >= CHAR_RARITY_ORDER.length - 1) return { ok:false, max:true, msg:'最終ランク LR です' };
  const next = CHAR_RARITY_ORDER[i+1];
  const req = (RANK_REQUIREMENTS[next] || RANK_REQUIREMENTS.SR).slice(0, 3);
  const mats = req.map(m => ({ id:m.id, n:Math.max(1, Math.ceil(m.n/2)), have:itemCount(state, m.id), item:MATERIAL_BY_ID[m.id] }));
  const coins = 900 * Math.pow(2.2, i);
  const reasons = [];
  if (state.coins < coins) reasons.push(`コイン ${fmt(Math.round(coins))}`);
  for (const m of mats) if (m.have < m.n) reasons.push(`${MATERIAL_BY_ID[m.id]?.name || m.id} ×${m.n}`);
  const before = equipmentStats(inst);
  const after = equipmentStats({ ...inst, rank: next });
  return { ok:reasons.length===0, reasons, inst, cur, next, nextInfo:CHAR_RARITY[next],
    coins:Math.round(coins), mats, before, after, def:instanceDef(inst) };
}
export function evolveEquipment(state, instUid) {
  const p = equipmentEvolvePreview(state, instUid);
  if (p.max || !p.inst) return { ok:false, msg:p.msg };
  if (!p.ok) return { ok:false, msg:`条件が揃っていません：${p.reasons.join(' / ')}` };
  addCoins(state, -p.coins, false);
  for (const m of p.mats) removeItem(state, m.id, m.n);
  p.inst.rank = p.next;   // 武器の種類・形状・defId は維持したまま装飾と効果だけ強化
  for (const ch of state.characters) syncEquipmentSnapshot(state, ch);
  state.stats.equipEvolutions++;
  logEvent(state, `${p.def.name} がランク ${p.cur} → ${p.next} に進化した。`, 'evolution');
  checkAchievements(state);
  return { ok:true, msg:`${p.def.name} → ランク ${p.next}！攻撃力・特殊効果が強化`, next:p.next };
}

/* ---------- 素材 ---------- */
export function grantMaterials(state, obj = {}) {
  const out = [];
  for (const [id, n] of Object.entries(obj)) {
    if (!n) continue;
    addItem(state, id, n);
    if (MATERIAL_BY_ID[id]) addCatalog(state.catalog.materials, id);
    out.push({ id, n });
  }
  return out;
}
export function upgradeMaterial(state, id) {
  const target = materialUpgradeTarget(id);
  if (!target) return { ok:false, msg:'これ以上上位化できない素材です' };
  if (itemCount(state, id) < 3) return { ok:false, msg:`${ITEM[id]?.name || id} が3個必要です` };
  const step = MAT_RANKS.indexOf(MATERIAL_BY_ID[id].rank) + 1;
  const cost = 160 * step;
  if (state.coins < cost) return { ok:false, msg:`${fmt(cost)}コインが必要です` };
  removeItem(state, id, 3);
  addCoins(state, -cost, false);
  grantMaterials(state, { [target]:1 });
  logEvent(state, `${ITEM[id].name} ×3 を ${ITEM[target].name} に合成した。`, 'material');
  return { ok:true, msg:`${ITEM[target].name} を入手！` };
}

export function canRebirth(state, c) {
  return c.level >= levelCap(c) && itemCount(state, 'mat_rebirth') >= 1 && state.coins >= 5000;
}
export function doRebirth(state, c) {
  if (!canRebirth(state, c)) return { ok:false, msg:`Lv.${levelCap(c)} / 転生の証 / 5,000コイン が必要です` };
  removeItem(state, 'mat_rebirth', 1);
  addCoins(state, -5000, false);
  c.rebirth = (c.rebirth || 0) + 1;
  c.level = 1; c.exp = 0; c.statPoints += 15;
  state.stats.rebirths++;
  restoreFull(state, c);
  bump(state, 'rebirth', 1);
  logEvent(state, `${c.name}が${c.rebirth}回目の転生を果たした。能力値の下限が永遠に引き上げられた。`, 'rebirth');
  checkAchievements(state);
  return { ok:true, msg:`転生完了！永続ボーナス+12%、ステータスポイント+15`,
    jobChangeOffer:{ reason:'rebirth', from:c.rarity, to:c.rarity } };
}

/* ---------- 装備・ガチャ・強化・合成 ---------- */
export function addEquipment(state, defId, enhance = 0) {
  const inst = makeEquipmentInstance(defId, enhance);
  state.inventory.equipment.push(inst);
  addCatalog(state.catalog.equipment, defId);
  return inst;
}
export function equipItem(state, c, instUid, slot) {
  const inst = findInstance(state, instUid);
  if (!inst || !SLOTS.includes(slot)) return false;
  const def = instanceDef(inst);
  if (def.slot !== slot) return false;
  if (def.godOnly && c.jobId !== GOD_JOB_ID) return false;
  if (def.slot === 'weapon' && !JOB[c.jobId].weapons.includes(def.type)) {
    return false;
  }
  c.equipment[slot] = inst.uid;
  syncEquipmentSnapshot(state, c);
  const st = computeStats(c, state);
  c.hp = Math.min(c.hp, st.hp); c.mp = Math.min(c.mp, st.mp);
  c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  return true;
}
export function unequip(state, c, slot) {
  c.equipment[slot] = null;
  syncEquipmentSnapshot(state, c);
  const st = computeStats(c, state);
  c.hp = Math.min(c.hp, st.hp); c.mp = Math.min(c.mp, st.mp);
}
export function sellEquipment(state, uidv) {
  const i = state.inventory.equipment.findIndex(e => e.uid === uidv);
  if (i < 0) return { ok:false, msg:'装備が見つかりません' };
  const inst = state.inventory.equipment[i];
  for (const c of state.characters) for (const slot of SLOTS) if (c.equipment[slot] === uidv) c.equipment[slot] = null;
  const def = instanceDef(inst);
  const price = Math.round((60 + RARITY[def.rarity].mult * 90) * (1 + (inst.enhance || 0) * 0.15));
  state.inventory.equipment.splice(i, 1);
  for (const ch of state.characters) syncEquipmentSnapshot(state, ch);
  addCoins(state, price);
  return { ok:true, msg:`${def.name} を ${fmt(price)}コインで売却` };
}

export const GACHA_COST = 300;
export const GACHA_COST_10 = 2700;
export const PITY_LEGENDARY = 60;
export const PITY_MYTHIC = 120;

/** 表示用の排出確率。60連 / 120連の天井は独立して管理する */
export function gachaRates(kind, pity) {
  const p = normalizePity(pity);
  const base = RARITIES.map(r => ({ ...r }));
  if (p.mythic >= PITY_MYTHIC - 1) return base.map(r => ({ ...r, rate: r.id === 'M' ? 90 : r.id === 'S' ? 10 : 0 }));
  if (p.legendary >= PITY_LEGENDARY - 1) return base.map(r => ({ ...r, rate: r.id === 'L' ? 88 : r.id === 'M' ? 10 : r.id === 'S' ? 2 : 0 }));
  return base;
}
export function rollRarity() {
  let x = Math.random() * RATE_TOTAL, acc = 0;
  for (const r of RARITIES) { acc += r.rate; if (x < acc) return r.id; }
  return 'N';
}
export function pullGacha(state, kind, count = 1) {
  const cost = count === 10 ? GACHA_COST_10 : GACHA_COST * count;
  if (state.coins < cost) return { ok:false, msg:`コインが ${fmt(cost)} 必要です` };
  addCoins(state, -cost, false);
  const pity = state.pity[kind] || (state.pity[kind] = normalizePity());
  const results = [], details = [], pityLog = [];
  const slots = kind === 'weapon' ? ['weapon'] : ['armor','accessory','ornament'];
  // 演出を始める前に排出結果を完全に確定させる（スキップや演出で結果は変わらない）
  const bannerInfo = kind === 'weapon' ? currentBanner() : null;
  const banner = bannerInfo?.banner || null;
  const rateMap = banner ? Object.fromEntries(bannerRates(banner).map(r => [r.id, r])) : null;
  for (let i = 0; i < count; i++) {
    let rarity, forced = null;
    // 独立天井：ミシック天井を優先、次にレジェンダリー天井
    if (pity.mythic + 1 >= PITY_MYTHIC) { rarity = Math.random() < 0.2 ? 'S' : 'M'; forced = 'ミシック天井'; }
    else if (pity.legendary + 1 >= PITY_LEGENDARY) {
      const x = Math.random()*100; rarity = x < 88 ? 'L' : x < 98 ? 'M' : 'S'; forced = 'レジェンダリー天井';
    } else rarity = rollRarity();
    const beforeL = pity.legendary, beforeM = pity.mythic;
    // 対応する天井カウントだけをリセット（独立管理）
    pity.legendary = ['L','M','S'].includes(rarity) ? 0 : pity.legendary + 1;
    pity.mythic = ['M','S'].includes(rarity) ? 0 : pity.mythic + 1;
    pity.total++;

    let def, pickup = false, hidden = false;
    if (kind === 'weapon' && banner) {
      // レアリティ内で「ピックアップ枠」と「通常枠」を分ける。レアリティ率自体は不変。
      const picks = pickupDefIds(banner, rarity);
      const cond = rateMap[rarity] && rateMap[rarity].total > 0
        ? rateMap[rarity].pickup / rateMap[rarity].total : 0;
      if (picks.length && Math.random() < cond) {
        const id = rand(picks);
        def = EQUIP_BY_ID[id]; pickup = true; hidden = isHidden(banner, id);
      } else {
        const normal = normalDefIds(rarity, picks);
        const fallback = allDefIds(rarity);
        def = EQUIP_BY_ID[rand(normal.length ? normal : fallback)];
      }
    }
    if (!def) {
      const pool = EQUIPMENT.filter(x => slots.includes(x.slot) && x.rarity === rarity);
      def = rand(pool.length ? pool : EQUIPMENT.filter(x => slots.includes(x.slot)));
    }
    const isNew = !state.catalog.equipment.includes(def.id);
    const inst = addEquipment(state, def.id);
    if (['L','M','S'].includes(rarity)) state.stats.gachaLegendary++;
    const at = new Date().toISOString();
    const entry = { at, kind, rarity, defId:def.id, name:def.name,
      legendaryBefore:beforeL, mythicBefore:beforeM, forced,
      pickup, isNew, hidden, bannerId:banner?.id || null, bannerName:banner?.short || null };
    pity.history.push(entry);
    if (pity.history.length > 90) pity.history.shift();
    pityLog.push(forced ? `${def.name}（${forced}）` : def.name);
    results.push(inst);
    details.push({
      index:i, uid:inst.uid, defId:def.id, name:def.name, rarity,
      type:def.type, slot:def.slot, color:def.color, desc:def.desc,
      enhance:inst.enhance || 0, rank:inst.rank || 'R',
      pickup, isNew, hidden, forced, bannerId:banner?.id || null,
      legendaryBefore:beforeL, mythicBefore:beforeM, at,
    });
  }
  // 10連ボーナス：進化素材（ガチャ結果画面に素材アイコンを表示する）
  let bonusMaterials = [];
  if (count === 10) {
    const poolR = MATERIAL_ITEMS.filter(m => m.rank === 'R');
    const m = rand(poolR);
    bonusMaterials = grantMaterials(state, { [m.id]:1 });
  }
  state.stats.pulls += count;
  bump(state, 'pull', count);
  logEvent(state, `${kind === 'weapon' ? '武器' : '装備'}ガチャを${count}回引いた。`, 'gacha');
  checkAchievements(state);
  return { ok:true, results, details, bonusMaterials, banner, bannerInfo,
    msg:`${count}連ガチャ完了！` };
}
export function enhanceEquipment(state, instUid) {
  const inst = findInstance(state, instUid);
  if (!inst) return { ok:false, msg:'装備を選択してください' };
  if (inst.enhance >= 10) return { ok:false, msg:'これ以上強化できません（+10上限）' };
  const cost = Math.round(180 * Math.pow(1.55, inst.enhance));
  const ore = 1 + Math.floor(inst.enhance / 3);
  if (state.coins < cost) return { ok:false, msg:`${fmt(cost)}コインが必要です` };
  if (itemCount(state, 'mat_ore') < ore) return { ok:false, msg:`精錬鉱石が${ore}個必要です` };
  addCoins(state, -cost, false); removeItem(state, 'mat_ore', ore);
  inst.enhance++;
  for (const ch of state.characters) syncEquipmentSnapshot(state, ch);
  logEvent(state, `${instanceDef(inst).name} を +${inst.enhance} に強化した。`, 'forge');
  return { ok:true, msg:`${instanceDef(inst).name} → +${inst.enhance}！` };
}
export function synthesizeEquipment(state, uids) {
  if (uids.length !== 3) return { ok:false, msg:'同じレアリティの装備を3つ選んでください' };
  const insts = uids.map(u => findInstance(state, u)).filter(Boolean);
  if (insts.length !== 3) return { ok:false, msg:'装備が見つかりません' };
  const rar = instanceRarity(insts[0]);
  if (insts.some(i => instanceRarity(i) !== rar)) return { ok:false, msg:'レアリティが揃っていません' };
  const top = rar === 'S';
  const cost = top ? 6000 : Math.round(500 * Math.pow(2.1, RARITY_ORDER.indexOf(rar)));
  const catalyst = top ? 2 : 1;
  if (state.coins < cost || itemCount(state,'mat_catalyst') < catalyst) return { ok:false, msg:`${fmt(cost)}コインと合成触媒×${catalyst}が必要です` };
  addCoins(state, -cost, false); removeItem(state, 'mat_catalyst', catalyst);
  const targetRarity = top ? 'S' : RARITY_ORDER[RARITY_ORDER.indexOf(rar) + 1];
  const slots = [...new Set(insts.map(i => instanceDef(i).slot))];
  const pool = EQUIPMENT.filter(e => e.rarity === targetRarity && slots.includes(e.slot));
  const def = rand(pool.length ? pool : EQUIPMENT.filter(e => e.rarity === targetRarity));
  for (const c of state.characters) for (const slot of SLOTS) if (uids.includes(c.equipment[slot])) c.equipment[slot] = null;
  state.inventory.equipment = state.inventory.equipment.filter(e => !uids.includes(e.uid));
  const best = Math.max(...insts.map(i => i.enhance || 0));
  const inst = addEquipment(state, def.id, Math.min(10, Math.floor(best / 2) + (top ? 3 : 0)));
  state.stats.syntheses++;
  bump(state, 'synth', 1);
  logEvent(state, `合成成功：${RARITY[targetRarity].name}「${def.name}」が生まれた。`, 'forge');
  checkAchievements(state);
  return { ok:true, msg:`合成成功！ ${RARITY[targetRarity].name}「${def.name}」`, inst };
}

/* ---------- ショップ・交換所 ---------- */
export const SHOP_STOCK = ['potion_s','potion_m','potion_l','ether_s','ether_l','antidote','stimulant','elixir','mat_ore','mat_crystal','mat_stone','mat_stardust','mat_catalyst','book_basic','book_mid','book_high',
  'evo_stone_R','awaken_crystal_R','mana_crystal_R','job_proof_R','weapon_ore_R','element_gem_R','boss_core_R','legend_mat_R'];
export function shopPrice(id) { return ITEM[id]?.price || 0; }
export function buyItem(state, id, n = 1) {
  const it = ITEM[id];
  if (!it || !it.price) return { ok:false, msg:'購入できないアイテムです' };
  const cost = it.price * n;
  if (state.coins < cost) return { ok:false, msg:`コインが ${fmt(cost)} 必要です` };
  addCoins(state, -cost, false); grantMaterials(state, { [id]: n });
  logEvent(state, `${it.name} ×${n} を購入。`, 'shop');
  return { ok:true, msg:`${it.name} ×${n} を購入（-${fmt(cost)}）` };
}
export function sellItem(state, id, n = 1) {
  const it = ITEM[id];
  if (!it || !removeItem(state, id, n)) return { ok:false, msg:'アイテムが足りません' };
  const gain = (it.sell || Math.round((it.price || 100) * 0.3)) * n;
  addCoins(state, gain);
  return { ok:true, msg:`${it.name} ×${n} を売却（+${fmt(gain)}）` };
}
export function exchangeItem(state, c, exId) {
  const ex = EXCHANGE.find(e => e.id === exId);
  if (!ex) return { ok:false, msg:'商品がありません' };
  if (state.bp < ex.cost) return { ok:false, msg:`対戦ポイントが ${fmt(ex.cost)} 必要です` };
  if (ex.kind === 'skill') {
    if (hasSkill(c, ex.skill)) return { ok:false, msg:'習得済みです' };
    const need = ex.skill === 'sk_secret' ? 5 : ex.skill === 'sk_awaken3' || ex.skill === 'sk_awaken2' ? 2 : 1;
    if (c.awakening < need) return { ok:false, msg:`覚醒${need}段階以上が必要です` };
  }
  if (ex.kind === 'godEquip') {
    if (!c.specialKey || !c.godUnlocked) return { ok:false, msg:'特殊役職「神」の解放者だけ交換できます' };
    if (!GOD_EQUIPMENT.some(e => !state.inventory.equipment.some(x => x.defId === e.id)))
      return { ok:false, msg:'神専用装備はすべて所持しています' };
  }
  addBP(state, -ex.cost);
  if (ex.kind === 'skill') learnSkillDirect(c, state, ex.skill);
  if (ex.kind === 'item') grantMaterials(state, { [ex.item]: ex.count || 1 });
  if (ex.kind === 'title') { addCatalog(state.titles, ex.title); c.titleId = ex.title; }
  if (ex.kind === 'godEquip') {
    const pool = GOD_EQUIPMENT.filter(e => !state.inventory.equipment.some(x => x.defId === e.id));
    const inst = addEquipment(state, rand(pool).id);
    logEvent(state, `交換所で ${instanceDef(inst).name} を入手。`, 'exchange');
  }
  if (ex.kind === 'equip') {
    const pool = EQUIPMENT.filter(e => e.rarity === ex.rarity && !e.godOnly);
    const inst = addEquipment(state, rand(pool).id);
    logEvent(state, `交換所で ${instanceDef(inst).name} を入手。`, 'exchange');
  }
  addCatalog(state.exchangePurchased || (state.exchangePurchased = []), exId);
  logEvent(state, `対戦ポイントと「${ex.name}」を交換した。`, 'exchange');
  checkAchievements(state);
  return { ok:true, msg:`「${ex.name}」を獲得！` };
}

/* ---------- 修行 ---------- */
export const TRAINING = [
  { id:'hp', name:'体力錬成', icon:'❤', desc:'HP +12 / EXP・熟練度', stat:'hp' },
  { id:'mp', name:'精神統一', icon:'✦', desc:'MP +6 / EXP・熟練度', stat:'mp' },
  { id:'atk', name:'筋力トレーニング', icon:'⚔', desc:'攻撃力 +3 / EXP・熟練度', stat:'atk' },
  { id:'def', name:'防御鍛錬', icon:'🛡', desc:'防御力 +3 / EXP・熟練度', stat:'def' },
];
export function trainingCost(state, id) { return 140 + (state.stats.trainings || 0) * 18; }
export function doTraining(state, c, id, sets = 1) {
  const t = TRAINING.find(x => x.id === id);
  if (!t) return { ok:false, msg:'メニューがありません' };
  const cost = trainingCost(state, id) * sets;
  if (state.coins < cost) return { ok:false, msg:`${fmt(cost)}コインが必要です` };
  addCoins(state, -cost, false);
  const expGain = grantExp(state, c, 110 * sets + c.level * 8 * sets);
  const jl = grantJobExp(state, c, 26 * sets);
  for (let i = 0; i < sets; i++) allocateStat(state, c, t.stat, 1);
  state.stats.trainings += sets;
  bump(state, 'train', sets);
  checkAchievements(state);
  return { ok:true, msg:`修行完了：+${fmt(expGain.gain)}EXP / 職業熟練+${jl ? 'レベルUP' : '26'} / ${t.stat.toUpperCase()}上昇${expGain.levels ? ` / Lv.${expGain.levels}UP` : ''}` };
}
export function doPractice(state, c, skillId) {
  if (!hasSkill(c, skillId)) return { ok:false, msg:'習得していない技です' };
  const sk = c.skills.find(s => s.id === skillId);
  if (sk.mastery >= 20) return { ok:false, msg:'この技は極め済みです' };
  const cost = 220 + sk.mastery * 90;
  if (state.coins < cost) return { ok:false, msg:`${fmt(cost)}コインが必要です` };
  addCoins(state, -cost, false);
  sk.mastery++;
  grantJobExp(state, c, 8);
  logEvent(state, `「${SKILL[skillId].name}」の練習をした（熟練 ${sk.mastery}/20）。`, 'train');
  return { ok:true, msg:`「${SKILL[skillId].name}」熟練度 ${sk.mastery}/20（威力+${sk.mastery*3}%）` };
}
export const TRAINING_QUESTS = [
  { id:'tq1', name:'木人百叩き', req:{ level:3, wins:0 }, cost:300, reward:{ coins:500, exp:260, items:{mat_ore:2,evo_stone_R:2,weapon_ore_R:1} }, desc:'Lv.3以上。100回の打ち込みで鉱石を得る。' },
  { id:'tq2', name:'滝行の呼吸', req:{ level:8, wins:2 }, cost:600, reward:{ coins:1200, exp:600, items:{mat_crystal:1,awaken_crystal_SR:1} }, desc:'Lv.8 / 2勝以上。精神を研ぎ澄ます。' },
  { id:'tq3', name:'影踏みの歩法', req:{ level:14, wins:5 }, cost:1100, reward:{ bp:40, exp:1000, items:{mat_catalyst:1,mana_crystal_SR:1} }, desc:'Lv.14 / 5勝以上。素早さの極意。' },
  { id:'tq4', name:'魔導書の写経', req:{ level:20, wins:10 }, cost:1800, reward:{ bp:70, exp:1600, items:{book_mid:1,job_proof_SSR:1} }, desc:'Lv.20 / 10勝以上。技の書を写す。' },
  { id:'tq5', name:'覚醒石の採掘', req:{ level:28, wins:20 }, cost:3000, reward:{ bp:120, exp:2600, items:{mat_stone:2,element_gem_SSR:1,boss_core_SSR:1} }, desc:'Lv.28 / 20勝以上。鉱脈を掘る。' },
  { id:'tq6', name:'星砂の儀式', req:{ level:40, wins:35 }, cost:5200, reward:{ bp:220, exp:4200, items:{mat_stardust:2,boss_core_UR:1,legend_mat_UR:1} }, desc:'Lv.40 / 35勝以上。星と交信する。' },
  { id:'tq7', name:'輪廻の瞑想', req:{ level:55, wins:60 }, cost:8000, reward:{ bp:350, exp:6500, items:{mat_rebirth:1,legend_mat_LR:1} }, desc:'Lv.55 / 60勝以上。転生の証を得る。' },
];
export function trainingQuestStatus(state, c, q) {
  if (state.trainingQuests[q.id]) return { done:true, ok:false, reasons:['達成済み'] };
  const reasons = [];
  if (c.level < q.req.level) reasons.push(`Lv.${q.req.level}（現在 ${c.level}）`);
  if (state.stats.wins < q.req.wins) reasons.push(`${q.req.wins}勝（現在 ${state.stats.wins}）`);
  if (state.coins < q.cost) reasons.push(`${fmt(q.cost)}コイン`);
  return { done:false, ok:!reasons.length, reasons };
}
export function doTrainingQuest(state, c, qid) {
  const q = TRAINING_QUESTS.find(x => x.id === qid);
  const st = trainingQuestStatus(state, c, q);
  if (!q || !st.ok) return { ok:false, msg:st.done ? '達成済みです' : '条件：' + st.reasons.join(' / ') };
  addCoins(state, -q.cost, false);
  state.trainingQuests[qid] = nowDate();
  for (const [k,v] of Object.entries(q.reward)) {
    if (k === 'coins') addCoins(state, v);
    else if (k === 'bp') addBP(state, v);
    else if (k === 'exp') grantExp(state, c, v);
    else if (k === 'items') for (const [id,n] of Object.entries(v)) addItem(state, id, n);
  }
  logEvent(state, `修行クエスト「${q.name}」を達成。`, 'quest');
  return { ok:true, msg:`「${q.name}」達成！報酬を獲得` };
}
export function repeatableTraining(state, c) {
  if (state.coins < 320) return { ok:false, msg:'320コインが必要です' };
  addCoins(state, -320, false);
  const items = ['mat_ore','mat_crystal','mat_catalyst','potion_m','ether_s',
    'evo_stone_R','awaken_crystal_R','weapon_ore_R','job_proof_R','mana_crystal_R'];
  grantMaterials(state, { [rand(items)]:1 });
  const g = grantExp(state, c, 180);
  grantJobExp(state, c, 12);
  state.stats.trainings++;
  return { ok:true, msg:`日替わり修行完了：+${fmt(g.gain)}EXP / 素材1個 / 熟練度+12` };
}

/* ---------- クエスト・実績・称号 ---------- */
export function resetDailyQuests(state) {
  for (const q of QUESTS.filter(x => x.daily)) delete state.quests[q.id];
  state.lastDaily = nowDate();
}
export function questProgress(state, q) {
  if (q.daily && state.lastDaily !== nowDate()) return 0;
  return state.quests[q.id]?.progress || 0;
}
export function questClaimed(state, q) { return !!state.quests[q.id]?.claimed; }
export function bump(state, type, n = 1) {
  if (state.lastDaily !== nowDate()) resetDailyQuests(state);
  for (const q of QUESTS) if (q.type === type && !questClaimed(state, q)) {
    const cur = state.quests[q.id] || { progress:0, claimed:false };
    cur.progress = Math.min(q.need, cur.progress + n);
    state.quests[q.id] = cur;
  }
  checkAchievements(state);
}
export function claimQuest(state, c, qid) {
  const q = QUESTS.find(x => x.id === qid);
  if (!q) return { ok:false, msg:'クエストがありません' };
  if (questClaimed(state, q)) return { ok:false, msg:'受け取り済みです' };
  if (questProgress(state, q) < q.need) return { ok:false, msg:'条件を達成していません' };
  state.quests[qid] = { ...(state.quests[qid] || {}), claimed:true };
  grantReward(state, c, q.reward);
  state.stats.questsClaimed++;
  logEvent(state, `クエスト「${q.name}」の報酬を受け取った。`, 'quest');
  checkAchievements(state);
  return { ok:true, msg:`「${q.name}」報酬獲得！` };
}
export function grantReward(state, c, r = {}) {
  if (r.coins) addCoins(state, r.coins);
  if (r.bp) addBP(state, r.bp);
  if (r.exp) grantExp(state, c, r.exp);
  if (r.items) grantMaterials(state, r.items);
}
export function checkAchievements(state) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = !!a.cond(state); } catch (e) { ok = false; }
    if (ok) {
      state.achievements[a.id] = { at:new Date().toISOString(), claimed:false };
      const t = TITLES.find(t => t.name === a.title);
      if (t) addCatalog(state.titles, t.id);
      const c = state.characters[0];
      grantReward(state, c, a.reward);
      state.stats.questsClaimed++;
      logEvent(state, `実績「${a.name}」を達成！称号「${a.title}」解放`, 'achieve');
      fresh.push(a);
    }
  }
  return fresh;
}
export function equipTitle(state, c, titleId) {
  if (!state.titles.includes(titleId)) return false;
  c.titleId = titleId;
  const st = computeStats(c, state);
  c.hp = Math.min(c.hp, st.hp); c.mp = Math.min(c.mp, st.mp);
  return true;
}

/* ---------- ランク・対戦報酬 ---------- */
export function rankInfo(state) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (state.rankPoints >= r.min) idx = i; });
  return { idx, ...RANKS[idx], next: RANKS[idx+1] || null };
}
export function battleRewards(state, c, enemy, won, meta = {}) {
  const eff = { ...computeStats(c, state).effects, ...(TITLE[c.titleId]?.bonus || {}) };
  const effBonus = (id) => 1 + (eff[id] || 0) / 100;
  const base = enemy.tutorial ? 110
    : enemy.level * 14 + (enemy.tier || 0) * 90 + (enemy.boss ? 260 : 0) + (meta.floor ? meta.floor * 22 : 0);
  const mult = won ? 1 : 0.22;
  const streakBonus = won ? 1 + Math.min(0.6, state.winStreak * 0.04) : 1;
  const coins = Math.max(12, Math.round(base * mult * streakBonus * effBonus('coinBonus') * (meta.dungeon ? 1.3 : 1)));
  const exp = Math.max(20, Math.round((base * 1.15) * mult * (enemy.boss ? 1.6 : 1) * (meta.dungeon ? 1.2 : 1)));
  const bp = Math.max(won ? 8 : 2, Math.round((6 + (enemy.tier||0)*5 + (enemy.boss?26:0)) * mult * effBonus('bpBonus') * (meta.dungeon ? 1.25 : 1)));
  const rp = won ? Math.round(14 + (enemy.tier||0)*9 + (enemy.boss?35:0) + (meta.floor||0)*2) : Math.round(3 + (enemy.tier||0));
  addCoins(state, coins); addBP(state, bp);
  state.rankPoints += rp;
  const expGain = grantExp(state, c, exp);
  grantJobExp(state, c, won ? 22 + (enemy.tier||0)*8 : 8);
  if (won) {
    state.wins++; state.stats.wins++; state.winStreak++;
    c.record.wins++; c.record.streak++; c.record.bestStreak = Math.max(c.record.bestStreak, c.record.streak);
    grantMaterials(state, { mat_ore:1, evo_stone_R:1, weapon_ore_R:1 });
    if (enemy.tier >= 1) grantMaterials(state, { awaken_crystal_SR:1, mana_crystal_SR:1 });
    if (enemy.boss) {
      state.stats.bossKills++;
      addItem(state, 'mat_proof', 1);
      if (Math.random() < 0.5) addItem(state, 'mat_stone', 1);
      grantMaterials(state, { boss_core_SSR:1, element_gem_SSR:1, job_proof_SSR:1 });
    }
    if (enemy.hidden) { state.stats.hiddenKills++; addItem(state, 'mat_rebirth', 1); grantMaterials(state, { legend_mat_LR:1, boss_core_UR:2 }); }
    bump(state, 'boss', enemy.boss ? 1 : 0);
    bump(state, 'floor', meta.floor ? 1 : 0);
  } else {
    state.losses++; state.stats.losses++; state.winStreak = 0;
    c.record.losses++; c.record.streak = 0;
  }
  state.bestStreak = Math.max(state.bestStreak, state.winStreak);
  state.winStreak = Math.min(state.winStreak, 9999);
  state.stats.battles++;
  bump(state, 'battle', 1);
  if (won) bump(state, 'win', 1);
  bump(state, 'damage', meta.damage || 0);
  restoreFull(state, c);
  const r = { coins, exp: expGain.gain, levels: expGain.levels, bp, rp, streak: state.winStreak, won,
    materials: won ? (enemy.hidden ? ['legend_mat_LR'] : enemy.boss ? ['boss_core_SSR'] : ['evo_stone_R','weapon_ore_R']) : [] };
  checkAchievements(state);
  logEvent(state, `${enemy.name} に${won ? '勝利' : '敗北'}。+${fmt(coins)}コイン / +${fmt(exp)}EXP / +${bp}BP`, won ? 'win' : 'lose');
  return r;
}
export function claimRankReward(state, idx) {
  if (state.rankClaimed.includes(idx)) return { ok:false, msg:'受け取り済みです' };
  if (rankInfo(state).idx < idx) return { ok:false, msg:'ランクが足りません' };
  state.rankClaimed.push(idx);
  const coins = RANKS[idx].reward;
  addCoins(state, coins); addBP(state, Math.round(coins / 20));
  return { ok:true, msg:`${RANKS[idx].name} ランク報酬 +${fmt(coins)}コイン` };
}

/* ---------- ダンジョン・隠し要素 ---------- */
export function hiddenBossUnlocked(state, c) {
  return c.awakening >= 3 && state.stats.bossKills >= 3 && state.dungeon.best >= 10;
}
export function hardDungeonUnlocked(state) { return state.dungeon.best >= 15; }
export function dungeonEnemy(state, floor, hard = false) {
  const pool = ENEMIES.filter(e => !e.boss);
  const base = pool[(floor * 3) % pool.length];
  const isBoss = floor % 5 === 0;
  const bossPool = ENEMIES.filter(e => e.boss && !e.hidden);
  const src = isBoss ? bossPool[Math.floor(floor / 5) % bossPool.length] : base;
  const mul = (src.mul || 1) * (1 + floor * (hard ? 0.11 : 0.065)) * (hard ? 1.55 : 1);
  return {
    ...src,
    id: `dungeon_${hard?'h':'n'}_${floor}`,
    name: `${src.name}（${floor}階）`,
    level: Math.max(3, Math.round(src.level + floor * (hard ? 2.6 : 1.5))),
    mul,
    floor,
    dungeon: true,
  };
}
export function advanceDungeon(state, won, hard) {
  if (!won) return;
  state.dungeon.floor++;
  state.dungeon.best = Math.max(state.dungeon.best, state.dungeon.floor - 1);
  state.stats.floors++;
  bump(state, 'floor', 1);
  if ((state.dungeon.floor - 1) % 5 === 0) {
    addItem(state, 'mat_crystal', hard ? 2 : 1);
    if (hard) addItem(state, 'mat_stardust', 1);
    const tier = Math.min(4, Math.floor((state.dungeon.floor - 1) / 5) + (hard ? 1 : 0));
    const r = MAT_RANKS[tier];
    grantMaterials(state, { [`awaken_crystal_${r}`]:1, [`element_gem_${r}`]:1 });
    if (hard) grantMaterials(state, { [`boss_core_${r}`]:1 });
  }
  checkAchievements(state);
}
export function resetDungeon(state, hard) {
  state.dungeon.floor = 1;
  state.dungeon.active = false;
  state.dungeon.hard = !!hard;
  logEvent(state, hard ? '高難易度ダンジョン「深淵」に挑戦開始。' : 'ダンジョンの挑戦をリセットした。', 'dungeon');
}

/* ---------- 見た目 ---------- */
export const AURAS = [
  { id:'none', name:'なし', color:'transparent', cost:0, req:()=>true },
  { id:'blue', name:'蒼炎', color:'#4fd8ff', cost:500, req:()=>true },
  { id:'gold', name:'光輪', color:'#ffd77a', cost:900, req:s=>rankInfo(s).idx>=1 },
  { id:'violet', name:'紫電', color:'#b98bff', cost:1600, req:s=>s.stats.wins>=10 },
  { id:'rainbow', name:'星虹', color:'#68f7d4', cost:3200, req:s=>maxAwakeningSafe(s)>=3 },
  { id:'void', name:'虚無', color:'#ff6fae', cost:5000, req:s=>s.stats.hiddenKills>=1 },
];
const maxAwakeningSafe = s => Math.max(0, ...s.characters.map(c => c.awakening || 0));
export function buyAura(state, c, id) {
  const a = AURAS.find(x => x.id === id);
  if (!a) return { ok:false, msg:'オーラがありません' };
  if (c.aura === id) return { ok:false, msg:'すでに設定中です' };
  if (!state.characters.some(ch => ch.aura === id) && !state.purchasedAuras?.includes(id)) {
    if (!a.req(state)) return { ok:false, msg:'解放条件を満たしていません' };
    if (state.coins < a.cost) return { ok:false, msg:`${fmt(a.cost)}コインが必要です` };
    addCoins(state, -a.cost, false);
    addCatalog(state.purchasedAuras || (state.purchasedAuras = []), id);
  }
  c.aura = id;
  logEvent(state, `オーラを「${a.name}」に変更した。`, 'look');
  return { ok:true, msg:`オーラを「${a.name}」に変更` };
}
export function setFrame(c, frame) { c.frame = frame; }

/* ---------- CPU敵の生成 ---------- */
export function buildEnemyCombatant(enemy, scale = 1) {
  const job = JOB[enemy.job] || JOB.warrior;
  const mul = (enemy.mul || 1) * scale;
  const lv = enemy.level || 5;
  const g = toCoreStats(job.growth);
  const stats = {
    hp: Math.round((170 + lv * 17 + g.hp * lv * 1.4) * mul),
    mp: Math.round((55 + lv * 3 + g.mp * lv * 0.5) * mul),
    atk: Math.round((18 + lv * 1.5 + g.atk * lv * 0.9) * mul),
    def: Math.round((12 + lv * 1.1 + g.def * lv * 0.8) * mul),
    // 特殊効果用の内部値（基本ステータスとしては表示しない）
    hit: 84, dodge: 4, crit: 4, critDamage: 165, ultimatePower: 0,
    effects: enemy.boss ? { crit:12, damageCut:8, statusGuard:25 } : { crit:4 },
  };
  const rarIdx = Math.min(5, Math.max(0, Math.floor((mul - 0.8) * 2.2)));
  for (const eq of enemy.equipment || []) {
    const def = EQUIPMENT.find(e => e.slot === eq.slot && e.rarity === (eq.rarity || RARITY_ORDER[rarIdx]));
    if (!def) continue;
    const es = equipmentStats({ defId:def.id, enhance:0, enemy:true });
    for (const k of STAT_KEYS) stats[k] += Math.round((es[k] || 0) * 0.75);
    for (const e of es.effects) stats.effects[e.id] = (stats.effects[e.id] || 0) + e.value;
  }
  return stats;
}

export function enemyUnlocked(state, enemy) {
  if (enemy.tutorial) return true;
  if (enemy.hidden) return hiddenBossUnlocked(state, activeChar(state) || blankCharacter());
  if (enemy.boss) return state.stats.wins >= 6 && rankInfo(state).idx >= 1;
  if (enemy.tier >= 1) return state.stats.wins >= 3;
  return true;
}

/* ===========================================================
   チュートリアル（任意開始・途中再開・完了報酬は 1 アカウント 1 回）
   =========================================================== */
export const TUTORIAL_REWARD_PULLS = 30;

/** 装備ガチャ 1 回分のコイン。将来 GACHA_COST が変わっても追従する */
export function equipmentGachaCost() { return GACHA_COST; }
/** 「装備ガチャ 30 連分」を固定値ではなく現在の消費コインから計算 */
export function tutorialRewardCoins() { return equipmentGachaCost() * TUTORIAL_REWARD_PULLS; }

export function defaultTutorial() {
  return {
    version: 1,
    status: 'notOffered',      // notOffered / offered / active / skipped / complete
    step: 1,
    done: [],
    skipped: false,
    completed: false,
    rewardClaimed: false,
    rewardCoins: 0,
    rewardAt: null,
    practicePulls: 0,
    practiceEquip: [],          // 練習ガチャで獲得した装備 uid（消失防止）
    earnedCoins: 0,             // チュートリアル中に獲得したコイン総額
    charLevel: 0,               // チュートリアル時点のキャラ Lv / ランク
    charRank: 'R',
    startSkills: [],            // 開始時点の技・奥義（差分だけ記録）
    startUltimates: [],
    learnedSkills: [],          // チュートリアル中に習得した技
    learnedUltimates: [],       // チュートリアル中に習得した奥義
    flags: {},                  // 各ステップの操作完了フラグ
    startedAt: null,
    updatedAt: null,
    replays: 0,
  };
}
/** 旧セーブ／破損データの補完。報酬受取済みフラグは絶対に消さない */
export function normalizeTutorial(src, state) {
  // 既存オブジェクトの参照を保ったまま補完する。
  // 呼ぶたびに別オブジェクトへ差し替えると、呼び出し元が保持した t への
  // step++ / rewardClaimed などの書き込みが state.tutorial へ反映されない。
  let t = src;
  if (!t || typeof t !== 'object') t = defaultTutorial();
  const d = defaultTutorial();
  for (const k of Object.keys(d)) if (t[k] === undefined) t[k] = d[k];
  if (!t.flags || typeof t.flags !== 'object' || Array.isArray(t.flags)) t.flags = {};
  t.done = Array.isArray(t.done)
    ? t.done.filter(n => Number.isInteger(n) && n >= 1 && n <= TUTORIAL_STEP_COUNT - 1) : [];
  t.practiceEquip = Array.isArray(t.practiceEquip) ? t.practiceEquip.filter(Boolean) : [];
  for (const k of ['startSkills','startUltimates','learnedSkills','learnedUltimates'])
    t[k] = Array.isArray(t[k]) ? t[k].filter(Boolean) : [];
  t.earnedCoins = Number(t.earnedCoins) || 0;
  t.charLevel = Number(t.charLevel) || 0;
  t.charRank = t.charRank || 'R';
  t.practicePulls = Number(t.practicePulls) || 0;
  t.rewardClaimed = !!t.rewardClaimed;
  t.rewardCoins = Number(t.rewardCoins) || 0;
  t.rewardAt = t.rewardAt || null;
  t.completed = !!t.completed || (t.status === 'complete');
  t.skipped = !!t.skipped;
  t.replays = Number(t.replays) || 0;
  const statuses = ['notOffered','offered','active','skipped','complete'];
  if (!statuses.includes(t.status)) t.status = 'notOffered';
  // 既存キャラがいる旧セーブ／未提示セーブには「任意で始められる」選択肢を出す
  if (state?.characters?.length && t.status === 'notOffered'
      && (!src || src.status === 'notOffered')) t.status = 'offered';
  t.step = clamp(Number(t.step) || 1, 1, TUTORIAL_STEP_COUNT);
  if (t.status === 'complete') t.step = TUTORIAL_STEP_COUNT;
  t.version = 1;
  return t;
}
/** チュートリアル中に獲得したコインを記録（報酬とは別に累計） */
export function tutorialAddEarnedCoins(state, amount) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (!t || t.status === 'notOffered' || t.status === 'offered') return;
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (!n) return;
  t.earnedCoins += n;
  t.updatedAt = new Date().toISOString();
}
/** キャラの Lv / ランクと、開始時点から増えた技・奥義を保存（二重記録しない） */
export function tutorialCaptureProgress(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  const c = activeChar(state);
  if (!c) return t;
  t.charLevel = c.level;
  t.charRank = c.rarity || 'R';
  for (const sk of (c.skills || [])) {
    const id = sk.id || sk;
    if (!t.startSkills.includes(id) && !t.learnedSkills.includes(id)) t.learnedSkills.push(id);
  }
  for (const id of (c.ultimateSkills || []))
    if (!t.startUltimates.includes(id) && !t.learnedUltimates.includes(id)) t.learnedUltimates.push(id);
  t.updatedAt = new Date().toISOString();
  return t;
}
export function tutorialOffer(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.status === 'notOffered') { t.status = 'offered'; t.updatedAt = new Date().toISOString(); }
  return t;
}
export function tutorialStart(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  // 完了後の再プレイでは進行だけリセット。報酬受取済み・獲得装備は保持。
  if (t.completed || t.status === 'complete') {
    t.done = []; t.flags = {}; t.step = 1; t.replays++;
  }
  t.status = 'active'; t.skipped = false;
  const c0 = activeChar(state);
  if (!t.startSkills.length && c0) {
    t.startSkills = (c0.skills || []).map(k => k.id || k);
    t.startUltimates = [...(c0.ultimateSkills || [])];
  }
  t.startedAt = t.startedAt || new Date().toISOString();
  t.updatedAt = new Date().toISOString();
  tutorialCaptureProgress(state);
  return { ok:true, msg:'チュートリアルを開始しました' };
}
export function tutorialSkip(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  t.status = 'skipped'; t.skipped = true; t.updatedAt = new Date().toISOString();
  return { ok:true, msg:'チュートリアルをスキップしました（後から再開できます）' };
}
/** 進行状況はそのままに再開（スキップ／一時中断から） */
export function tutorialResume(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.completed) return tutorialStart(state);
  t.status = 'active'; t.skipped = false; t.updatedAt = new Date().toISOString();
  return { ok:true, msg:`チュートリアル STEP ${t.step} から再開しました` };
}
export function tutorialMarkFlag(state, key, value = true) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (!t || !key) return false;
  const changed = t.flags[key] !== value;
  t.flags[key] = value;
  t.updatedAt = new Date().toISOString();
  return changed;
}
/** 実際の操作イベントを進行フラグへ反映する（画面遷移・戦闘など） */
export function tutorialTrack(state, event, p = {}) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.status !== 'active') return false;
  let hit = false;
  const set = k => { if (!t.flags[k]) { t.flags[k] = true; hit = true; } };
  switch (event) {
    case 'nav':
      if (p.to === 'create') set('visitedCreate');
      if (p.to === 'town') set('returnedTown');
      if (p.to === 'gather') set('visitedGather');
      if (p.to === 'facility') {
        if (p.facility === 'nurture') set('visitedNurture');
        if (p.facility === 'forge') set('visitedForge');
        if (p.facility === 'guild' || p.facility === 'training') set('visitedBattle');
      }
      break;
    case 'createFinish': set('visitedCreate'); set('returnedTown'); break;
    case 'levelUp': if (p.levels > 0) set('leveled'); break;
    case 'equip': set('equipped'); break;
    case 'evolve': set('evolved'); break;
    case 'battleAuto': set('autoToggled'); break;
    case 'battleSpeed': set('speedChanged'); break;
    case 'manualSkill': set('manualSkill'); break;
    case 'battleEnd': if (p.won) set('battleWon'); break;
  }
  if (hit) t.updatedAt = new Date().toISOString();
  return hit;
}
export function tutorialStepChecks(state, step = null) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  const n = clamp(step || t.step, 1, TUTORIAL_STEP_COUNT);
  const def = TUTORIAL_STEPS.find(x => x.id === n);
  return (def?.checks || []).map(ch => ({ ...ch, done: !!t.flags[ch.key] }));
}
export function tutorialCanAdvance(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.status !== 'active' || t.step >= TUTORIAL_STEP_COUNT) return false;
  return tutorialStepChecks(state, t.step).every(ch => ch.done);
}
/** 全チェックが揃ったときだけ進む。STEP 5 完了で完了画面へ */
export function tutorialNext(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.status !== 'active') return { ok:false, msg:'チュートリアルが開始されていません' };
  if (t.step >= TUTORIAL_STEP_COUNT) return { ok:false, msg:'最終ステップです' };
  if (!tutorialCanAdvance(state)) return { ok:false, msg:'このステップの操作をすべて体験してください' };
  if (!t.done.includes(t.step)) t.done.push(t.step);
  t.step++;
  t.updatedAt = new Date().toISOString();
  tutorialCaptureProgress(state);
  if (t.step >= TUTORIAL_STEP_COUNT) {
    t.status = 'complete'; t.completed = true;
    logEvent(state, 'チュートリアルを全ステップクリアした！', 'tutorial');
    return { ok:true, completed:true, msg:'チュートリアルクリア！' };
  }
  return { ok:true, completed:false, msg:`STEP ${t.step} へ進みました` };
}
/** 完了報酬。1 アカウント 1 回のみ、全ステップ完了が条件 */
export function tutorialClaimReward(state) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.rewardClaimed) return { ok:false, msg:'報酬はすでに受け取り済みです' };
  if (!t.completed || t.status !== 'complete') return { ok:false, msg:'チュートリアルを最後までクリアしてください' };
  if (t.done.length < TUTORIAL_STEP_COUNT - 1) return { ok:false, msg:'未クリアのステップがあります' };
  const coins = tutorialRewardCoins();       // 固定値ではなく現在のガチャ消費から算出
  addCoins(state, coins);
  tutorialAddEarnedCoins(state, coins);
  tutorialCaptureProgress(state);
  t.rewardClaimed = true; t.rewardCoins = coins;
  t.rewardAt = new Date().toISOString(); t.updatedAt = t.rewardAt;
  logEvent(state, `チュートリアル完了報酬：装備ガチャ ${TUTORIAL_REWARD_PULLS} 連分（${fmt(coins)}コイン）を受け取った。`, 'tutorial');
  return { ok:true, coins, pulls:TUTORIAL_REWARD_PULLS,
    msg:`装備ガチャ ${TUTORIAL_REWARD_PULLS} 連分（${fmt(coins)}コイン）を獲得！` };
}

/* ---------- チュートリアル専用の練習機能（通常ガチャ・天井に影響しない） ---------- */
export function tutorialPracticePull(state, c = null) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  if (t.status !== 'active') return { ok:false, msg:'チュートリアル実行中のみ利用できます' };
  const ch = c || activeChar(state);
  const types = ch ? (JOB[ch.jobId]?.weapons || []) : [];
  const pool = EQUIPMENT.filter(e => e.slot === 'weapon' && !e.godOnly
    && ['N','R','E'].includes(e.rarity) && (!types.length || types.includes(e.type)));
  const def = rand(pool.length ? pool : EQUIPMENT.filter(e => e.slot === 'weapon'));
  const inst = addEquipment(state, def.id);   // コイン消費なし / pity 変更なし / 通常排出率変更なし
  t.practicePulls++;
  t.practiceEquip.push(inst.uid);
  tutorialMarkFlag(state, 'practiceGacha');
  logEvent(state, `練習用ガチャ（無料）で ${def.name} を獲得。所持品に追加した。`, 'tutorial');
  return { ok:true, uid:inst.uid, defId:def.id, name:def.name, rarity:def.rarity,
    msg:`練習用ガチャ：${def.name} を獲得！（無料・所持品に追加）` };
}
export function tutorialEquipPractice(state, c = null) {
  const t = state.tutorial = normalizeTutorial(state.tutorial, state);
  const ch = c || activeChar(state);
  if (!ch) return { ok:false, msg:'キャラクターがいません' };
  const uidv = (t.practiceEquip || []).find(u => findInstance(state, u));
  if (!uidv) return { ok:false, msg:'まず練習用ガチャを引いてください' };
  const inst = findInstance(state, uidv);
  if (!equipItem(state, ch, uidv, inst && instanceDef(inst).slot)) return { ok:false, msg:'この武器は装備できません' };
  tutorialMarkFlag(state, 'equipped');
  return { ok:true, msg:`${instanceDef(inst).name} を装備しました。攻撃力が上がりました` };
}
export function tutorialGrantExp(state, c = null) {
  const ch = c || activeChar(state);
  if (!ch) return { ok:false, msg:'キャラクターがいません' };
  const need = Math.max(80, xpForLevel(ch.level) - ch.exp + 5);
  const r = grantExp(state, ch, need);
  tutorialCaptureProgress(state);
  tutorialMarkFlag(state, 'leveled', true);
  return { ok:true, levels:r.levels, gain:r.gain,
    msg:`練習で ${fmt(r.gain)} EXP を獲得${r.levels ? ` / Lv.${r.levels}アップ！` : ''}。ステータス画面で 4 つの能力値を確認しよう` };
}
export function tutorialGather(state, c = null) {
  const ch = c || activeChar(state);
  const mats = {};
  for (const m of (RANK_REQUIREMENTS.SR || [])) mats[m.id] = (mats[m.id] || 0) + m.n;
  grantMaterials(state, mats);
  // 進化条件（Lv.20 / コイン）もチュートリアル用の練習ステージで満たす
  if (ch) {
    let guard = 0;
    while (ch.level < 20 && ch.level < levelCap(ch) && guard++ < 30) {
      grantExp(state, ch, Math.max(20, xpForLevel(ch.level) - ch.exp + 2));
    }
  }
  if (state.coins < 3000) { const add = 3000 - state.coins; addCoins(state, add); tutorialAddEarnedCoins(state, add); }
  tutorialCaptureProgress(state);
  tutorialMarkFlag(state, 'gathered', true);
  tutorialMarkFlag(state, 'visitedGather', true);
  logEvent(state, 'チュートリアル：素材集めステージで進化素材・EXP・コインを獲得した。', 'tutorial');
  return { ok:true, mats, msg:'進化素材を獲得！育成の間 →「進化」から R → SR へランクアップできます' };
}
