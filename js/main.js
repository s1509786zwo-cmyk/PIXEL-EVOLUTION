/* ===========================================================
   オリキャラファイターズ / アプリ本体・入力・演出
   =========================================================== */
import * as D from './data.js?v=2';
import * as S from './state.js?v=2';
import * as P from './pixel.js?v=2';
import { Battle } from './battle.js?v=2';
import { renderScreen, imageFilter, imageTransform, e } from './ui.js?v=2';

const app = {
  screen: 'title', params: {}, tabs: {}, draft: null, look: null, compare: false,
  battle: null, result: null, enemySprites: {}, toast: '',
  selectedEquip: null, selectedSynth: [], lastPull: [], enemyGroup: 'normal',
  skillFilter: 'all', skillOffset: 0, equipSlot: 'all', codexTab: 0, battleTab: 'skill',
  confirmReset: false, charName: '', started: false,
  materialDetail: null, evolveEquip: null, lastBonus: [],
  gacha: null, gachaRatesDetail: false, gachaItemDetail: null,
  jobChangeOffer: null, tutorialHidden: false,
};
let state = S.newState();
let toastTimer = null, regenTimer = null;
let audioCtx = null, bgmTimer = null;

/* ---------------- 基本 ---------------- */
const $ = id => document.getElementById(id);
function render() {
  $('app').innerHTML = renderScreen(app, state);
  initAfterRender();
  consumeLevelUp();
}
function save(immediate = false) { S.saveState(state, immediate); }
function toast(msg, kind = 'info') {
  app.toast = msg;
  const el = $('toast');
  if (el) { el.textContent = msg; el.className = `toast show ${kind}`; }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    app.toast = '';
    const t = $('toast'); if (t) t.className = 'toast';
  }, 3600);
}
function commit(msg, ok = true) {
  if (msg) toast(msg, ok ? 'info' : 'error');
  save();
  render();
}
async function navigate(screen, params = {}) {
  if (screen === 'appearance') await prepareLook();
  app.screen = screen;
  app.params = { ...params };
  if (params.facility) app.params.facility = params.facility;
  if (params.tab !== undefined && params.facility) app.tabs[params.facility] = Number(params.tab);
  if (params.codexTab !== undefined) app.codexTab = Number(params.codexTab);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function initDraft() {
  const saved = state.draftSave;
  app.draft = {
    step: 1, image: null, original: '', sprite: '', meta: null, width: 0, height: 0,
    settings: S.defaultImageSettings(), transparentData: '',
    name: '', jobId: 'warrior', weaponType: '剣', styleId: 'balanced', frame: 'gold',
  };
  if (saved?.original) {
    Object.assign(app.draft, {
      original:saved.original, sprite:saved.original, name:saved.name || '',
      settings:{ ...S.defaultImageSettings(), ...(saved.imageSettings||{}) },
      transparentData:saved.transparentData || '', jobId:saved.jobId||'warrior',
      weaponType:saved.weaponType||'剣', styleId:saved.styleId||'balanced', frame:saved.frame||'gold',
      width:saved.width||0, height:saved.height||0, meta:{ name:'保存済みの下書き' },
    });
  }
  app.compare = false;
}
async function prepareLook() {
  const c = S.activeChar(state);
  if (!c) return;
  if (app.look && app.look.charId === c.id && app.look.original === c.original) return;
  const base = { charId:c.id, original:c.original, sprite:c.original,
    settings:{ ...S.defaultImageSettings(), ...(c.imageSettings || {}) },
    transparentData:c.transparentData || '', meta:null, width:0, height:0 };
  try {
    const { image } = await P.loadImageURL(c.original);
    app.look = { ...base, image };
  } catch (err) {
    app.look = { ...base, image: null };
    toast('元画像を読み込めませんでした。差し替えてください', 'error');
  }
  if (app.look.settings.transparent && !app.look.transparentData) await refreshTransparency('look');
}
function srcObj(target) { return target === 'look' ? app.look : app.draft; }

function ensureEnemySprites() {
  for (const en of D.ENEMIES) if (!app.enemySprites[en.id]) app.enemySprites[en.id] = P.makeEnemySprite(en);
}

function initAfterRender() {
  const t = $('toast'); if (t && app.toast) t.className = `toast show`;
  if (app.screen === 'create') initEditor('draftStage', 'draft');
  if (app.screen === 'appearance') initEditor('lookStage', 'look');
  const log = $('logScroll'); if (log) log.scrollTop = log.scrollHeight;
}

/* ---------------- 元画像の非破壊編集 ---------------- */
/** 背景透過は元画像を書き換えず、別の透過PNGとしてキャッシュする */
async function refreshTransparency(target) {
  const o = srcObj(target); if (!o) return;
  if (!o.settings.transparent) { o.transparentData = ''; updateImagePreview(target); return; }
  if (o.transparentData || !o.image) { updateImagePreview(target); return; }
  try {
    const res = P.makeTransparentImage(o.image, 30);
    o.transparentData = res.dataURL;
    updateImagePreview(target);
  } catch (err) {
    console.warn('透過処理をスキップ', err);
    toast('この画像は背景透過に対応できませんでした', 'error');
    o.settings.transparent = false;
    render();
  }
}
function updateImagePreview(target) {
  const o = srcObj(target); if (!o) return;
  const set = { ...S.defaultImageSettings(), ...o.settings };
  const stage = $(target === 'look' ? 'lookStage' : 'draftStage');
  const imgs = stage ? stage.querySelectorAll('.char-img') : [];
  const src = (set.transparent && o.transparentData) ? o.transparentData : (o.original || o.sprite || '');
  for (const img of imgs) {
    if (src) img.src = src;
    img.style.filter = imageFilter(set);
    img.style.transform = imageTransform(set, 'editor');
    img.style.transformOrigin = set.fit === 'face' ? 'center 22%' : 'center center';
    const st = img.closest('.char-stage');
    if (st) st.className = st.className.replace(/fit-\w+/, `fit-${set.fit === 'face' ? 'face' : 'full'}`);
  }
  const z = $(`zoom_${target}`); if (z) z.textContent = `${Math.round(set.scale * 100)}%`;
  const out = $(`out_${target}_scale`); if (out) out.textContent = set.scale.toFixed(2);
}
function syncSettingInputs(target) {
  const o = srcObj(target); if (!o) return;
  const set = { ...S.defaultImageSettings(), ...o.settings };
  for (const [k,v] of Object.entries(set)) {
    const el = document.querySelector(`[data-target="${target}"][data-setting="${k}"]`);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
    const out = $(`out_${target}_${k}`);
    if (out) out.textContent = typeof v === 'number' ? (String(el.step).includes('.') ? Number(v).toFixed(2) : v) : v;
  }
  const z = $(`zoom_${target}`); if (z) z.textContent = `${Math.round(set.scale*100)}%`;
}
/** プレビューのドラッグ / ホイールで位置・拡大率を調整 */
function initEditor(stageId, target) {
  const stage = $(stageId), o = srcObj(target);
  if (!stage || !o?.original) return;
  stage.style.touchAction = 'none';
  let dragging = false, sx = 0, sy = 0, base = null;
  stage.addEventListener('pointerdown', ev => {
    if (ev.target.closest('button, input, label')) return;
    dragging = true; sx = ev.clientX; sy = ev.clientY;
    base = { x:o.settings.offsetX||0, y:o.settings.offsetY||0 };
    try { stage.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  stage.addEventListener('pointermove', ev => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    o.settings.offsetX = Math.round(S.clamp(base.x + (ev.clientX-sx)/Math.max(1,rect.width)*100, -40, 40));
    o.settings.offsetY = Math.round(S.clamp(base.y + (ev.clientY-sy)/Math.max(1,rect.height)*100, -40, 40));
    updateImagePreview(target); syncSettingInputs(target);
  });
  const stop = () => { dragging = false; };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.addEventListener('wheel', ev => {
    if (!o.original) return;
    ev.preventDefault();
    o.settings.scale = S.clamp((o.settings.scale||1) * (ev.deltaY < 0 ? 1.06 : 0.94), 0.5, 2.5);
    updateImagePreview(target); syncSettingInputs(target);
  }, { passive:false });
}
function updateSetting(el, target, key) {
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'range' || el.type === 'number') v = Number(el.value);
  else v = el.value;
  if (target === 'settings') {
    state.settings[key] = v; save();
    if (key === 'autoUltimate' && app.battle) app.battle.setAutoUltimate(v);
  }
  else if (target === 'battle') {
    // 戦闘中の表示サイズ変更は廃止。戦闘開始前に「見た目の変更」で設定する。
    return;
  } else {
    const o = srcObj(target); if (!o) return;
    o.settings[key] = v;
    if (key === 'transparent') refreshTransparency(target);
    updateImagePreview(target);
  }
  const out = $(`out_${target}_${key}`);
  if (out) out.textContent = typeof v === 'number' ? (String(el.step).includes('.') ? Number(v).toFixed(2) : v) : v;
  const z = $(`zoom_${target}`);
  if (z && key === 'scale') z.textContent = `${Math.round(v*100)}%`;
}

async function handleFile(el) {
  const kind = el.dataset.file;
  try {
    if (kind === 'create' || kind === 'appearance') {
      const r = await P.readImageFile(el.files?.[0]);
      if (kind === 'create') {
        if (!app.draft) initDraft();
        const d = app.draft;
        d.image = r.image; d.original = r.dataURL; d.sprite = r.dataURL; d.meta = { name:r.name };
        d.width = r.width; d.height = r.height; d.transparentData = '';
        toast(`画像を読み込みました（${r.width} × ${r.height}）`);
        render();
        if (d.settings.transparent) await refreshTransparency('draft');
      } else {
        if (!app.look) await prepareLook();
        const L = app.look;
        L.image = r.image; L.original = r.dataURL; L.sprite = r.dataURL;
        L.meta = { name:r.name }; L.width = r.width; L.height = r.height; L.transparentData = '';
        render();
        if (L.settings.transparent) await refreshTransparency('look');
        toast('元画像を差し替えました（育成データは保持されます）');
      }
    } else if (kind === 'import') {
      const text = await el.files?.[0]?.text();
      if (!text) throw new Error('空のファイルです');
      const data = S.importSave(text);
      state = data;
      app.confirmReset = false; app.look = null; app.materialDetail = null;
      await S.saveState(state, true);
      ensureEnemySprites();
      await navigate('town');
      toast('セーブデータを読み込みました');
    }
  } catch (err) {
    console.error(err);
    toast(err.message || 'ファイルを処理できませんでした', 'error');
  } finally { el.value = ''; }
}

/* ---------------- レベルアップ・進化の演出 ---------------- */
function consumeLevelUp() {
  const info = state.pendingLevelUp;
  if (!info) return;
  delete state.pendingLevelUp;
  showLevelUpFx(info);
}
function showLevelUpFx(info) {
  const layer = $('fx-layer'); if (!layer) return;
  const el = document.createElement('div');
  el.className = 'fx-levelup';
  el.innerHTML = `<div class="lv-title">LEVEL UP!</div><div class="lv-nums">Lv.${info.from} → <b>Lv.${info.to}</b></div>
    <div class="lv-stats">${info.gains.slice(0,4).map(g=>`<span>${e(D.STAT_NAMES[g.key]||g.key)} +${g.value}</span>`).join('')}</div>
    <div class="lv-sub">ステータスポイント +${4*(info.to-info.from)} ／ HP・MP 全回復</div>`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 2600);
  sfx('ok');
}
function showEvolutionFx(rank, label = '') {
  const layer = $('fx-layer'); if (!layer) return;
  const el = document.createElement('div');
  el.className = `fx-evolution rank-${rank}`;
  el.innerHTML = `<div class="evo-fx-ring"></div><div class="evo-fx-rays"></div>
    <div class="evo-fx-title">${e(label || 'EVOLUTION')}</div><div class="evo-fx-rank">${e(rank)}</div>
    <div class="evo-fx-sub">元画像・レベル・職業・技・装備・戦績はそのまま</div>`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), rank === 'LR' ? 3800 : 2600);
  sfx('win');
}

/* ---------------- 効果音・環境音 ---------------- */
function ac() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq, dur = 0.09, type = 'sine', vol = 0.035, delay = 0) {
  const ctx = ac(); if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination); osc.start(t0); osc.stop(t0 + dur + 0.02);
}
function sfx(kind) {
  if (!state.settings.sfx) return;
  if (kind === 'click') tone(520, 0.07, 'triangle', 0.022);
  if (kind === 'ok') { tone(660,0.1,'sine',0.03); tone(880,0.13,'sine',0.025,0.09); }
  if (kind === 'error') tone(190, 0.16, 'sawtooth', 0.025);
  if (kind === 'win') { [523,659,784,1046].forEach((f,i)=>tone(f,0.22,'triangle',0.032,i*0.12)); }
  if (kind === 'lose') { [330,262,196].forEach((f,i)=>tone(f,0.25,'sine',0.03,i*0.15)); }
  if (kind === 'hit') tone(140, 0.07, 'square', 0.02);
  if (kind === 'ultimate') {
    [196,262,330,392,523,659,784,1046].forEach((f,i)=>tone(f,0.34,'triangle',0.032,i*0.085));
    tone(1046,0.75,'sine',0.026,0.7);
  }
}
window.__OCF_ULTIMATE_SFX__ = () => sfx('ultimate');
/* ---------------- ガチャ演出（結果は startGachaPresentation 前に確定済み） ---------------- */
const GACHA_BASE_MS = { N:520, R:700, E:920, L:1280, M:1650, S:2250 };
function gachaSfx(rarity) {
  if (!state.settings.sfx) return;
  const sets = {
    N: [[330,.10,'sine',.020,0],[440,.10,'sine',.014,.10]],
    R: [[392,.12,'triangle',.026,0],[494,.14,'triangle',.022,.11],[587,.20,'sine',.018,.22]],
    E: [[349,.14,'triangle',.028,0],[440,.16,'triangle',.024,.12],[523,.20,'sine',.022,.24],[698,.26,'sine',.018,.36]],
    L: [[523,.22,'triangle',.032,0],[659,.24,'triangle',.030,.13],[784,.28,'sine',.028,.26],[1046,.40,'sine',.026,.40],[1318,.48,'triangle',.020,.56]],
    M: [[261,.32,'sawtooth',.020,0],[392,.32,'triangle',.028,.15],[523,.34,'triangle',.030,.30],[659,.38,'sine',.028,.45],[784,.42,'sine',.026,.60],[1046,.52,'triangle',.024,.76],[1318,.66,'sine',.022,.92]],
    S: [[220,.55,'sine',.022,0],[277,.55,'sine',.020,.20],[330,.55,'triangle',.022,.40],[415,.60,'sine',.022,.60],[554,.65,'triangle',.024,.80],[659,.72,'sine',.026,1.00],[830,.85,'sine',.024,1.22],[1108,1.05,'triangle',.022,1.45],[1318,1.30,'sine',.022,1.70]],
  };
  for (const [f,d,t,v,delay] of (sets[rarity] || sets.N)) tone(f,d,t,v,delay);
}
function gachaGuaranteeSfx(tier) {
  if (!state.settings.sfx || !tier) return;
  const base = { N:330, R:392, E:440, L:523, M:587, S:659 }[tier] || 392;
  [0,1,2].forEach(i => tone(base * Math.pow(1.26, i), .18, 'triangle', .026, i * .10));
}
function clearGachaTimers(g) {
  for (const t of (g.timers || [])) clearTimeout(t);
  g.timers = [];
}
function scheduleGacha(g, ms, fn) {
  const t = setTimeout(() => {
    g.timers = (g.timers || []).filter(x => x !== t);
    if (app.gacha !== g) return;   // 古い演出のタイマーは発火させない
    fn();
  }, ms);
  (g.timers || (g.timers = [])).push(t);
}
/** 排出結果 details だけから確定演出を決める（必ず実際の結果と一致する） */
function startGachaPresentation(r, kind, count) {
  const details = (r.details || []).slice();
  const order = D.RARITY_ORDER;
  const maxIdx = details.length ? Math.max(...details.map(d => order.indexOf(d.rarity))) : 0;
  const forced = details.find(d => d.forced);
  let guarantee = { on:false, tier:'N', reason:'' };
  if (forced) {
    guarantee = { on:true, tier:forced.forced === 'ミシック天井' ? 'M' : 'L', reason:'天井確定（独立カウンタ）' };
  } else if (maxIdx >= 1 && Math.random() < 0.35) {
    // 確定演出が出ない回でも高レアリティは普通に出る（35% でのみ発生）
    guarantee = { on:true, tier:order[maxIdx], reason:'確定演出（結果から判定）' };
  }
  const g = {
    phase:'intro', details, index:0, kind, count, guarantee,
    skipped:false, preReveal:false, banner:r.banner, bannerInfo:r.bannerInfo,
    bonus:r.bonusMaterials || [], timers:[],
  };
  app.gacha = g;
  render();
  if (guarantee.on) gachaGuaranteeSfx(guarantee.tier);
  const speed = Math.max(0.5, state.settings.animSpeed || 1);   // 「短い間」＋設定でさらに短縮
  const introMs = Math.round((guarantee.on && ['M','S'].includes(guarantee.tier) ? 1900 : 1400) / speed);
  scheduleGacha(g, introMs, () => beginReveal(g));
}
function beginReveal(g) {
  if (!g.details.length) { g.phase = 'result'; render(); return; }
  g.index = 0;
  startRevealItem(g);
}
function revealMs(g, d) {
  let ms = GACHA_BASE_MS[d.rarity] || 600;
  if (g.count === 10) ms = Math.max(300, Math.round(ms * 0.62));   // 10連でも長くなりすぎない
  if (g.index === g.details.length - 1) ms += 450;                  // 最後の1体はより豪華に
  return Math.max(180, Math.round(ms / Math.max(0.5, state.settings.animSpeed || 1)));
}
function startRevealItem(g) {
  const d = g.details[g.index];
  if (!d) { g.phase = 'result'; render(); return; }
  // ミシックはシルエット→正体、シークレットは特別な「間」を設ける
  const pre = d.rarity === 'M' || d.rarity === 'S';
  g.preReveal = pre; g.phase = 'reveal';
  render();
  gachaSfx(d.rarity);
  if (pre) {
    const speed = Math.max(0.5, state.settings.animSpeed || 1);
    scheduleGacha(g, Math.round((d.rarity === 'S' ? 1500 : 950) / speed), () => {
      g.preReveal = false; render();
      scheduleGacha(g, revealMs(g, d), () => advanceReveal(g));
    });
  } else {
    scheduleGacha(g, revealMs(g, d), () => advanceReveal(g));
  }
}
function advanceReveal(g) {
  if (g.index < g.details.length - 1) { g.index++; startRevealItem(g); }
  else { g.phase = 'result'; render(); }
}

function setBgm(on) {
  clearInterval(bgmTimer);
  if (!on) return;
  const notes = [261.6,329.6,392,523.2,392,329.6,293.7,349.2,440,587.3,440,349.2];
  let i = 0;
  bgmTimer = setInterval(() => {
    if (!state.settings.bgm) { clearInterval(bgmTimer); return; }
    tone(notes[i % notes.length] / 2, 0.55, 'sine', 0.012);
    if (i % 3 === 0) tone(notes[(i+2) % notes.length], 0.4, 'triangle', 0.008);
    i++;
  }, 720);
}

/* ---------------- 戦闘演出 ---------------- */
function fxTarget(side) {
  const el = $(side === 'player' ? 'arena-player' : 'arena-enemy');
  const layer = $('fx-layer');
  const r = el?.getBoundingClientRect();
  return { x: r ? r.left + r.width/2 : window.innerWidth/2, y: r ? r.top + r.height*0.32 : window.innerHeight/2 };
}
const SPECIAL_FX = {
  '飯山':   { n:0, color:'#ff8f6b', glyph:'✹', label:'連撃の嵐' },
  '三尾':   { n:1, color:'#ffe066', glyph:'⚡', label:'一気の連携' },
  'すずそう':{ n:2, color:'#d8a866', glyph:'🌍', label:'大地をならす' },
  '河岡':   { n:3, color:'#ff9ecf', glyph:'💠', label:'おにーちゃんの加護' },
};
function showFx(o) {
  const layer = $('fx-layer'); if (!layer) return;
  const el = document.createElement('div');
  if (['damage','heal','statusDamage','miss','stun'].includes(o.type)) {
    const p = fxTarget(o.side || 'enemy');
    el.className = `fx-num ${o.type} ${o.crit?'crit':''}`;
    const txt = o.type === 'heal' ? `+${o.value ?? ''}` : o.type === 'miss' ? 'MISS' : o.type === 'stun' ? '動けない' : `-${o.value}`;
    el.textContent = txt;
    el.style.left = `${p.x + (Math.random()*40-20)}px`;
    el.style.top = `${p.y}px`;
    if (o.element && D.ELEMENTS[o.element]) el.style.textShadow = `0 0 18px ${D.ELEMENTS[o.element].color}`;
    const arena = document.querySelector('.arena');
    if (o.type === 'damage' && arena) { arena.classList.remove('shake'); void arena.offsetWidth; arena.classList.add('shake'); }
    if (o.type === 'damage') sfx('hit');
  } else if (o.type === 'skill') {
    el.className = 'fx-skill';
    const color = D.ELEMENTS[o.element]?.color || '#ffd77a';
    el.style.setProperty('--fx-color', color);
    el.innerHTML = `<span>✦</span>${e(o.name)}<span>✦</span>`;
  } else if (o.type === 'ultimate') {
    const sp = SPECIAL_FX[o.special];
    el.className = `fx-ultimate${sp ? ` sp-fx-${sp.n}` : ''}`;
    const color = sp?.color || D.ELEMENTS[o.element]?.color || '#ffd77a';
    el.style.setProperty('--fx-color', color);
    el.innerHTML = `<div class="fu-ring"></div><div class="fu-rays"></div>
      <div class="fu-label">${sp ? `${sp.glyph} ${sp.label} ✵` : '✵ 奥義 ✵'}</div>
      <div class="fu-name">${e(o.name)}</div>
      ${sp?`<div class="fu-special">${e(D.SPECIAL_NAME_LABEL[o.special]||o.special)}の名を宿す専用演出</div>`:''}`;
    sfx('ultimate');
  } else if (o.type === 'victory' || o.type === 'defeat') {
    el.className = `fx-big ${o.type}`;
    el.textContent = o.type === 'victory' ? 'WIN!' : 'LOSE...';
  } else {
    el.className = 'fx-word';
    el.textContent = ({shield:'🛡 バリア',buff:'✧ 強化',summon:'☄ 召喚',counter:'↩ 反撃'})[o.type] || '';
    const p = fxTarget(o.side || 'player');
    el.style.left = `${p.x}px`; el.style.top = `${p.y - 40}px`;
  }
  layer.appendChild(el);
  setTimeout(() => el.remove(), o.type === 'ultimate' ? 1000 : 1100);
}

/* ---------------- 戦闘開始・終了 ---------------- */
async function startBattle(enemyDef, mode = 'cpu', floor = 0) {
  const c = S.activeChar(state);
  if (!c) { toast('先にキャラクターを作成してください', 'error'); return navigate('create'); }
  if (!enemyDef) { toast('相手が見つかりません', 'error'); return; }
  if (!S.enemyUnlocked(state, enemyDef) && mode !== 'dungeon' && mode !== 'hidden') {
    toast('この相手はまだ解放されていません', 'error'); return;
  }
  S.restoreFull(state, c);
  if (mode === 'dungeon') state.dungeon.active = true;
  let ready = false;
  const b = new Battle({
    state, char: c, enemy: enemyDef, mode, floor,
    onChange: () => { if (ready && app.screen === 'battle') render(); },
    onFx: showFx,
    onEnd: r => {
      if (r.mode === 'tutorial') {
        S.tutorialMarkFlag(state, 'visitedBattle', true);
        if (r.won) S.tutorialMarkFlag(state, 'battleWon', true);
        S.tutorialAddEarnedCoins(state, r.rewards?.coins || 0);
        S.tutorialCaptureProgress(state);
      }
      app.result = r; app.battle = null; app.screen = 'result';
      save(true);
      render();
      sfx(r.won ? 'win' : 'lose');
      window.scrollTo({ top:0 });
    },
  });
  b.player.sprite = c.original || c.sprite;
  b.enemy.boss = !!enemyDef.boss;
  b.fixedBattleScale = (c.imageSettings?.battleScale || 1);   // 戦闘中は固定
  b.enemy.sprite = P.makeEnemySprite(enemyDef);
  app.battle = b; app.result = null; app.battleTab = 'skill'; app.screen = 'battle';
  ready = true;
  render();
  window.scrollTo({ top:0 });
  sfx('ok');
}
async function startDungeonBattle(hard = false) {
  const floor = state.dungeon.floor;
  const en = S.dungeonEnemy(state, floor, hard);
  await startBattle(en, 'dungeon', floor);
}

function centerEdits(target, msg) {
  const o = srcObj(target); if (!o) return;
  o.settings.offsetX = 0; o.settings.offsetY = 0;
  updateImagePreview(target); syncSettingInputs(target);
  return toast(msg);
}

/* ---------------- アクション ---------------- */
function recordJobChange(offer, jobId, kept) {
  const c = S.activeChar(state);
  if (!c) return;
  const before = c.jobId;
  let r = { ok:true, msg:`現在の役職「${D.JOB[before].name}」を維持しました` };
  if (!kept) r = S.changeJob(state, c, jobId, true);
  if (!r.ok) return toast(r.msg, 'error');
  c.jobChangeHistory = Array.isArray(c.jobChangeHistory) ? c.jobChangeHistory : [];
  c.jobChangeHistory.push({
    at:new Date().toISOString(), reason:offer.reason,
    rankFrom:offer.from, rankTo:offer.to,
    from:before, to:c.jobId, kept,
  });
  app.jobChangeOffer = null;
  save(true);
  return commit(r.msg + '（役職変更履歴を保存しました）', true);
}

async function handleAction(action, ds, el) {
  const c = S.activeChar(state);
  sfx('click');
  switch (action) {
    /* --- ナビ --- */
    case 'nav': {
      S.tutorialTrack(state, 'nav', { to:ds.to, facility:ds.facility, tab:ds.tab });
      if (ds.to === 'facility') return navigate('facility', { facility: ds.facility, tab: ds.tab });
      return navigate(ds.to, ds.codexTab !== undefined ? { codexTab:ds.codexTab } : {});
    }
    case 'titleStart': {
      state.home = { ...(state.home||{}), started:true, lastVisit:new Date().toISOString() };
      if (state.characters.length) S.tutorialOffer(state);
      initDraft(); save(true); sfx('ok'); return navigate('town');
    }
    case 'titleContinue': {
      initDraft();
      state.home = { ...(state.home||{}), started:true, lastVisit:new Date().toISOString() };
      if (state.characters.length) S.tutorialOffer(state);
      save(true); sfx('ok');
      if (state.characters.length) toast('セーブデータを読み込みました。街から再開します');
      else if (state.draftSave?.original) toast('保存済みの下書きがあります。街からキャラクター作成を開けます');
      else toast('街のホーム画面から始めましょう');
      return navigate('town');
    }
    case 'titleCreate': initDraft(); return navigate('town');
    case 'titleCodex': return navigate('codex');
    case 'titleSettings': return navigate('settings');
    case 'newChar': initDraft(); return navigate('create');   // 街のホーム画面から作成へ
    case 'tab': app.tabs[ds.facility] = Number(ds.i); return render();
    case 'codexTab': app.codexTab = Number(ds.i); return render();
    case 'enemyGroup': app.enemyGroup = ds.group; return render();
    case 'battleTab': app.battleTab = ds.tab; return render();
    case 'skillPage': app.skillOffset = Math.max(0, (app.skillOffset||0) + Number(ds.delta)); return render();

    /* --- 作成・画像編集 --- */
    case 'createSample': {
      try {
        const { image, dataURL } = await P.loadImageURL('assets/sample_hero.jpg');
        if (ds.target === 'look') {
          if (!app.look) await prepareLook();
          const L = app.look;
          L.image = image; L.original = dataURL; L.sprite = dataURL; L.meta = { name:'サンプル画像' };
          L.width = image.width; L.height = image.height; L.transparentData = '';
          render();
          if (L.settings.transparent) await refreshTransparency('look');
          toast('サンプル画像に差し替えました（育成データは保持）');
        } else {
          const d = app.draft || (initDraft(), app.draft);
          d.image = image; d.original = dataURL; d.sprite = dataURL; d.meta = { name:'サンプル画像' };
          d.width = image.width; d.height = image.height; d.transparentData = '';
          render();
          if (d.settings.transparent) await refreshTransparency('draft');
          toast('サンプル画像を読み込みました（元画像のまま使用します）');
        }
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'createSave': {
      const d = app.draft;
      if (!d) return toast('作成データを開いてください', 'error');
      const nameEl = document.querySelector('[data-draft="name"]');
      if (nameEl) d.name = nameEl.value;
      state.draftSave = {
        name:d.name || '', original:d.original, sprite:d.original,
        imageSettings:{ ...S.defaultImageSettings(), ...d.settings },
        transparentData:d.transparentData || '', jobId:d.jobId, weaponType:d.weaponType,
        styleId:d.styleId, frame:d.frame, width:d.width, height:d.height,
      };
      save(true);
      return toast('下書き（元画像＋設定＋名前）を保存しました');
    }
    case 'loadDraft': {
      const dsave = state.draftSave;
      if (!dsave?.original) return toast('保存済みの下書きがありません', 'error');
      if (!app.draft) initDraft();
      const d = app.draft;
      Object.assign(d, {
        original:dsave.original, sprite:dsave.original, name:dsave.name || '',
        settings:{ ...S.defaultImageSettings(), ...(dsave.imageSettings||{}) },
        transparentData:dsave.transparentData || '', jobId:dsave.jobId||'warrior',
        weaponType:dsave.weaponType||'剣', styleId:dsave.styleId||'balanced',
        frame:dsave.frame||'gold', width:dsave.width||0, height:dsave.height||0,
        meta:{ name:'保存済みの下書き' },
      });
      try { d.image = (await P.loadImageURL(dsave.original)).image; } catch (err) { d.image = null; }
      render();
      return toast('下書きを読み込みました');
    }
    case 'selectJob': {
      const d = app.draft;
      if (!d) return toast('作成画面を開いてください', 'error');
      const job = D.JOB[ds.job];
      if (!job) return toast('職業が見つかりません', 'error');
      d.jobId = job.id;
      d.weaponType = (job.weapons || ['剣'])[0];
      render();
      return toast(`${job.name} を選択しました（初期武器：${d.weaponType}）`);
    }
    case 'createCompare': app.compare = !app.compare; return render();
    case 'centerImage': return centerEdits(ds.target || 'draft', '中央に戻しました');
    case 'fitImage': {
      const o = srcObj(ds.target || 'draft'); if (!o) return;
      o.settings.fit = ds.fit === 'face' ? 'face' : 'full';
      o.settings.scale = ds.fit === 'face' ? 1.7 : 1;
      o.settings.offsetX = 0; o.settings.offsetY = ds.fit === 'face' ? 6 : 0;
      updateImagePreview(ds.target || 'draft'); syncSettingInputs(ds.target || 'draft');
      return toast(ds.fit === 'face' ? '顔アップ表示（顔が見切れないよう上部を基準に拡大）' : '全身表示に戻しました');
    }
    case 'resetEdits': {
      const o = srcObj(ds.target || 'draft'); if (!o) return;
      o.settings = S.defaultImageSettings(); o.transparentData = '';
      render(); return toast('編集前の状態に戻しました（元画像は保持）');
    }
    case 'createFinish': {
      const d = app.draft;
      if (!d?.original) return toast('画像を読み込んでください', 'error');
      const nameEl = document.querySelector('[data-draft="name"]');
      const name = ((nameEl?.value ?? d.name) || '名無し').trim().slice(0,16);
      const ch = S.createCharacter(state, {
        name, jobId:d.jobId, weaponType:d.weaponType, styleId:d.styleId,
        original:d.original, sprite:d.original,
        imageSettings:{ ...S.defaultImageSettings(), ...d.settings },
        transparentData:d.transparentData || '',
      });
      state.draftSave = {
        name, original:d.original, sprite:d.original,
        imageSettings:{ ...ch.imageSettings }, transparentData:ch.transparentData || '',
        jobId:d.jobId, weaponType:d.weaponType, styleId:d.styleId, frame:d.frame,
        width:d.width, height:d.height,
      };
      state.home = { ...(state.home||{}), started:true, lastVisit:new Date().toISOString() };
      S.tutorialOffer(state);            // 作成後に「始める / スキップ」を提示（強制ではない）
      S.tutorialTrack(state, 'createFinish');
      save(true);
      sfx('win');
      app.draft = null; app.compare = false;
      toast(`「${ch.name}」を作成しました！元画像のまま冒険を始めましょう`);
      return navigate('town');
    }
    case 'saveLook': {
      const ch = state.characters.find(x => x.id === app.look?.charId) || c;
      if (!ch || !app.look) return;
      const L = app.look;
      // 画像の差し替え・設定変更だけを行い、育成データは一切触らない
      ch.original = L.original || ch.original;
      ch.sprite = ch.original;
      ch.imageSettings = { ...S.defaultImageSettings(), ...L.settings };
      ch.transparentData = L.transparentData || '';
      state.draftSave = {
        name:ch.name, original:ch.original, sprite:ch.original,
        imageSettings:{ ...ch.imageSettings }, transparentData:ch.transparentData,
        jobId:ch.jobId, weaponType:'剣', styleId:ch.styleId, frame:ch.frame,
        width:L.width||0, height:L.height||0,
      };
      S.logEvent(state, `${ch.name}の画像・表示設定を変更した（育成データは保持）。`, 'look');
      app.look = null;
      save(true); toast('元画像と表示設定を保存しました。育成データは保持されています');
      return navigate('character');
    }
    case 'buyAura': { const r = S.buyAura(state, c, ds.id); return commit(r.msg, r.ok); }
    case 'setFrame': c.frame = ds.id; return commit('フレームを変更しました');
    case 'renameChar': {
      const name = (app.charName || '').trim().slice(0,16);
      if (!name) return toast('名前を入力してください', 'error');
      c.name = name;
      // 特殊ギミックは作成時に確定した specialKey だけを参照する。改名では再判定しない。
      S.logEvent(state, `名前を「${name}」に変更した。（特殊ギミック・能力値・奥義は不変）`, 'look');
      return commit('名前を変更しました（能力値・奥義・特殊ギミックは変わりません）');
    }
    case 'switchChar': state.activeId = ds.id; app.look = null; return commit('キャラクターを切り替えました');
    case 'deleteChar': {
      if (state.characters.length <= 1) return toast('最低1人は必要です', 'error');
      if (!confirm('このキャラクターを削除しますか？ 元画像と育成データも消えます。')) return;
      state.characters = state.characters.filter(x => x.id !== ds.id);
      if (state.activeId === ds.id) state.activeId = state.characters[0].id;
      return commit('キャラクターを削除しました');
    }

    /* --- 素材・進化 --- */
    case 'matDetail': app.materialDetail = ds.id; return render();
    case 'matDetailClose': app.materialDetail = null; return render();
    case 'matUpgrade': { const r = S.upgradeMaterial(state, ds.id); return commit(r.msg, r.ok); }
    case 'evolveChar': {
      const r = S.evolveCharacter(state, c);
      if (r.ok) {
        S.tutorialCaptureProgress(state);
        S.tutorialMarkFlag(state, 'evolved', true);
        app.evoResult = { type:'char', r:{ ...r, skill:D.SKILL[r.rule.skill] } };
        if (r.jobChangeOffer) app.jobChangeOffer = r.jobChangeOffer;
        save(true); showEvolutionFx(r.rule.to, `${r.rule.from} → ${r.rule.to} 進化！`);
      }
      return commit(r.msg, r.ok);
    }
    case 'evoResultClose': app.evoResult = null; return render();
    case 'equipEvolveSelect': app.evolveEquip = ds.uid; return render();
    case 'evolveEquip': {
      const r = S.evolveEquipment(state, ds.uid);
      if (r.ok) { app.evoResult = { type:'equip', r }; showEvolutionFx(r.next, `装備ランク ${r.next} 進化！`); }
      return commit(r.msg, r.ok);
    }

    /* --- 育成の間 --- */
    case 'alloc': {
      const ok = S.allocateStat(state, c, ds.stat, Number(ds.n));
      return commit(ok ? `${D.STAT_NAMES[ds.stat]}を上げた` : 'ポイントが足りません', ok);
    }
    case 'restore': {
      if (state.coins < 200) return toast('200コイン必要です', 'error');
      S.addCoins(state, -200, false); S.restoreFull(state, c);
      return commit('HP・MPを全回復しました');
    }
    case 'resetAlloc': { const r = S.resetAllocs(state, c); return commit(r.msg, r.ok); }
    case 'changeJob': {
      if (!app.jobChangeOffer) return toast('役職変更はランクアップ時・転生時のみ可能です', 'error');
      return recordJobChange(app.jobChangeOffer, ds.job, false);
    }
    case 'jobChangePick': {
      if (!app.jobChangeOffer) return toast('役職変更の機会ではありません', 'error');
      return recordJobChange(app.jobChangeOffer, ds.job, false);
    }
    case 'jobChangeKeep': {
      if (!app.jobChangeOffer) return render();
      return recordJobChange(app.jobChangeOffer, c.jobId, true);
    }
    /* --- チュートリアル（任意開始・途中再開・完了報酬） --- */
    case 'tutorialStart': {
      app.tutorialHidden = false;
      const r = S.tutorialStart(state); save(true); sfx('ok'); return commit(r.msg, r.ok);
    }
    case 'tutorialSkip': {
      app.tutorialHidden = false;
      const r = S.tutorialSkip(state); save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialResume': {
      app.tutorialHidden = false;
      const t = state.tutorial || S.defaultTutorial();
      const r = (t.status === 'skipped' || t.status === 'active') ? S.tutorialResume(state) : S.tutorialStart(state);
      save(true); sfx('ok');
      if (app.screen === 'help') { toast(r.msg, r.ok ? 'ok' : 'error'); return navigate('town'); }
      return commit(r.msg, r.ok);
    }
    case 'tutorialReplay': {
      app.tutorialHidden = false;
      const r = S.tutorialStart(state); save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialHide': app.tutorialHidden = true; return render();
    case 'tutorialShow': app.tutorialHidden = false; return render();
    case 'tutorialNext': {
      const r = S.tutorialNext(state);
      if (r.ok) sfx('win');
      save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialClaim': {
      const r = S.tutorialClaimReward(state);
      if (r.ok) { sfx('win'); showFx({ type:'victory', side:'player' }); }
      save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialExp': {
      const r = S.tutorialGrantExp(state, c);
      save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialGacha': {
      const r = S.tutorialPracticePull(state, c);
      if (r.ok) sfx('ok'); save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialEquip': {
      const r = S.tutorialEquipPractice(state, c);
      save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialGather': {
      const r = S.tutorialGather(state, c);
      if (r.ok) sfx('ok'); save(true); return commit(r.msg, r.ok);
    }
    case 'tutorialBattle': {
      S.tutorialMarkFlag(state, 'visitedBattle', true);
      return startBattle(D.TUTORIAL_ENEMY, 'tutorial');
    }
    case 'tutorialManualSkill': {
      const b = app.battle;
      if (!b) return toast('まずチュートリアル用の敵と戦ってください', 'error');
      const sk = b.actionList(b.player).find(x => x.id !== '__attack' && !x.ultimate
        && x.usable && b.player.mp >= (x.mp || 0));
      if (!sk) return toast('今使える技がありません（MP を確認してください）', 'error');
      if (b.autoMode) { b.toggleAuto(); S.tutorialMarkFlag(state, 'autoToggled', true); }
      S.tutorialMarkFlag(state, 'manualSkill', true);
      save(); render();
      return b.act(sk.id).catch(err => console.error(err));
    }
    case 'storyRead': {
      const id = Number(ds.id);
      const st = state.story || (state.story = { chapter:1, seen:[], cleared:[] });
      if (!st.seen.includes(id)) st.seen.push(id);
      if (!st.cleared.includes(id)) st.cleared.push(id);
      const chapters = 6;
      if (st.chapter < chapters && st.seen.includes(st.chapter)) st.chapter = Math.min(chapters, st.chapter + 1);
      save(); return commit(`第${id}章を読みました。進行状況を保存しました`);
    }
    case 'skillLearn': { const r = S.learnSkill(state, c, ds.skill, Number(ds.cost)); return commit(r.msg, r.ok); }
    case 'skillToggle': { const ok = S.toggleEquippedSkill(c, ds.skill); return commit(ok ? '技の装備を変更しました' : '装備枠は8つまでです', ok); }
    case 'useBook': { const r = S.useSkillBook(state, c, ds.book); return commit(r.msg, r.ok); }
    case 'doAwaken': { const r = S.doAwaken(state, c); if (r.ok) sfx('win'); return commit(r.msg, r.ok); }

    /* --- 工房 --- */
    case 'equip': { const ok = S.equipItem(state, c, ds.uid, ds.slot); if (ok) S.tutorialMarkFlag(state, 'equipped', true); return commit(ok ? '装備しました' : 'この職業では装備できません', ok); }
    case 'unequip': S.unequip(state, c, ds.slot); return commit('装備を外しました');
    case 'sellEquip': { const r = S.sellEquipment(state, ds.uid); return commit(r.msg, r.ok); }
    case 'gacha': {
      const r = S.pullGacha(state, ds.kind, Number(ds.n));
      if (!r.ok) return toast(r.msg, 'error');
      app.lastPull = r.results; app.lastBonus = r.bonusMaterials || [];
      // 装備ガチャは従来どおり（演出対象外）。武器ガチャだけ専用演出を開始する。
      if (ds.kind === 'armor') {
        sfx('win');
        const top = r.results.reduce((a,i)=> D.RARITY_ORDER.indexOf(S.instanceRarity(i)) > D.RARITY_ORDER.indexOf(S.instanceRarity(a)) ? i : a, r.results[0]);
        toast(`${r.msg} 最高レアリティ：${D.RARITY[S.instanceRarity(top)].name}「${S.instanceDef(top).name}」`);
        save(); render(); return;
      }
      // 結果はこの時点で確定。save も演出開始前に行う。
      app.gachaRatesDetail = false; app.gachaItemDetail = null; app.materialDetail = null;
      save(true);
      sfx('ok');
      startGachaPresentation(r, ds.kind, Number(ds.n));
      return;
    }
    case 'gachaSkip': {
      const g = app.gacha; if (!g) return;
      clearGachaTimers(g);
      g.phase = 'result'; g.skipped = true; g.preReveal = false;
      render(); return toast('演出をスキップしました（結果・報酬は変化しません）');
    }
    case 'gachaClose': {
      if (app.gacha) clearGachaTimers(app.gacha);
      app.gacha = null; app.gachaItemDetail = null;
      return render();
    }
    case 'gachaAgain': {
      const g = app.gacha; if (!g) return;
      const kind = g.kind, n = Number(ds.n) || 1;
      clearGachaTimers(g); app.gacha = null; app.gachaItemDetail = null;
      return handleAction('gacha', { kind, n:String(n) }, null);
    }
    case 'gachaRatesDetail': app.gachaRatesDetail = true; return render();
    case 'gachaRatesDetailClose': app.gachaRatesDetail = false; return render();
    case 'gachaItemDetail': {
      app.gachaItemDetail = { defId:ds.id, uid:ds.uid || null,
        pickup:ds.pickup === '1', isNew:ds.new === '1' };
      return render();
    }
    case 'gachaDetailClose': app.gachaItemDetail = null; return render();
    case 'gachaEquip': {
      const ch = S.activeChar(state);
      const ok = ch && S.equipItem(state, ch, ds.uid, 'weapon');
      app.gachaItemDetail = null;
      save();
      render();
      return toast(ok ? '武器を装備しました（工房で強化・ランク進化できます）'
        : 'この職業では装備できません。転職してから装備してください', ok ? 'info' : 'error');
    }
    case 'enhanceSelect': app.selectedEquip = ds.uid; return render();
    case 'enhance': { const r = S.enhanceEquipment(state, app.selectedEquip); return commit(r.msg, r.ok); }
    case 'synthToggle': {
      const i = app.selectedSynth.indexOf(ds.uid);
      if (i >= 0) app.selectedSynth.splice(i,1);
      else if (app.selectedSynth.length < 3) app.selectedSynth.push(ds.uid);
      else return toast('選択できるのは3つまでです', 'error');
      return render();
    }
    case 'synth': {
      const r = S.synthesizeEquipment(state, app.selectedSynth);
      if (r.ok) { app.selectedSynth = []; app.selectedEquip = null; sfx('win'); }
      return commit(r.msg, r.ok);
    }

    /* --- 道具屋・修行 --- */
    case 'buy': { const r = S.buyItem(state, ds.id, Number(ds.n)); return commit(r.msg, r.ok); }
    case 'sell': { const r = S.sellItem(state, ds.id, Number(ds.n)); return commit(r.msg, r.ok); }
    case 'training': { const r = S.doTraining(state, c, ds.id, Number(ds.sets)); return commit(r.msg, r.ok); }
    case 'practice': { const r = S.doPractice(state, c, ds.skill); return commit(r.msg, r.ok); }
    case 'trainingQuest': { const r = S.doTrainingQuest(state, c, ds.id); if (r.ok) sfx('ok'); return commit(r.msg, r.ok); }
    case 'repeatTraining': { const r = S.repeatableTraining(state, c); return commit(r.msg, r.ok); }

    /* --- ギルド --- */
    case 'battleStart': {
      const en = D.ENEMY[ds.enemy] || D.ENEMIES.find(x=>x.id===ds.enemy);
      return startBattle(en, ds.mode || 'cpu', Number(ds.floor)||0);
    }
    case 'dungeonStart': {
      const hard = ds.hard === '1';
      if (hard) S.resetDungeon(state, true);
      return startDungeonBattle(hard);
    }
    case 'dungeonReset': S.resetDungeon(state, ds.hard === '1'); return commit('ダンジョンをリセットしました');
    case 'hiddenBoss': {
      const en = D.ENEMIES.find(x=>x.hidden);
      if (!S.hiddenBossUnlocked(state, c)) return toast('解放条件を満たしていません', 'error');
      return startBattle(en, 'hidden', 0);
    }
    case 'claimQuest': { const r = S.claimQuest(state, c, ds.id); if (r.ok) sfx('ok'); return commit(r.msg, r.ok); }
    case 'claimRank': { const r = S.claimRankReward(state, Number(ds.idx)); return commit(r.msg, r.ok); }
    case 'exchange': { const r = S.exchangeItem(state, c, ds.id); if (r.ok) sfx('ok'); return commit(r.msg, r.ok); }
    case 'rebirth': {
      const r = S.doRebirth(state, c);
      if (r.ok) { sfx('win'); if (r.jobChangeOffer) app.jobChangeOffer = r.jobChangeOffer; save(true); }
      return commit(r.msg, r.ok);
    }

    /* --- 戦闘 --- */
    case 'battleAction': {
      if (app.battle) {
        if (ds.id !== '__attack' && ds.id !== '__guard' && !ds.id.startsWith('__item:'))
          S.tutorialMarkFlag(state, 'manualSkill', true);
        app.battle.act(ds.id).catch(err=>console.error(err));
      }
      return;
    }
    case 'battleAuto': if (app.battle) { S.tutorialMarkFlag(state, 'autoToggled', true); app.battle.toggleAuto(); save(); render(); } return;
    case 'battleSpeed': {
      if (!app.battle) return;
      if (!app.battle.autoMode) return toast('戦闘速度の変更は AUTO が ON のときだけ可能です', 'error');
      S.tutorialMarkFlag(state, 'speedChanged', true);
      app.battle.setAutoSpeed(Number(ds.speed) || 1); save(); render(); return;
    }
    case 'battleSurrender': if (app.battle) app.battle.surrender(); return;
    case 'resultRetry': {
      const r = app.result;
      if (!r) return navigate('town');
      if (r.mode === 'dungeon') return startDungeonBattle(state.dungeon.hard);
      return startBattle(r.enemy, r.mode, r.floor);
    }
    case 'resultNextFloor': return startDungeonBattle(state.dungeon.hard);

    /* --- 設定 --- */
    case 'saveNow': save(true); return toast('セーブしました');
    case 'exportSave': S.exportSave(state); return toast('セーブデータを書き出しました');
    case 'toggleSfx': state.settings.sfx = !state.settings.sfx; sfx('ok'); return commit(`効果音：${state.settings.sfx?'ON':'OFF'}`);
    case 'toggleBgm': state.settings.bgm = !state.settings.bgm; setBgm(state.settings.bgm); return commit(`環境音：${state.settings.bgm?'ON':'OFF'}`);
    case 'toggleAutosave': state.settings.autosave = !state.settings.autosave; return commit(`自動セーブ：${state.settings.autosave?'ON':'OFF'}`);
    case 'resetGame': app.confirmReset = true; return render();
    case 'resetCancel': app.confirmReset = false; return render();
    case 'resetGameConfirm': {
      await S.eraseSave();
      state = S.newState();
      Object.assign(app, { screen:'title', params:{}, tabs:{}, draft:null, look:null, battle:null, result:null,
        lastPull:[], lastBonus:[], selectedSynth:[], selectedEquip:null, confirmReset:false,
        enemyGroup:'normal', compare:false, materialDetail:null, evolveEquip:null,
        gacha:null, gachaRatesDetail:false, gachaItemDetail:null, jobChangeOffer:null, tutorialHidden:false });
      render(); window.scrollTo({top:0});
      return toast('データを初期化しました');
    }
    default: console.warn('未処理のアクション', action); return;
  }
}

/* ---------------- イベント委譲 ---------------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.dataset.backdrop && ev.target !== el) return;   // モーダル内クリックでは閉じない
  ev.preventDefault();
  handleAction(el.dataset.action, el.dataset, el).catch(err => { console.error(err); toast('処理中にエラーが発生しました', 'error'); });
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset?.setting && el.type === 'range') updateSetting(el, el.dataset.target || 'draft', el.dataset.setting);
  if (el.dataset?.draft) {
    const key = el.dataset.draft;
    if (key === 'charName') app.charName = el.value;
    else if (app.draft) app.draft[key] = el.value;
  }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset?.file) return handleFile(el);
  if (el.dataset?.setting && (el.type === 'checkbox' || el.tagName === 'SELECT')) {
    return updateSetting(el, el.dataset.target || 'draft', el.dataset.setting);
  }
  if (el.dataset?.change) {
    const v = el.value, key = el.dataset.change;
    if (key === 'skillFilter') { app.skillFilter = v; app.skillOffset = 0; return render(); }
    if (key === 'equipSlot') { app.equipSlot = v; return render(); }
    if (key === 'equipTitle') { S.equipTitle(state, S.activeChar(state), v); return commit('称号を変更しました'); }
  }
  if (el.dataset?.action === 'draftJob' && app.draft) {
    app.draft.jobId = el.value;
    app.draft.weaponType = (D.JOB[el.value]?.weapons || ['剣'])[0];
    return render();
  }
  if (el.dataset?.draft && app.draft) {
    const key = el.dataset.draft;
    app.draft[key] = el.value;
    if (key === 'jobId') app.draft.weaponType = (D.JOB[el.value]?.weapons || ['剣'])[0];
    return render();
  }
});
window.addEventListener('resize', () => {
  if (app.screen === 'create') updateImagePreview('draft');
  if (app.screen === 'appearance') updateImagePreview('look');
});

/* デバッグ・自動テスト用（ゲーム進行には影響しません） */
window.__OCF = { app, get state() { return state; }, S, D, P, navigate, handleAction };

/* ---------------- 起動 ---------------- */
(async function boot() {
  const loaded = await S.loadState();
  if (loaded) state = loaded;
  if (state.home?.started) app.screen = 'town';   // 次回起動時も街のホーム画面から
  ensureEnemySprites();
  render();
  // 透過設定だけ保存されている場合、再起動後に透過PNGを作り直す（元画像は不変）
  (async () => {
    for (const ch of state.characters) {
      if (!ch.imageSettings?.transparent || ch.transparentData) continue;
      try {
        const { image } = await P.loadImageURL(ch.original);
        ch.transparentData = P.makeTransparentImage(image, 30).dataURL;
        render();
      } catch (err) { console.warn('透過の再生成をスキップ', err); }
    }
  })();
  if (state.settings.bgm) { // ブラウザの自動再生制限に配慮し、最初の操作後に開始
    const once = () => { setBgm(true); document.removeEventListener('pointerdown', once); };
    document.addEventListener('pointerdown', once);
  }
  console.log('オリキャラファイターズ 起動 / 技', D.SKILLS.length, '種 / 装備', D.EQUIPMENT.length, '種 / 職業', D.JOBS.length, '職');
})();
