/* ===========================================================
   オリキャラファイターズ / アプリ本体・入力・演出
   =========================================================== */
import * as D from './data.js';
import * as S from './state.js';
import * as P from './pixel.js';
import { Battle } from './battle.js';
import { renderScreen, spriteImg, e } from './ui.js';

const app = {
  screen: 'title', params: {}, tabs: {}, draft: null, look: null, compare: false,
  battle: null, result: null, enemySprites: {}, toast: '',
  selectedEquip: null, selectedSynth: [], lastPull: [], enemyGroup: 'normal',
  skillFilter: 'all', skillOffset: 0, equipSlot: 'all', codexTab: 0, battleTab: 'skill',
  confirmReset: false, charName: '', started: false,
};
let state = S.newState();
let toastTimer = null, regenTimer = null;
let audioCtx = null, bgmTimer = null;

/* ---------------- 基本 ---------------- */
const $ = id => document.getElementById(id);
function render() {
  $('app').innerHTML = renderScreen(app, state);
  initAfterRender();
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
  app.draft = {
    step: 1, image: null, original: '', sprite: '', meta: null,
    settings: S.defaultPixelSettings(), name: '', jobId: 'warrior', weaponType: '剣', styleId: 'balanced', frame: 'gold',
  };
  app.compare = false;
}
async function prepareLook() {
  const c = S.activeChar(state);
  if (!c) return;
  if (app.look && app.look.charId === c.id && app.look.image) return;
  try {
    const { image } = await P.loadImageURL(c.original);
    app.look = { charId: c.id, image, original: c.original, sprite: c.sprite, settings: { ...c.spriteSettings }, meta: null };
  } catch (err) {
    app.look = { charId: c.id, image: null, original: c.original, sprite: c.sprite, settings: { ...c.spriteSettings }, meta: null };
    toast('元画像を読み込めませんでした。差し替えてください', 'error');
  }
}
function srcObj(target) { return target === 'look' ? app.look : app.draft; }

function ensureEnemySprites() {
  for (const en of D.ENEMIES) if (!app.enemySprites[en.id]) app.enemySprites[en.id] = P.makeEnemySprite(en);
}

function initAfterRender() {
  // トースト復元
  const t = $('toast'); if (t && app.toast) t.className = `toast show`;
  // 切り抜きエディタ
  if (app.screen === 'create' && app.draft?.step === 1) initCrop('cropCanvas', 'draft');
  if (app.screen === 'appearance') initCrop('lookCropCanvas', 'look');
  // ドット絵の初回生成
  if (app.screen === 'create' && app.draft?.step === 2 && app.draft.image && !app.draft.sprite) generateSprite('draft', true);
  if (app.screen === 'appearance' && app.look?.image && !app.look.generated) {
    app.look.generated = true;
    generateSprite('look', false);
  }
  // 戦闘ログを末尾へ
  const log = $('logScroll'); if (log) log.scrollTop = log.scrollHeight;
  // 見た目の元画像プレビュー
  if (app.screen === 'appearance' && app.look?.image && $('lookCropCanvas')) {
    P.drawCropPreview($('lookCropCanvas'), app.look.image, app.look.settings);
  }
}

/* ---------------- 画像・ドット絵 ---------------- */
function generateSprite(target, doRender = false) {
  const o = srcObj(target);
  if (!o || !o.image) return;
  try {
    const res = P.makePixelSprite(o.image, o.settings);
    o.sprite = res.dataURL; o.meta = res;
    const id = target === 'look' ? 'lookPreview' : 'draftPreview';
    const box = $(id);
    if (box) box.innerHTML = spriteImg(o.sprite, 'big');
    const meta = $('spriteMeta');
    if (meta) meta.textContent = `${res.width} × ${res.height} ドット${res.face ? ' / 顔領域を検出' : ''}`;
    if (doRender) render();
  } catch (err) {
    console.error(err);
    toast('変換に失敗しました。別の画像か設定をお試しください', 'error');
  }
}
function scheduleRegen(target) {
  clearTimeout(regenTimer);
  regenTimer = setTimeout(() => generateSprite(target, false), 320);
}
function redrawCrop(target) {
  const o = srcObj(target);
  const id = target === 'look' ? 'lookCropCanvas' : 'cropCanvas';
  if (o?.image && $(id)) P.drawCropPreview($(id), o.image, o.settings);
}
function syncSettingInputs(target) {
  const o = srcObj(target);
  if (!o) return;
  for (const [k,v] of Object.entries(o.settings)) {
    const el = document.querySelector(`[data-target="${target}"][data-setting="${k}"]`);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
    const out = $(`out_${target}_${k}`); if (out) out.textContent = typeof v === 'number' ? (String(v).includes('.') ? v.toFixed(2) : v) : v;
  }
}
function initCrop(canvasId, target) {
  const canvas = $(canvasId);
  const o = srcObj(target);
  if (!canvas || !o?.image) return;
  P.drawCropPreview(canvas, o.image, o.settings);
  let dragging = false, sx = 0, sy = 0, base = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', ev => {
    dragging = true; sx = ev.clientX; sy = ev.clientY;
    base = { ...o.settings };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (ev.clientX - sx) / Math.max(1, rect.width);
    const dy = (ev.clientY - sy) / Math.max(1, rect.height);
    o.settings.cropX = S.clamp(base.cropX - dx * 0.85, 0, 1);
    o.settings.cropY = S.clamp(base.cropY - dy * 0.85, 0, 1);
    P.drawCropPreview(canvas, o.image, o.settings);
    syncSettingInputs(target);
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    if (target === 'look' || app.draft?.step === 2) scheduleRegen(target);
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    o.settings.scale = S.clamp((o.settings.scale || 1) * (ev.deltaY < 0 ? 1.08 : 0.93), 0.5, 3);
    P.drawCropPreview(canvas, o.image, o.settings);
    syncSettingInputs(target);
    if (target === 'look' || app.draft?.step === 2) scheduleRegen(target);
  }, { passive:false });
}

function updateSetting(el, target, key) {
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'range' || el.type === 'number') v = Number(el.value);
  else v = el.value;
  if (target === 'settings') { state.settings[key] = v; save(); }
  else {
    const o = srcObj(target); if (!o) return;
    o.settings[key] = v;
    if (target === 'draft' && app.draft.step === 1) redrawCrop(target);
    else { redrawCrop(target); scheduleRegen(target); }
  }
  const out = $(`out_${target}_${key}`);
  if (out) out.textContent = typeof v === 'number' ? (String(el.step).includes('.') ? Number(v).toFixed(2) : v) : v;
}

async function handleFile(el) {
  const kind = el.dataset.file;
  try {
    if (kind === 'create' || kind === 'appearance') {
      const r = await P.readImageFile(el.files?.[0]);
      if (kind === 'create') {
        if (!app.draft) initDraft();
        app.draft.image = r.image; app.draft.original = r.dataURL; app.draft.sprite = ''; app.draft.meta = null;
        app.draft.settings.cropX = 0.5; app.draft.settings.cropY = 0.5; app.draft.settings.scale = 1;
        toast(`画像を読み込みました（${r.width} × ${r.height}）`);
        render();
      } else {
        if (!app.look) await prepareLook();
        app.look.image = r.image; app.look.original = r.dataURL; app.look.generated = true;
        render(); generateSprite('look', false);
        toast('元画像を差し替えました');
      }
    } else if (kind === 'import') {
      const text = await el.files?.[0]?.text();
      if (!text) throw new Error('空のファイルです');
      const data = S.importSave(text);
      state = data;
      app.confirmReset = false;
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
  setTimeout(() => el.remove(), 1100);
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
      app.result = r; app.battle = null; app.screen = 'result';
      save(true);
      render();
      sfx(r.won ? 'win' : 'lose');
      window.scrollTo({ top:0 });
    },
  });
  b.player.sprite = c.sprite;
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

/* ---------------- アクション ---------------- */
async function handleAction(action, ds, el) {
  const c = S.activeChar(state);
  sfx('click');
  switch (action) {
    /* --- ナビ --- */
    case 'nav': {
      if (ds.to === 'facility') return navigate('facility', { facility: ds.facility, tab: ds.tab });
      return navigate(ds.to, {});
    }
    case 'titleStart': initDraft(); sfx('ok'); return navigate('create');
    case 'titleContinue': {
      if (state.characters.length || S.hasSaveFlag()) { sfx('ok'); toast('セーブデータを読み込みました'); return navigate('town'); }
      return toast('セーブデータがありません。ゲームスタートから始めましょう', 'error');
    }
    case 'titleCreate': initDraft(); return navigate('create');
    case 'titleCodex': return navigate('codex');
    case 'titleSettings': return navigate('settings');
    case 'newChar': initDraft(); return navigate('create');
    case 'tab': app.tabs[ds.facility] = Number(ds.i); return render();
    case 'codexTab': app.codexTab = Number(ds.i); return render();
    case 'enemyGroup': app.enemyGroup = ds.group; return render();
    case 'battleTab': app.battleTab = ds.tab; return render();
    case 'skillPage': app.skillOffset = Math.max(0, (app.skillOffset||0) + Number(ds.delta)); return render();

    /* --- 作成 --- */
    case 'createSample': {
      try {
        const { image } = await P.loadImageURL('assets/sample_hero.jpg');
        const r = P.normalizeImage(image);
        app.draft.image = r.image; app.draft.original = r.dataURL; app.draft.sprite = '';
        app.draft.settings.cropX = 0.5; app.draft.settings.cropY = 0.5; app.draft.settings.scale = 1;
        toast('サンプル画像を読み込みました。位置を調整できます');
        render();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'createResetCrop': {
      const d = app.draft;
      d.settings.cropX = 0.5; d.settings.cropY = 0.5; d.settings.scale = 1;
      render(); return;
    }
    case 'createStep': {
      const step = Number(ds.step);
      if (step >= 2 && !app.draft?.image) return toast('先に画像を読み込んでください', 'error');
      if (step === 3 && !app.draft?.sprite) return toast('ドット絵を生成してください', 'error');
      app.draft.step = step;
      render();
      window.scrollTo({ top:0 });
      return;
    }
    case 'createGenerate': return generateSprite('draft', true) || toast('ドット絵を再生成しました');
    case 'createCompare': app.compare = !app.compare; return render();
    case 'createFinish': {
      const d = app.draft;
      if (!d.image || !d.sprite || !d.original) return toast('画像とドット絵が必要です', 'error');
      const ch = S.createCharacter(state, {
        name: (d.name || '名無し').trim(), jobId: d.jobId, weaponType: d.weaponType,
        styleId: d.styleId, original: d.original, sprite: d.sprite, spriteSettings: { ...d.settings },
      });
      save(true);
      sfx('win');
      app.draft = null;
      toast(`「${ch.name}」を作成しました！冒険を始めましょう`);
      return navigate('town');
    }
    case 'lookGenerate': generateSprite('look', true); return toast('ドット絵を再生成しました');
    case 'saveLook': {
      const ch = state.characters.find(x => x.id === app.look?.charId) || c;
      if (!ch || !app.look) return;
      if (app.look.sprite) ch.sprite = app.look.sprite;
      if (app.look.original) ch.original = app.look.original;
      ch.spriteSettings = { ...app.look.settings };
      S.logEvent(state, `${ch.name}の見た目を変更した。`, 'look');
      save(true); toast('見た目を保存しました');
      return navigate('character');
    }
    case 'buyAura': { const r = S.buyAura(state, c, ds.id); return commit(r.msg, r.ok); }
    case 'setFrame': c.frame = ds.id; return commit('フレームを変更しました');
    case 'renameChar': {
      const name = (app.charName || '').trim().slice(0,16);
      if (!name) return toast('名前を入力してください', 'error');
      c.name = name; S.logEvent(state, `名前を「${name}」に変更した。`, 'look');
      return commit('名前を変更しました');
    }
    case 'switchChar': state.activeId = ds.id; return commit('キャラクターを切り替えました');
    case 'deleteChar': {
      if (state.characters.length <= 1) return toast('最低1人は必要です', 'error');
      if (!confirm('このキャラクターを削除しますか？ 元画像と育成データも消えます。')) return;
      state.characters = state.characters.filter(x => x.id !== ds.id);
      if (state.activeId === ds.id) state.activeId = state.characters[0].id;
      return commit('キャラクターを削除しました');
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
    case 'changeJob': { const r = S.changeJob(state, c, ds.job); return commit(r.msg, r.ok); }
    case 'skillLearn': { const r = S.learnSkill(state, c, ds.skill, Number(ds.cost)); return commit(r.msg, r.ok); }
    case 'skillToggle': { const ok = S.toggleEquippedSkill(c, ds.skill); return commit(ok ? '技の装備を変更しました' : '装備枠は8つまでです', ok); }
    case 'useBook': { const r = S.useSkillBook(state, c, ds.book); return commit(r.msg, r.ok); }
    case 'doAwaken': { const r = S.doAwaken(state, c); if (r.ok) sfx('win'); return commit(r.msg, r.ok); }

    /* --- 工房 --- */
    case 'equip': { const ok = S.equipItem(state, c, ds.uid, ds.slot); return commit(ok ? '装備しました' : 'この職業では装備できません', ok); }
    case 'unequip': S.unequip(state, c, ds.slot); return commit('装備を外しました');
    case 'sellEquip': { const r = S.sellEquipment(state, ds.uid); return commit(r.msg, r.ok); }
    case 'gacha': {
      const r = S.pullGacha(state, ds.kind, Number(ds.n));
      if (!r.ok) return toast(r.msg, 'error');
      app.lastPull = r.results; sfx('win');
      const top = r.results.reduce((a,i)=> D.RARITY_ORDER.indexOf(S.instanceRarity(i)) > D.RARITY_ORDER.indexOf(S.instanceRarity(a)) ? i : a, r.results[0]);
      toast(`${r.msg} 最高レアリティ：${D.RARITY[S.instanceRarity(top)].name}「${S.instanceDef(top).name}」`);
      save(); render(); return;
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
    case 'rebirth': { const r = S.doRebirth(state, c); if (r.ok) sfx('win'); return commit(r.msg, r.ok); }

    /* --- 戦闘 --- */
    case 'battleAction': if (app.battle) app.battle.act(ds.id).catch(err=>console.error(err)); return;
    case 'battleAuto': if (app.battle) { app.battle.toggleAuto(); render(); } return;
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
        lastPull:[], selectedSynth:[], selectedEquip:null, confirmReset:false, enemyGroup:'normal', compare:false });
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
  if (app.screen === 'create' && app.draft?.step === 1) redrawCrop('draft');
  if (app.screen === 'appearance') redrawCrop('look');
});

/* デバッグ・自動テスト用（ゲーム進行には影響しません） */
window.__OCF = { app, get state() { return state; }, S, D, P, navigate, handleAction };

/* ---------------- 起動 ---------------- */
(async function boot() {
  const loaded = await S.loadState();
  if (loaded) state = loaded;
  ensureEnemySprites();
  render();
  if (state.settings.bgm) { // ブラウザの自動再生制限に配慮し、最初の操作後に開始
    const once = () => { setBgm(true); document.removeEventListener('pointerdown', once); };
    document.addEventListener('pointerdown', once);
  }
  console.log('オリキャラファイターズ 起動 / 技', D.SKILLS.length, '種 / 装備', D.EQUIPMENT.length, '種 / 職業', D.JOBS.length, '職');
})();
