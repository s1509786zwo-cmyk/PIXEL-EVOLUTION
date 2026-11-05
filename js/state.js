/* ===========================================================
   オリキャラファイターズ / セーブ・進行・成長ロジック
   =========================================================== */
import {
  VERSION, MAX_LEVEL_BASE, RARITIES, RARITY, RARITY_ORDER, STAT_KEYS,
  SKILLS, SKILL, JOB, JOBS, EQUIPMENT, EQUIP_BY_ID, ITEM, ITEMS, ENEMIES, ENEMY,
  RANKS, QUESTS, ACHIEVEMENTS, TITLES, TITLE, EXCHANGE, STYLES, SLOTS,
  AWAKENING_NAMES, collectedSkills, CHAR_RARITIES, CHAR_RARITY, CHAR_RARITY_ORDER,
  charRankIndex, EVOLUTION_RULES, EVOLUTION_BY_FROM, RATE_TOTAL,
} from './data.js?v=2';
import { MATERIAL_ITEMS, MATERIAL_BY_ID, MAT_RANKS, MAT_RANK_INFO, RANK_REQUIREMENTS, materialUpgradeTarget } from './materials.js?v=2';

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
  if (merged.lastDaily !== nowDate()) resetDailyQuests(merged);
  return merged;
}

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
    settings: { sfx: true, bgm: false, animSpeed: 1, autosave: true },
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

export function equipmentStats(inst) {
  const def = instanceDef(inst);
  if (!def) return { ...emptyStats(), effects: [] };
  const rankMult = CHAR_RARITY[instanceRank(inst)]?.mult || 1;
  const m = (1 + (inst.enhance || 0) * 0.11) * rankMult;
  const out = { ...emptyStats(), effects: [] };
  for (const k of STAT_KEYS) out[k] = Math.round((def.stats[k] || 0) * m + (inst.enhance || 0) * (k === 'hp' ? 6 : k === 'mp' ? 2 : 1));
  out.effects = (def.stats.effects || []).map(e => ({ ...e, value: Math.round(e.value * (1 + (inst.enhance || 0) * 0.06) * rankMult) }));
  // ランク進化で武器の種類・形状はそのままに、ランク固有の特殊効果を追加
  const ri = charRankIndex(instanceRank(inst));
  if (ri > 0) {
    const pool = ['crit','lifesteal','mpRegen','hpRegen','counter','ignoreDef','extraStrike','damageCut'];
    const base = { crit:4, lifesteal:4, mpRegen:3, hpRegen:2, counter:6, ignoreDef:8, extraStrike:5, damageCut:4 };
    const seed = [...String(def.id)].reduce((a,ch)=>a+ch.charCodeAt(0),0);
    const id = pool[(seed + ri) % pool.length];
    out.effects.push({ id, value: Math.max(1, Math.round(base[id] * ri * rankMult)) });
    if (ri >= 3) out.effects.push({ id:'crit', value: Math.max(1, Math.round(3 * ri * rankMult)) });
  }
  return out;
}
export function instanceRarity(inst) { return instanceDef(inst)?.rarity || 'N'; }
export function findInstance(state, uidv) { return state.inventory.equipment.find(e => e.uid === uidv); }

export function equippedInstances(c, state) {
  return SLOTS.map(slot => findInstance(state, c.equipment[slot])).filter(Boolean);
}

export function computeStats(c, state) {
  const job = JOB[c.jobId] || JOB.warrior;
  const style = STYLES.find(s => s.id === c.styleId) || STYLES[0];
  const lv = c.level - 1;
  const s = {};
  for (const k of STAT_KEYS) {
    s[k] = 30 + (k === 'hp' ? 100 : k === 'mp' ? 30 : k === 'acc' ? 80 : k === 'eva' ? 5 : 10)
      + job.growth[k] * lv + (c.alloc[k] || 0) + (style.bonus[k] || 0);
  }
  // 装備
  for (const inst of equippedInstances(c, state)) {
    const es = equipmentStats(inst);
    for (const k of STAT_KEYS) s[k] += es[k] || 0;
  }
  // 称号
  const title = TITLE[c.titleId] || TITLE.t_none;
  for (const k of STAT_KEYS) s[k] += title.bonus[k] || 0;
  // 覚醒・進化・転生ボーナス（乗算）
  const rankMult = CHAR_RARITY[c.rarity || 'R']?.mult || 1;
  const mult = (1 + c.awakening * 0.13 + c.evolution * 0.05 + (c.rebirth || 0) * 0.12) * rankMult;
  for (const k of STAT_KEYS) s[k] = Math.round(s[k] * (k === 'acc' || k === 'eva' ? 1 + (mult - 1) * 0.25 : mult));
  s.hp = Math.max(120, Math.round(s.hp));
  s.mp = Math.max(20, Math.round(s.mp));
  s.acc = clamp(s.acc, 30, 240); s.eva = clamp(s.eva, 0, 90);
  // 特殊効果を集約
  s.effects = aggregateEffects(c, state, title);
  return s;
}

function aggregateEffects(c, state, title) {
  const acc = {};
  const push = (id, v) => { acc[id] = (acc[id] || 0) + v; };
  for (const inst of equippedInstances(c, state)) {
    for (const e of equipmentStats(inst).effects) push(e.id, e.value);
  }
  for (const [k, v] of Object.entries(title.bonus)) if (!STAT_KEYS.includes(k)) push(k, v);
  if (c.awakening >= 2) push('crit', 3 + c.awakening * 2);
  if (c.awakening >= 4) push('lifesteal', 4);
  if (c.styleId === 'critical') push('crit', 6);
  return acc;
}

export function powerScore(c, state) {
  const s = computeStats(c, state);
  return Math.round(s.hp / 4 + s.mp / 5 + s.atk * 2 + s.def * 1.8 + s.spd * 1.5 + s.mag * 1.8 + (s.acc + s.eva) * 1.2 + c.awakening * 120 + charRankIndex(c.rarity) * 160 + c.level * 8);
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
  c.alloc[key] = (c.alloc[key] || 0) + n * (key === 'hp' ? 12 : key === 'mp' ? 6 : key === 'acc' || key === 'eva' ? 1 : 3);
  const st = computeStats(c, state);
  c.hp = Math.min(st.hp, c.hp + (key === 'hp' ? n * 12 : 0));
  c.mp = Math.min(st.mp, c.mp + (key === 'mp' ? n * 6 : 0));
  c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  return true;
}

export function resetAllocs(state, c) {
  if (state.coins < 1000) return { ok:false, msg:'1,000コインが必要です' };
  const per = k => k === 'hp' ? 12 : k === 'mp' ? 6 : (k === 'acc' || k === 'eva') ? 1 : 3;
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
  if (r.level && c.level < r.level) return false;
  if (r.awakening && c.awakening < r.awakening) return false;
  if (r.jobs) for (const [id, lv] of Object.entries(r.jobs)) if ((c.jobLevels[id] || 0) < lv) return false;
  return true;
}
export function jobReqText(job) {
  if (!job.req) return '初期から選択可能';
  const r = job.req, p = [];
  if (r.level) p.push(`Lv.${r.level}`);
  if (r.awakening) p.push(`覚醒${r.awakening}段階`);
  if (r.jobs) for (const [id, lv] of Object.entries(r.jobs)) p.push(`${JOB[id]?.name || id} Lv.${lv}`);
  return p.join(' / ');
}
export function changeJob(state, c, jobId) {
  const job = JOB[jobId];
  if (!job || !jobUnlocked(state, c, job)) return { ok:false, msg:'解放条件を満たしていません' };
  if (c.jobId === jobId) return { ok:false, msg:'すでに就いている職業です' };
  const cost = job.tier * 500;
  if (state.coins < cost) return { ok:false, msg:`コインが ${fmt(cost)} 必要です` };
  addCoins(state, -cost, false);
  c.jobId = jobId;
  if (!c.jobLevels[jobId]) c.jobLevels[jobId] = 1;
  if (!c.jobExp[jobId]) c.jobExp[jobId] = 0;
  addCatalog(state.catalog.jobs, jobId);
  // 就いた時点で習得できる技
  job.skills.slice(0, Math.max(1, job.tier + 1)).forEach(id => learnSkillDirect(c, state, id, true));
  logEvent(state, `${c.name}が「${job.name}」に転職した。`, 'job');
  checkAchievements(state);
  return { ok:true, msg:`${job.name}になった！（-${fmt(cost)}コイン）` };
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
  addCatalog(state.catalog.skills, id);
  state.stats.skillLearned++;
  bump(state, 'skill', 1);
  if (!silent) logEvent(state, `技「${SKILL[id].name}」を習得した。`, 'skill');
  return true;
}
export function learnSkill(state, c, id, cost, useBook) {
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
  const list = unknown.length ? unknown : pool.filter(s => !hasSkill(c, s.id));
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
  const afterStats = computeStats({ ...c, rarity: rule.to }, state);
  return { max:false, rule, mats, reasons, ok:reasons.length === 0, beforeStats, afterStats,
    nextRank: CHAR_RARITY[rule.to], skill: SKILL[rule.skill] };
}
export function evolveCharacter(state, c) {
  const p = evolutionPreview(state, c);
  if (p.max) return { ok:false, msg:'最終ランク LR です' };
  if (!p.ok) return { ok:false, msg:`条件が揃っていません：${p.reasons.join(' / ')}` };
  const rule = p.rule;
  addCoins(state, -rule.coins, false);
  for (const m of p.mats) removeItem(state, m.id, m.n);
  // 元画像・名前・職業・技・装備・育成記録は一切変更しない
  c.rarity = rule.to;
  c.statPoints += 6;
  learnSkillDirect(c, state, rule.skill);
  state.stats.evolutions++;
  restoreFull(state, c);
  logEvent(state, `「${c.name}」が ${rule.from} → ${rule.to} に進化！能力値が大幅に上昇し「${SKILL[rule.skill].name}」を習得。`, 'evolution');
  checkAchievements(state);
  return { ok:true, msg:`${rule.from} → ${rule.to} 進化成功！ ${rule.gain}`, rule,
    gains: STAT_KEYS.filter(k => p.afterStats[k] > p.beforeStats[k]).map(k => ({ key:k, value:p.afterStats[k]-p.beforeStats[k] })) };
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
  return { ok:true, msg:`転生完了！永続ボーナス+12%、ステータスポイント+15` };
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
  if (def.slot === 'weapon' && !JOB[c.jobId].weapons.includes(def.type)) {
    return false;
  }
  c.equipment[slot] = inst.uid;
  const st = computeStats(c, state);
  c.hp = Math.min(c.hp, st.hp); c.mp = Math.min(c.mp, st.mp);
  c.hpMaxCache = st.hp; c.mpMaxCache = st.mp;
  return true;
}
export function unequip(state, c, slot) {
  c.equipment[slot] = null;
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
  const results = [], pityLog = [];
  const slots = kind === 'weapon' ? ['weapon'] : ['armor','accessory','ornament'];
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
    const pool = EQUIPMENT.filter(e => slots.includes(e.slot) && e.rarity === rarity);
    const def = rand(pool.length ? pool : EQUIPMENT.filter(e => slots.includes(e.slot)));
    const inst = addEquipment(state, def.id);
    if (['L','M','S'].includes(rarity)) state.stats.gachaLegendary++;
    const entry = { at:new Date().toISOString(), kind, rarity, defId:def.id, name:def.name,
      legendaryBefore:beforeL, mythicBefore:beforeM, forced };
    pity.history.push(entry);
    if (pity.history.length > 60) pity.history.shift();
    pityLog.push(forced ? `${def.name}（${forced}）` : def.name);
    results.push(inst);
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
  logEvent(state, `${kind === 'weapon' ? '武器' : '装備'}ガチャを${count}回引いた。${pityLog.filter((_,i)=>false).join('')}`, 'gacha');
  checkAchievements(state);
  return { ok:true, results, bonusMaterials, msg:`${count}連ガチャ完了！` };
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
  addBP(state, -ex.cost);
  if (ex.kind === 'skill') learnSkillDirect(c, state, ex.skill);
  if (ex.kind === 'item') grantMaterials(state, { [ex.item]: ex.count || 1 });
  if (ex.kind === 'title') { addCatalog(state.titles, ex.title); c.titleId = ex.title; }
  if (ex.kind === 'equip') {
    const pool = EQUIPMENT.filter(e => e.rarity === ex.rarity);
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
  { id:'atk', name:'筋力トレーニング', icon:'⚔', desc:'攻撃 +3 / EXP・熟練度', stat:'atk' },
  { id:'def', name:'防御鍛錬', icon:'🛡', desc:'防御 +3 / EXP・熟練度', stat:'def' },
  { id:'spd', name:'敏捷走練', icon:'➤', desc:'速度 +3 / EXP・熟練度', stat:'spd' },
  { id:'mag', name:'魔力冥想', icon:'✧', desc:'魔力 +3 / EXP・熟練度', stat:'mag' },
  { id:'acc', name:'命中訓練', icon:'◎', desc:'命中 +1 / EXP・熟練度', stat:'acc' },
  { id:'eva', name:'回避訓練', icon:'✺', desc:'回避 +1 / EXP・熟練度', stat:'eva' },
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
  const base = enemy.level * 14 + (enemy.tier || 0) * 90 + (enemy.boss ? 260 : 0) + (meta.floor ? meta.floor * 22 : 0);
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
  const stats = {
    hp: Math.round((170 + lv * 17 + job.growth.hp * lv * 1.4) * mul),
    mp: Math.round((55 + lv * 3 + job.growth.mp * lv * 0.5) * mul),
    atk: Math.round((18 + lv * 1.5 + job.growth.atk * lv * 0.9) * mul),
    def: Math.round((12 + lv * 1.1 + job.growth.def * lv * 0.8) * mul),
    spd: Math.round((14 + lv * 0.5 + job.growth.spd * lv * 0.45) * mul),
    mag: Math.round((14 + lv * 1.1 + job.growth.mag * lv * 0.8) * mul),
    acc: Math.round(86 + lv * 0.4 + job.growth.acc * lv),
    eva: Math.round(5 + lv * 0.22 + job.growth.eva * lv),
    effects: enemy.boss ? { crit:12, damageCut:8, statusGuard:25 } : { crit:4 },
  };
  const rarIdx = Math.min(5, Math.max(0, Math.floor((mul - 0.8) * 2.2)));
  for (const eq of enemy.equipment || []) {
    const def = EQUIPMENT.find(e => e.slot === eq.slot && e.rarity === (eq.rarity || RARITY_ORDER[rarIdx]));
    if (!def) continue;
    const es = equipmentStats({ defId:def.id, enhance:0 });
    for (const k of STAT_KEYS) stats[k] += Math.round((es[k] || 0) * 0.75);
    for (const e of es.effects) stats.effects[e.id] = (stats.effects[e.id] || 0) + e.value;
  }
  return stats;
}

export function enemyUnlocked(state, enemy) {
  if (enemy.hidden) return hiddenBossUnlocked(state, activeChar(state) || blankCharacter());
  if (enemy.boss) return state.stats.wins >= 6 && rankInfo(state).idx >= 1;
  if (enemy.tier >= 1) return state.stats.wins >= 3;
  return true;
}
