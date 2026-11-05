/* ===========================================================
   画面レンダリング（HTML生成のみ・イベントは main.js）
   =========================================================== */
import {
  RARITIES, RARITY, RARITY_ORDER, STAT_KEYS, STAT_NAMES, STAT_ICONS, ELEMENTS,
  SKILLS, SKILL, JOBS, JOB, EQUIPMENT, EQUIP_BY_ID, ITEM, ITEMS, ENEMIES, ENEMY,
  RANKS, QUESTS, ACHIEVEMENTS, TITLES, TITLE, EXCHANGE, STYLES, FACILITIES, SLOTS,
  SLOT_NAME, AWAKENING_NAMES, MAX_LEVEL_BASE, collectedSkills, EFFECTS,
  LEARNABLE_SKILL_COUNT, SPECIAL_NAME_LABEL, specialNameKey, GOD_JOB_ID,
  ULTIMATE_GAUGE_MAX, JOB_ULTIMATE, GOD_ULTIMATE_ID, SPECIAL_ULTIMATE,
  ULTIMATE_IDS, SKILL_COUNT, toCoreStats, HINT_CATEGORIES,
  CHAR_RARITIES, CHAR_RARITY, CHAR_RARITY_ORDER, charRankIndex, EVOLUTION_RULES, RATE_TOTAL,
} from './data.js?v=2';
import {
  fmt, clamp, activeChar, computeStats, powerScore, xpForLevel, jobXpForLevel, levelCap,
  instanceDef, instanceRarity, equipmentStats, findInstance, itemCount,
  jobUnlocked, jobReqText, questProgress, questClaimed, rankInfo,
  SHOP_STOCK, TRAINING, TRAINING_QUESTS, AWAKEN_STAGES, GACHA_COST, GACHA_COST_10,
  trainingCost, trainingQuestStatus, awakenStatus, canRebirth,
  hiddenBossUnlocked, hardDungeonUnlocked, enemyUnlocked, dungeonEnemy,
  buildEnemyCombatant, hasSaveFlag, AURAS, gachaRates, defaultPixelSettings,
  defaultImageSettings, evolutionPreview, equipmentEvolvePreview, instanceRank,
  PITY_LEGENDARY, PITY_MYTHIC, charRank, upgradeMaterial,
  jobChangeCandidates, hintState, hintRewardCoins, equipmentGachaCost, HINT_REWARD_PULLS,
} from './state.js?v=2';
import {
  materialIcon, MATERIAL_ITEMS, MATERIAL_BY_ID, MAT_RANKS, MAT_RANK_INFO,
  RANK_REQUIREMENTS, isMaterial, materialUpgradeTarget,
} from './materials.js?v=2';
import {
  GACHA_BANNERS, currentBanner, bannerRates, rateTotals, featuredDefs,
  hiddenSummary, weaponSummary, PICKUP_PERIOD_DAYS, PICKUP_SHARE, EFFECT_LABELS,
} from './gacha.js?v=2';

export const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (a,b) => b ? Math.max(0, Math.min(100, a/b*100)) : 0;

export function bar(cur, max, color, label) {
  const p = pct(cur,max);
  return `<div class="bar" title="${e(label||'')}"><div class="bar-fill" style="width:${p}%;background:${color}"></div><span>${e(label || `${fmt(cur)} / ${fmt(max)}`)}</span></div>`;
}
export function rarityTag(r) {
  const x = RARITY[r] || RARITY.N;
  return `<span class="rar-tag" style="--rc:${x.color}">${x.name}</span>`;
}
export function elementTag(el) {
  const x = ELEMENTS[el] || ELEMENTS.none;
  return `<span class="el-tag" style="--ec:${x.color}">${x.name}</span>`;
}
/* ---------- 元画像の非破壊表示 ---------- */
export function imageSettings(c) { return { ...defaultImageSettings(), ...(c?.imageSettings || {}) }; }
export function imageFilter(set) {
  const t = Number(set.temperature) || 0;
  const temp = t > 0 ? `sepia(${(t/220).toFixed(3)})` : `hue-rotate(${(t/7).toFixed(1)}deg)`;
  return `brightness(${set.brightness}%) contrast(${set.contrast}%) saturate(${set.saturate}%) hue-rotate(${set.hue}deg) ${temp}`;
}
export function imageTransform(set, cls = 'portrait') {
  const scale = (Number(set.scale) || 1) * (cls === 'battle' ? (Number(set.battleScale) || 1) : 1);
  return `translate(${set.offsetX}%, ${set.offsetY}%) scale(${scale}) scaleX(${set.flip ? -1 : 1})`;
}
export function rankBadge(r) {
  const x = CHAR_RARITY[r] || CHAR_RARITY.R;
  return `<span class="rank-badge ${x.css}">${x.name}</span>`;
}
export function charImage(c, cls = 'portrait', opts = {}) {
  if (!c) return `<div class="char-stage empty ${cls}">✦</div>`;
  const set = imageSettings(c);
  const rank = CHAR_RARITY[c.rarity || 'R'] || CHAR_RARITY.R;
  const src = (set.transparent && c.transparentData) ? c.transparentData : (c.original || c.sprite || 'assets/sample_hero.jpg');
  if (!src) return `<div class="char-stage empty ${cls}">✦</div>`;
  const fit = set.fit === 'face' ? 'face' : 'full';
  const aura = c.aura && c.aura !== 'none' ? `aura-${c.aura}` : '';
  const crest = { SR:'✦', SSR:'✧', UR:'❖', LR:'✺' }[rank.id] || '';
  return `<div class="char-stage ${cls} ${rank.css} ${aura} fit-${fit}" data-rank="${rank.id}">
    <div class="rank-fx rank-ring"></div><div class="rank-fx rank-aura"></div>
    <div class="char-frame ${e(c.frame || 'gold')}"><img class="char-img" src="${e(src)}" alt="${e(c.name || 'キャラクター')}"
      style="filter:${imageFilter(set)};transform:${imageTransform(set, cls)};transform-origin:${fit === 'face' ? 'center 22%' : 'center center'}"
      draggable="false"></div>
    <div class="rank-fx rank-particles"></div>${crest ? `<div class="rank-fx rank-crest">${crest}</div>` : ''}
  </div>`;
}
/** CPUスプライトや任意の画像用（ランク演出なし） */
export function spriteImg(src, cls = '', aura = 'none') {
  if (!src) return `<div class="sprite-empty ${cls}">✦</div>`;
  const colors = { blue:'#4fd8ff', gold:'#ffd77a', violet:'#b98bff', rainbow:'#68f7d4', void:'#ff6fae' };
  const glow = colors[aura] ? `--aura:${colors[aura]}` : '';
  return `<img class="sprite ${cls}" src="${e(src)}" alt="キャラクター" style="${glow}">`;
}
/* ---------- 素材アイコン ---------- */
export function itemIcon(id, size = 42) {
  if (isMaterial(id)) return `<span class="mat-icon mat-${MATERIAL_BY_ID[id].rank}">${materialIcon(id, size)}</span>`;
  return `<span class="item-emoji">${ITEM[id]?.icon || '📦'}</span>`;
}
export function matChip(id, n) {
  const m = MATERIAL_BY_ID[id];
  return `<span class="mat-chip" data-action="matDetail" data-id="${id}" role="button" tabindex="0">
    ${itemIcon(id, 30)}<span>${e(m?.name || id)}</span><b>×${n}</b></span>`;
}
function setRow(label, key, min, max, stepv, value, target, hint = '') {
  return `<label class="set-row"><span>${label}<small>${e(hint)}</small></span>
    <input type="range" data-setting="${key}" data-target="${target}" min="${min}" max="${max}" step="${stepv}" value="${value}">
    <output id="out_${target}_${key}">${typeof value === 'number' ? (stepv < 1 ? value.toFixed(2) : value) : value}</output></label>`;
}
/* 画像エディタの右側設定パネル（作成・見た目変更で共用） */
function editorSettings(target, st, opts = {}) {
  const zoomPct = Math.round((st.scale || 1) * 100);
  return `<div class="editor-settings">
    <div class="hint-box small">元画像は一切書き換えません。設定は表示にだけ適用され、いつでも元に戻せます。</div>
    <h4>🔍 表示サイズ・位置</h4>
    <div class="zoom-head"><b>ズーム</b><span id="zoom_${target}" class="zoom-num">${zoomPct}%</span></div>
    ${setRow('拡大率', 'scale', 0.5, 2.5, 0.01, st.scale, target, '画像はプレビュー内に収まります')}
    ${setRow('左右位置 X', 'offsetX', -40, 40, 1, st.offsetX, target)}
    ${setRow('上下位置 Y', 'offsetY', -40, 40, 1, st.offsetY, target)}
    <div class="row-btns tiny">
      <button class="btn btn-mini" data-action="centerImage" data-target="${target}">⊕ 中央に戻す</button>
      <button class="btn btn-mini" data-action="fitImage" data-fit="full" data-target="${target}">全身で表示</button>
      <button class="btn btn-mini" data-action="fitImage" data-fit="face" data-target="${target}">顔アップ</button>
    </div>
    <h4 class="mt">🎨 色・明るさ</h4>
    ${setRow('明るさ', 'brightness', 40, 180, 1, st.brightness, target)}
    ${setRow('コントラスト', 'contrast', 40, 180, 1, st.contrast, target)}
    ${setRow('彩度', 'saturate', 0, 200, 1, st.saturate, target)}
    ${setRow('色相', 'hue', -180, 180, 1, st.hue, target)}
    ${setRow('色温度', 'temperature', -100, 100, 1, st.temperature, target, '寒色 ← → 暖色')}
    <h4 class="mt">🪄 その他</h4>
    <label class="check-row"><input type="checkbox" data-setting="flip" data-target="${target}" ${st.flip?'checked':''}><span>左右反転</span></label>
    <label class="check-row"><input type="checkbox" data-setting="transparent" data-target="${target}" ${st.transparent?'checked':''}><span>背景を透過（輪郭・衣類は保持）</span></label>
    ${opts.battle ? setRow('戦闘時の表示サイズ', 'battleScale', 0.5, 1.8, 0.05, st.battleScale, target) : ''}
    <div class="row-btns"><button class="btn btn-glass" data-action="resetEdits" data-target="${target}">↺ 編集前の状態に戻す</button></div>
  </div>`;
}

const EXTRA_STAT_ROWS = [];   // 会心・回避・魔力等は基本ステータスとして表示しない
function coreLine(stats = {}) {
  const c = toCoreStats(stats);
  return STAT_KEYS.filter(k => c[k]).map(k => `${STAT_NAMES[k]}+${Math.round(c[k])}`).join(' / ') || '特殊効果のみ';
}
function statTable(st, extra = '') {
  return `<div class="stat-grid stat-grid-4">${STAT_KEYS.map(k => `
    <div class="stat-cell"><span>${STAT_ICONS[k]} ${STAT_NAMES[k]}</span><b>${fmt(st[k]||0)}</b></div>`).join('')}</div>`;
}

/* ============================ タイトル ============================ */
function titleScreen(app, s) {
  const has = hasSaveFlag() || s.characters.length > 0;
  const build = (typeof window !== 'undefined' && window.__OCF_BUILD__) || 'dev';
  const cacheWarn = (build === 'dev' || build === '__BUILD__')
    ? `<div class="cache-warn">⚠ キャッシュ無効化サーバー（<b>serve.py</b>）経由で開けていません。古い画面が残る場合は <b>python3 serve.py</b> で起動し直してください。</div>`
    : '';
  return `
  <div class="title-screen" style="background-image:url('assets/title_bg.jpg')">
    <div class="title-veil"></div>
    <div class="title-inner">
      <div class="title-crest">✦ ORIGINAL CHARACTER FIGHTERS ✦</div>
      <h1 class="game-title">オリキャラ<br><span>ファイターズ</span></h1>
      <p class="title-lead">あなたの一枚が、最強の戦士になる。<br>ゲームスタートで<b>街のホーム画面</b>へ。キャラクター作成も街から始められます。</p>
      <div class="title-menu">
        <button class="btn btn-primary btn-lg" data-action="titleStart">⚔　ゲームスタート</button>
        <button class="btn btn-glass btn-lg" data-action="titleContinue">📂　つづきから${has ? `<small>セーブデータあり</small>` : `<small>データなし</small>`}</button>
        <button class="btn btn-glass btn-lg" data-action="titleCodex">📖　図鑑</button>
        <button class="btn btn-glass btn-lg" data-action="titleSettings">⚙　設定</button>
      </div>
      ${cacheWarn}
      <div class="title-foot">ver 1.0 ・ build <b>${e(build)}</b> ・ PC / スマートフォン対応 ・ セーブは自動で端末に保存されます</div>
    </div>
  </div>`;
}

/* ============================ 共通ナビ ============================ */
function navBar(app, s) {
  const c = activeChar(s);
  const r = rankInfo(s);
  const links = [
    ['town','🏰','街'],['character','🧙','キャラ'],['codex','📖','図鑑'],['endgame','🏆','やり込み'],['settings','⚙','設定'],
  ];
  return `
  <header class="topbar">
    <div class="topbar-brand" data-action="nav" data-to="town"><span class="brand-mark">✦</span><span>オリキャラファイターズ</span></div>
    <div class="topbar-res">
      <span title="コイン">🪙 ${fmt(s.coins)}</span>
      <span title="対戦ポイント">🔷 ${fmt(s.bp)}</span>
      <span title="ランク">🏅 ${e(r.name)}</span>
      <span title="連勝">🔥 ${s.winStreak}</span>
    </div>
    <nav class="topbar-nav">${links.map(([to,ic,label]) => `<button class="nav-btn ${app.screen===to?'on':''}" data-action="nav" data-to="${to}"><span>${ic}</span>${label}</button>`).join('')}</nav>
    ${c ? `<div class="topbar-char" data-action="nav" data-to="character">${charImage(c,'tiny')}<span>${e(c.name)}<small>Lv.${c.level}</small></span></div>` : ''}
  </header>`;
}

function toastArea(app) { return `<div class="toast" id="toast" role="status">${e(app.toast||'')}</div>`; }

/* ============================ キャラクター作成 ============================ */
function stepIndicator(step) { return `<div class="step-ind"><span class="on">① 画像を選ぶ</span><span class="on">② 表示を調整</span><span class="on">③ 名前を付けて保存</span></div>`; }
function settingRow(label, key, min, max, stepv, value, hint, target='draft') { return setRow(label,key,min,max,stepv,value,target,hint); }

/** 編集中の下書きを charImage に渡せる形にする */
export function draftChar(d) {
  return { name:d?.name || '名無し', original:d?.original || '', sprite:d?.sprite || d?.original || '',
    imageSettings:d?.settings || defaultImageSettings(), transparentData:d?.transparentData || '',
    rarity:d?.rarity || 'R', frame:d?.frame || 'gold', aura:'none' };
}
function imagePicker(target, label = '画像を選ぶ') {
  const id = target === 'look' ? 'look' : 'create';
  return `<div class="image-picker">
    <label class="btn btn-primary full" for="${id}Upload">📁 ${label}（PNG / JPEG / WebP ほか）</label>
    <input id="${id}Upload" type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif" data-file="${target}" hidden>
    <label class="btn btn-glass full" for="${id}Camera">📷 スマホのカメラで撮影</label>
    <input id="${id}Camera" type="file" accept="image/*" capture="environment" data-file="${target}" hidden>
    <div class="row-btns"><button class="btn btn-mini ghost" data-action="createSample" data-target="${target}">サンプル画像を使う</button>
    ${target === 'create' ? '<button class="btn btn-mini ghost" data-action="loadDraft">下書きを読み込む</button>' : ''}</div>
  </div>`;
}
function jobPickGrid(d) {
  const jobs = JOBS.filter(j => j.tier === 1);
  return `<div class="job-pick-section">
    <h4>⚔ 初期職業 <small class="muted">一覧から押して選ぶだけ（全 ${jobs.length} 職・画面を開くとすぐ表示されます）</small></h4>
    <div class="job-pick-grid">${jobs.map(j=>`<button type="button" class="job-pick-card ${d.jobId===j.id?'selected':''}" data-action="selectJob" data-job="${j.id}" style="--jc:${j.color}">
      <span class="job-pick-top"><span class="job-pick-icon">${j.icon}</span><b>${e(j.name)}</b>${d.jobId===j.id?'<span class="pill on">選択中</span>':''}</span>
      <span class="job-pick-desc">${e(j.desc)}</span>
      <span class="job-pick-meta">武器：${j.weapons.map(e).join('・')}</span>
    </button>`).join('')}</div>
  </div>`;
}
function profileRow(d) {
  const job = JOB[d.jobId] || JOB.warrior;
  return `<div class="profile-row">
    <label class="field"><span>キャラクター名</span><input type="text" maxlength="16" placeholder="名前を入力" value="${e(d.name || '')}" data-draft="name"></label>
    <label class="field"><span>初期武器 <small class="muted">（職業を選ぶと自動更新）</small></span><select data-draft="weaponType">${job.weapons.map(w=>`<option value="${e(w)}" ${d.weaponType===w?'selected':''}>${e(w)}</option>`).join('')}</select></label>
    <label class="field"><span>スタイル</span><select data-draft="styleId">${STYLES.map(x=>`<option value="${x.id}" ${d.styleId===x.id?'selected':''}>${e(x.name)}</option>`).join('')}</select></label>
    <div class="row-btns"><button class="btn btn-glass" data-action="createSave">💾 保存</button>
      <button class="btn btn-primary btn-lg" data-action="createFinish">✨ 作成を完了する</button></div>
  </div>
  ${jobPickGrid(d)}`;
}
function createScreen(app, s) {
  const d = app.draft || { settings:defaultImageSettings(), name:'', jobId:'warrior', weaponType:'剣', styleId:'balanced', frame:'gold', original:'', sprite:'' };
  const st = { ...defaultImageSettings(), ...(d.settings || {}) };
  const pseudo = draftChar({ ...d, settings:st });
  const hasImg = !!d.original;
  return `${navBar(app,s)}<main class="page create-page">
    <div class="page-head"><div><h2>🎨 キャラクター作成</h2>
      <p>あなたの画像を<b>そのまま</b>使います。ドット絵変換・AI描き直し・色や顔の変更は一切ありません。</p></div>
      <button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ戻る</button></div>
    ${stepIndicator(1)}
    <div class="editor-grid">
      <section class="panel editor-preview">
        <div class="editor-preview-head"><h3>🖼 プレビュー（編集結果）</h3><span class="pill">${hasImg?`${e(d.meta?.name || '読み込み済み')} ${d.width||''}×${d.height||''}`:'画像未選択'}</span></div>
        <div class="editor-stage" id="draftStage">${hasImg ? charImage(pseudo,'editor') : `<div class="editor-empty"><span>🖼</span><b>画像を選んでください</b><p>写真・イラスト・アニメキャラ・自作OCなど、どんな画像でも使えます</p></div>`}</div>
        <div class="editor-stage-foot">
          <span class="muted small">🖐 プレビューをドラッグして位置調整 / ホイールで拡大縮小</span>
          <div class="row-btns tiny"><button class="btn btn-mini" data-action="centerImage" data-target="draft">⊕ 中央</button>
            <button class="btn btn-mini ghost" data-action="createCompare">${app.compare?'比較を閉じる':'元画像と比較'}</button></div>
        </div>
        ${app.compare && hasImg ? `<div class="compare-pair"><figure><img src="${e(d.original)}" alt="元画像"><figcaption>元画像（無加工）</figcaption></figure><figure>${charImage(pseudo,'compare')}<figcaption>編集後の表示</figcaption></figure></div>` : ''}
        ${imagePicker('create', hasImg?'画像を差し替える':'画像を選ぶ')}
        <div class="hint-box small">💡 元画像は常に別データとして保持されます。編集設定だけを保存するので、何度でもやり直せます。</div>
      </section>
      <section class="panel editor-controls"><h3>⚙ 表示設定</h3>${editorSettings('draft', st, {battle:false})}</section>
    </div>
    <section class="panel editor-profile"><h3>📝 プロフィールと保存</h3>${profileRow(d)}
      <div class="hint-box">「保存」は下書き（元画像＋設定＋名前）をセーブします。「作成を完了する」でキャラクター登録。画像を差し替えても育成データは消えません。</div></section>
  </main>${toastArea(app)}`;
}

/* ============================ キャラクター / 見た目 ============================ */
function appearanceScreen(app, s) {
  const c = s.characters.find(x=>x.id===app.look?.charId) || activeChar(s);
  if (!c) return `${navBar(app,s)}<main class="page">${noChar()}</main>`;
  const L = app.look || (app.look = {charId:c.id, settings:{...c.imageSettings}, sprite:c.sprite, original:c.original, image:null});
  const st = { ...defaultImageSettings(), ...(L.settings || {}) };
  const pseudo = draftChar({ ...L, settings:st, name:c.name, rarity:c.rarity, frame:c.frame });
  return `${navBar(app,s)}<main class="page create-page">
    <div class="page-head"><div><h2>🎨 見た目の変更</h2>
      <p>元画像はそのままに、表示設定だけを調整します。育成・職業・技・装備・戦績はすべて保持されます。</p></div>
      <button class="btn btn-ghost" data-action="nav" data-to="character">← キャラクターへ</button></div>
    <div class="callout violet">現在のキャラクター：<b>${e(c.name)}</b> / ${rankBadge(c.rarity)} / Lv.${c.level} / ${e(JOB[c.jobId].name)} / ${c.record.wins}勝 ${c.record.losses}敗　—　画像を差し替えてもこれらのデータは消えません。</div>
    <div class="editor-grid">
      <section class="panel editor-preview">
        <div class="editor-preview-head"><h3>🖼 プレビュー（編集結果）</h3>${rankBadge(c.rarity)}</div>
        <div class="editor-stage" id="lookStage">${charImage(pseudo,'editor')}</div>
        <div class="editor-stage-foot"><span class="muted small">🖐 ドラッグで位置調整 / ホイールで拡大縮小</span>
          <div class="row-btns tiny"><button class="btn btn-mini" data-action="centerImage" data-target="look">⊕ 中央</button>
          <button class="btn btn-mini ghost" data-action="createCompare">${app.compare?'比較を閉じる':'元画像と比較'}</button></div></div>
        ${app.compare ? `<div class="compare-pair"><figure><img src="${e(L.original)}" alt="元画像"><figcaption>元画像（無加工）</figcaption></figure><figure>${charImage(pseudo,'compare')}<figcaption>編集後の表示</figcaption></figure></div>` : ''}
        ${imagePicker('appearance','元画像を差し替える')}
        <h4 class="mt">オーラ（戦闘演出）</h4><div class="chip-row">${AURAS.map(a=>`<button class="btn btn-mini ${c.aura===a.id?'on':''}" data-action="buyAura" data-id="${a.id}" style="--rc:${a.color}">${a.id==='none'?'なし':e(a.name)}${a.cost?` 🪙${fmt(a.cost)}`:''}</button>`).join('')}</div>
      </section>
      <section class="panel editor-controls"><h3>⚙ 表示設定</h3>${editorSettings('look', st, {battle:true})}
        <div class="row-btns mt"><button class="btn btn-primary btn-lg full" data-action="saveLook">💾 この見た目を保存</button></div>
        <div class="hint-box small">戦闘画面でも同じ元画像を使用します。アスペクト比は保持され、必要以上の画質劣化はありません。</div></section>
    </div></main>${toastArea(app)}`;
}

/* ---------------- ストーリー / 素材集め / ヘルプ ---------------- */
const STORY_CHAPTERS = [
  { id:1, name:'第1章・旅立ち', text:'クリスタルタウンに一人の冒険者が現れた。まずは自分の姿を確かめ、街の施設を巡ろう。', cond:()=>true },
  { id:2, name:'第2章・初陣', text:'冒険者ギルドでCPUと手合わせし、初めての勝利を掴む。', cond:(s)=>s.stats.wins>=1 },
  { id:3, name:'第3章・鍛冶の火', text:'工房で武器を強化し、ランク進化の素材を集める。装備があなたを大きく変える。', cond:(s)=>s.stats.evolutions>=1||s.stats.equipEvolutions>=1 },
  { id:4, name:'第4章・進化の光', text:'レベルではなくランクの進化。全ステータスが跳ね上がり、新たな技が芽生える。', cond:(s)=>s.characters.some(c=>charRank(c.rarity)>0) },
  { id:5, name:'第5章・奥義の継承', text:'LRへの進化で職業の奥義が目覚める。指定の名を宿す者は、さらに特別な奥義を継ぐ。', cond:(s)=>s.characters.some(c=>c.ultimateSkills?.length) },
  { id:6, name:'第6章・虚無の王', text:'ダンジョンの最深部で待つ隠しボス。全ての育成をぶつけろ。', cond:(s)=>s.stats.hiddenKills>=1 },
];
function storyScreen(app, s) {
  const cur = s.story?.chapter || 1, seen = s.story?.seen || [];
  return `${navBar(app,s)}<main class="page"><div class="page-head"><div><h2>📖 ストーリー</h2><p>進行状況はセーブされます。街からいつでも読み返せます。</p></div><button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ戻る</button></div>
    <div class="story-list">${STORY_CHAPTERS.map(ch=>`<section class="story-chapter ${ch.id<=cur?'open':''} ${seen.includes(ch.id)?'read':''}">
      <div class="sc-head"><span class="pill ${ch.id<=cur?'on':'off'}">${ch.id<=cur?'解放済':'未解放'}</span><h3>${e(ch.name)}</h3></div>
      <p>${e(ch.text)}</p><small>${ch.cond(s)?'条件達成':'未達成'}${seen.includes(ch.id)?' / 読了':''}</small>
      ${ch.id===cur?`<button class="btn btn-mini" data-action="storyRead" data-id="${ch.id}">📖 読む</button>`:''}</section>`).join('')}</div>
    <div class="hint-box">章は育成・対戦・進化の進行に合わせて解放されます。現在の章：<b>第${cur}章</b> / 全 ${STORY_CHAPTERS.length} 章。</div></main>${toastArea(app)}`;
}
function gatherScreen(app, s) {
  const links = [
    ['⚔','CPU対戦','勝利で進化素材・ボス素材を入手','nav','facility','guild',0],
    ['🕳','ダンジョン','階層を進めて高ランク素材','nav','facility','guild',1],
    ['📜','修行クエスト','日替わり・修行クエスト報酬','nav','facility','training',2],
    ['✧','ガチャ10連','10連ボーナスでR素材','nav','facility','forge',1],
    ['🛒','道具屋・素材','R素材の購入と素材合成','nav','facility','shop',2],
  ];
  return `${navBar(app,s)}<main class="page"><div class="page-head"><div><h2>💠 素材集め</h2><p>8種類 × 5ランク = 40種の進化素材。入手先へ直行できます。</p></div><button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ戻る</button></div>
    <div class="home-menu">${links.map(([icon,name,desc,action,to,facility,tab])=>`<button class="home-menu-card" data-action="${action}" data-to="${to}" data-facility="${facility}" data-tab="${tab}" style="--hc:#9be9ff"><span class="hm-icon">${icon}</span><b>${e(name)}</b><small>${e(desc)}</small></button>`).join('')}</div>
    <div class="panel soft mt"><h4>📗 素材図鑑を確認</h4><p class="muted">素材をクリックすると必要個数・入手方法・合成先を確認できます。</p><button class="btn btn-glass" data-action="nav" data-to="codex" data-codex-tab="6">素材図鑑を開く</button></div></main>${toastArea(app)}`;
}
function helpScreen(app, s) {
  return `${navBar(app,s)}<main class="page"><div class="page-head"><div><h2>❓ ヘルプ / 遊び方</h2><p>各施設の使い方と育成の仕組み。閲覧してもゲームの進行状況は変わりません。</p></div><button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ戻る</button></div>
    <div class="callout gold">💡 <b>次にやるべきことは「ゲームのヒント」で確認できます。</b> 進行状況に合わせた目標・不足条件・施設への移動ボタンを表示します。
      <div class="row-btns mt"><button class="btn btn-primary btn-mini" data-action="nav" data-to="hints">💡 ゲームのヒントを開く</button></div></div>
    <h3 class="section-title">📚 システム解説 <small>全 ${HINT_CATEGORIES.length} 項目</small></h3>
    <div class="help-topics">${HINT_CATEGORIES.map(x=>`<section class="help-topic"><span>${x.icon}</span><div><b>${e(x.name)}</b><p>${e(x.text)}</p></div></section>`).join('')}</div>
    <div class="two-col mt"><section class="panel soft"><h3>🎮 あそび方</h3><ol class="flow">
      <li>タイトルで<b>ゲームスタート</b> → <b>街のホーム画面</b></li>
      <li>キャラクター未作成なら街の「キャラクターを作成する」から作成（完了後は街へ戻る）</li>
      <li>街の<b>5 つの施設カード</b>から育成の間・修行場・工房・道具屋・CPU対戦へ（工房内の「ガチャ」タブから武器ガチャ）</li>
      <li>基本ステータスは <b>HP / 攻撃力 / 防御力 / MP</b> の 4 種類。会心・回避・属性などは技や装備の特殊効果です</li>
      <li>施設の「🏰 街へ戻る」でいつでもホームに戻れます</li>
      <li>勝利でコイン・EXP・BP・素材を獲得。ランク進化で全ステータスが大幅上昇</li>
    </ol></section><section class="panel soft"><h3>⚒ 装備とランク</h3><ul class="flow">
      <li>装備はレアリティが高いほど攻撃力などが大幅に上昇。レベル・ランクでも調整されます</li>
      <li>高レア装備は会心・奥義威力・属性・追加ダメージ・防御貫通などが戦闘に反映されます</li>
      <li>装備を外すと上昇分は解除。同じ装備の重複加算も発生しません</li>
      <li>ランク進化 R→SR→SSR→UR→LR のボーナスは装備と別に永続保存されます</li>
      <li>役職変更は<b>ランクアップ時・転生時のみ</b>。通常画面では現在の役職を確認できます</li>
    </ul></section></div>
    <div class="two-col mt"><section class="panel soft"><h3>✦ 奥義</h3><ul class="flow">
      <li>LR進化で職業専用の奥義を習得。神は神専用奥義を習得します</li>
      <li>指定名（飯山 / 三尾 / すずそう / 河岡）は<b>R→SR進化時</b>に専用奥義を習得</li>
      <li>奥義は専用ゲージが 100% で使用可能。使用後は 0 に戻り連続使用できません</li>
      <li>威力はランク・能力値・装備・職業で強化。専用演出と効果音付き</li>
    </ul></section><section class="panel soft"><h3>AUTO とセーブ</h3><ul class="flow">
      <li>戦闘中いつでも AUTO / 手動を切替。ターンは飛びません</li>
      <li>AUTO 中は 1倍 / 2倍 / 3倍速を切替。OFF なら通常速度に戻ります</li>
      <li>戦闘中の表示サイズ変更は廃止。開始前の「見た目の変更」で設定し固定です</li>
      <li>役職・役職変更履歴・AUTO設定・奥義・神の解放・ストーリー進行はすべてセーブされます</li>
    </ul></section></div></main>${toastArea(app)}`;
}

/* ---------------- 役職変更の機会（ランクアップ / 転生のみ） ---------------- */
function jobChangeModal(app, s) {
  const o = app.jobChangeOffer;
  if (!o) return '';
  const c = activeChar(s);
  if (!c) return '';
  const candidates = jobChangeCandidates(s, c);
  const cur = JOB[c.jobId];
  return `<div class="modal-backdrop job-change-modal"><div class="modal-card wide">
    <h3>✵ ${o.reason==='rebirth'?'転生':'ランクアップ'}：役職変更の機会</h3>
    <p class="muted small">${o.reason==='rebirth'?'転生':'ランクが上がった'}タイミングでのみ役職を変更できます。変更しなければ現在の役職を維持します。</p>
    <div class="callout">現在の役職：<b>${cur.icon} ${e(cur.name)}</b> / ランク ${e(c.rarity)} / ${c.specialKey?`<span class="pill on">特殊ギミック：${e(SPECIAL_NAME_LABEL[c.specialKey])}</span>`:''}</div>
    <h4 class="mt">変更先を選ぶ（解放済み ${candidates.length} 職）</h4>
    <div class="job-change-grid">${candidates.map(j=>`<button class="job-pick-card ${j.req?.god?'god':''}" data-action="jobChangePick" data-job="${j.id}" style="--jc:${j.color}">
      <span class="job-pick-top"><span class="job-pick-icon">${j.icon}</span><b>${e(j.name)}</b>${j.req?.god?'<span class="pill on">神</span>':''}</span>
      <span class="job-pick-desc">${e(j.desc)}</span><span class="job-pick-meta">${e(jobReqText(j))} / ${fmt(j.tier*500)}コイン</span></button>`).join('') || '<p class="muted">現在変更できる役職はありません。</p>'}</div>
    <div class="row-btns mt"><button class="btn btn-primary btn-lg" data-action="jobChangeKeep">現在の役職を維持する</button></div>
    <div class="hint-box small">この選択はセーブされ、ランクアップ時・転生時の役職変更履歴として残ります。</div>
  </div></div>`;
}

/* ---------------- ゲームのヒント（進行状況から自動生成） ---------------- */
function hintAction(a, cls = 'btn-glass') {
  if (!a) return '';
  return `<button class="btn btn-mini ${cls}" data-action="${a.action}"
    ${a.to ? `data-to="${a.to}"` : ''} ${a.facility ? `data-facility="${a.facility}"` : ''}
    ${a.tab !== undefined ? `data-tab="${a.tab}"` : ''}>${e(a.label)}</button>`;
}
function hintCondRow(ch) {
  return `<div class="hint-cond ${ch.met ? 'ok' : 'todo'}">
    <span class="hc-mark">${ch.met ? '✔' : '○'}</span>
    <div class="hc-body"><b>${e(ch.label)}</b>${ch.detail ? `<small class="${ch.met ? '' : 'short'}">${ch.met ? '' : '⚠ '}${e(ch.detail)}</small>` : ''}</div>
    ${hintAction(ch.jump)}</div>`;
}
/** 街のホーム画面だけに出す小さなヒント。戦闘中・操作中には一切出さない */
function hintBanner(app, s) {
  const H = hintState(s);
  if (H.bannerDismissed) return '';
  return `<div class="hint-banner">
    <span class="hb-icon">💡</span>
    <div class="hb-text"><b>${e(H.bannerText)}</b><small>${e(H.next.desc)}</small></div>
    <div class="hb-btns"><button class="btn btn-mini btn-primary" data-action="nav" data-to="hints">ヒントを見る</button>
      <button class="btn btn-mini btn-ghost" data-action="hintDismiss" data-key="${e(H.bannerKey)}">閉じる</button></div>
  </div>`;
}
function hintsScreen(app, s) {
  const H = hintState(s);
  const N = H.next;
  const cid = app.hintCategory && app.hintCategory !== 'next' ? app.hintCategory : N.category;
  const cat = H.categories.find(x => x.id === cid) || H.categories[0];
  const chip = (icon, label, val) => `<span class="hint-chip">${icon} ${label} <b>${e(String(val))}</b></span>`;
  return `${navBar(app,s)}<main class="page hints-page">
    <div class="page-head"><div><h2>💡 ゲームのヒント</h2><p>いまの進行状況から、次にやるべきことと必要な条件を自動で案内します。</p></div>
      <button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ戻る</button></div>

    <section class="hint-next">
      <div class="hn-eye">🎯 次にやるべきこと</div>
      <h2>次の目標：${e(N.title)}</h2>
      <p class="hn-desc">${e(N.desc)}</p>
      <div class="hint-chips">${chip('🧙','キャラ',H.summary.hasChar?'作成済み':'未作成')}${chip('📈','Lv',H.summary.level)}
        ${chip('✦','ランク',H.summary.rarity)}${chip('⚒','装備',`${H.summary.equipped}/${H.summary.slots}`)}
        ${chip('🪙','コイン',fmt(H.summary.coins))}${chip('💠','素材種',H.summary.matKinds)}
        ${chip('📜','章',H.summary.storyChapter)}${chip('🏛','対戦',`${H.summary.wins}勝`)}</div>
      <h4>達成に必要な条件 <small>${N.conditions.filter(x=>x.met).length} / ${N.conditions.length} 満たしています</small></h4>
      <div class="hint-conds">${N.conditions.map(hintCondRow).join('')}</div>
      <div class="hint-actions">${N.actions.map(a=>hintAction(a,'btn-primary')).join('')}</div>
      <div class="hint-progress">🏁 主要な目標 ${H.completed} / ${H.goalCount} 達成済み　${H.unlocks.length?`<span class="hint-unlock">${e(H.unlocks.map(u=>u.text).join(' ／ '))}</span>`:''}</div>
    </section>

    <section class="hint-reward ${H.reward.claimed ? 'claimed' : ''}">
      <div class="hr-eye">🎁 ゲーム開始記念ボーナス</div>
      <div class="hr-main">🪙 ${fmt(H.reward.claimed ? H.reward.coins : H.reward.amount)} コイン</div>
      <div class="hr-sub">「装備ガチャ ${H.reward.pulls} 連分」<small>1 回 ${fmt(H.reward.perPull)} コイン × ${H.reward.pulls}　/　現在の消費コインから自動計算（固定値ではありません）</small></div>
      ${H.reward.claimed
        ? `<p class="muted small">✅ 受け取り済みです。1 アカウントにつき 1 回のみで、再受取はできません。</p>
           <div class="hint-actions">${hintAction({label:'✧ 装備ガチャを引く',action:'nav',to:'facility',facility:'forge',tab:1},'btn-primary')}
           ${hintAction({label:'🏰 街のホーム画面に戻る',action:'nav',to:'town'},'btn-glass')}</div>`
        : `<div class="hint-actions"><button class="btn btn-primary" data-action="hintClaim">🪙 コインを受け取る</button></div>`}
    </section>

    <h3 class="section-title">📚 ヒントの分類 <small>全 ${H.categories.length} カテゴリ</small></h3>
    <div class="hint-cats">${H.categories.map(x=>`<button class="hint-cat ${x.id===cat.id?'sel':''} ${x.met?'done':''}" data-action="hintCategory" data-cat="${x.id}">
      <span>${x.icon}</span><b>${e(x.name)}</b><small>${x.met?'✔ 達成済み':'○ 挑戦中'}</small></button>`).join('')}</div>

    <section class="hint-detail">
      <div class="hd-head"><span class="hd-icon">${cat.icon}</span><div><h3>${e(cat.name)}</h3><p>${e(cat.text)}</p></div>
        <span class="pill ${cat.met?'on':''}">${cat.met?'達成済み':'これから'}</span></div>
      <div class="hd-status">📊 現在の状況：<b>${e(cat.status)}</b></div>
      <h4>🎯 具体的な目標：${e(cat.goal)}</h4>
      <div class="hint-conds">${cat.conditions.map(hintCondRow).join('') || '<p class="muted">条件はありません</p>'}</div>
      <div class="hint-actions">${cat.actions.map(a=>hintAction(a,'btn-primary')).join('')}</div>
    </section>
    <div class="hint-foot"><button class="btn btn-ghost btn-mini" data-action="hintShowBanner">🔔 街のホームにヒントを再表示する</button>
      <span class="muted small">ヒントは閲覧するだけでは進行状況・所持アイテムは変化しません。閉じても「💡 ゲームのヒント」からいつでも確認できます。</span></div>
  </main>${toastArea(app)}`;
}

/* ============================ 街 ============================ */
function townScreen(app, s) {
  const c = activeChar(s);
  const st = c ? computeStats(c,s) : null;
  const r = rankInfo(s);
  return `${navBar(app,s)}
  <main class="page town-page" style="background-image:linear-gradient(180deg,rgba(9,13,28,.86),rgba(9,13,28,.96)),url('assets/title_bg.jpg')">
    <div class="town-hero">
      <div class="town-char">${c ? `<div class="char-portrait ${c.frame}">${charImage(c,'portrait')}</div>` : ''}</div>
      <div class="town-info">
        <div class="eyebrow">✦ 冒険の拠点・クリスタルタウン</div>
        <h2>${c ? e(c.name) : 'キャラクター未作成'} <small>${c ? `Lv.${c.level} / ${JOB[c.jobId].name} / ${AWAKENING_NAMES[c.awakening]}` : ''}</small></h2>
        ${c ? `<div class="town-bars">${bar(c.hp,st.hp,'linear-gradient(90deg,#ff6b6b,#ff9e7a)',`HP ${fmt(c.hp)} / ${fmt(st.hp)}`)}${bar(c.mp,st.mp,'linear-gradient(90deg,#5b9dff,#8ce6ff)',`MP ${fmt(c.mp)} / ${fmt(st.mp)}`)}${bar(c.exp,xpForLevel(c.level),'linear-gradient(90deg,#ffd77a,#ffe9a8)',`EXP ${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}`)}</div>` : '<p>まずはキャラクターを作成しましょう。</p>'}
        <div class="town-metrics">${c ? `${rankBadge(c?.rarity || 'R')}<span>⚔ 戦闘力 <b>${fmt(powerScore(c,s))}</b></span><span>🏅 ${e(r.name)}</span><span>🔥 連勝 ${s.winStreak} / 最高 ${s.bestStreak}</span><span>📊 ${s.stats.wins}勝 ${s.stats.losses}敗</span>` : ''}</div>
      </div>
      <div class="town-quick">
        ${!c ? `<button class="btn btn-primary btn-lg home-create" data-action="newChar">🎨 キャラクターを作成する</button>` : ''}
        <button class="btn btn-primary" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">⚔ CPU対戦へ</button>
        <button class="btn btn-glass" data-action="nav" data-to="character">🧙 キャラクター</button>
        <button class="btn btn-glass" data-action="nav" data-to="codex">📖 図鑑</button>
        <button class="btn btn-primary" data-action="nav" data-to="hints">💡 ゲームのヒント</button>
        <button class="btn btn-glass" data-action="nav" data-to="help">📖 遊び方</button>
        <button class="btn btn-glass" data-action="nav" data-to="endgame">🏆 やり込み</button>
        ${c ? `<button class="btn btn-glass" data-action="newChar">🎨 新規作成</button>` : ''}
        <button class="btn btn-ghost" data-action="saveNow">💾 今すぐセーブ</button>
      </div>
      ${c && c.specialKey ? `<div class="callout gold">✵ 特殊ギミック発動：<b>${e(SPECIAL_NAME_LABEL[c.specialKey])}</b> の名を宿す者。特殊役職「神」と専用奥義が解放されています。${c.godUnlocked && c.jobId===GOD_JOB_ID ? '現在「神」に就いています。' : '役職変更はランクアップ時・転生時のみ可能です。'}</div>` : ''}
    </div>
    ${hintBanner(app,s)}
    ${!c ? `<div class="home-create-banner"><div><h3>🎨 まずはキャラクターを作成しよう</h3><p>元画像をそのまま使って、街の施設で育成・装備・ガチャ・対戦ができます。</p></div><button class="btn btn-primary btn-lg" data-action="newChar">キャラクターを作成する →</button></div>` : ''}
    <h3 class="section-title">🏛 5つの施設 <small>それぞれの背景はあなたが添付した画像をそのまま使用しています</small></h3>
    <div class="facility-cards">${FACILITIES.map(f => `
      <button class="facility-card" data-action="nav" data-to="facility" data-facility="${f.id}" style="--accent:${f.color}">
        <div class="fc-img" style="background-image:url('${f.img}')"></div>
        <div class="fc-body"><span class="fc-icon">${f.icon}</span><b>${e(f.name)}</b><small>${e(f.sub)}</small><span class="fc-go">入る →</span></div>
      </button>`).join('')}</div>
    <div class="town-bottom">
      <div class="panel mini-panel"><h4>📜 進行中のクエスト</h4>${QUESTS.filter(q=>!questClaimed(s,q)).slice(0,3).map(q=>`<div class="list-line"><span>${e(q.name)}</span><b>${Math.min(q.need,questProgress(s,q))} / ${q.need}</b></div>`).join('')}<button class="btn btn-ghost full" data-action="nav" data-to="facility" data-facility="guild" data-tab="2">クエスト一覧</button></div>
      <div class="panel mini-panel"><h4>🏆 最近の育成記録</h4>${s.log.slice(0,4).map(l=>`<div class="log-line"><span>${new Date(l.t).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span> ${e(l.text)}</div>`).join('') || '<p class="muted">まだ記録がありません</p>'}<button class="btn btn-ghost full" data-action="nav" data-to="endgame">全記録を見る</button></div>
      <div class="panel mini-panel"><h4>💠 所持ポイント</h4><div class="list-line"><span>🪙 コイン</span><b>${fmt(s.coins)}</b></div><div class="list-line"><span>🔷 対戦ポイント</span><b>${fmt(s.bp)}</b></div><div class="list-line"><span>🏅 ランクP</span><b>${fmt(s.rankPoints)}</b></div><button class="btn btn-ghost full" data-action="nav" data-to="facility" data-facility="guild" data-tab="3">交換所へ</button></div>
    </div>
  </main>${toastArea(app)}`;
}

/* ============================ 施設 ============================ */
function facilityScreen(app, s) {
  const f = FACILITIES.find(x => x.id === app.params.facility) || FACILITIES[0];
  const tab = app.tabs[f.id] ?? 0;
  app.tabs[f.id] = tab;
  const tabName = f.tabs[tab];
  let content = '';
  if (f.id === 'nurture') content = nurtureTab(tab, app, s);
  if (f.id === 'forge') content = forgeTab(tab, app, s);
  if (f.id === 'training') content = trainingTab(tab, app, s);
  if (f.id === 'guild') content = guildTab(tab, app, s);
  if (f.id === 'shop') content = shopTab(tab, app, s);
  return `
  <div class="facility-screen" style="--accent:${f.color}">
    <div class="facility-bg" style="background-image:url('${f.img}')"></div><div class="facility-shade"></div>
    ${navBar(app,s)}
    <main class="facility-shell">
      <div class="facility-head"><div><div class="eyebrow">FACILITY ・ ${String(FACILITIES.indexOf(f)+1).padStart(2,'0')}</div><h2>${f.icon} ${e(f.name)}</h2><p>${e(f.sub)}</p></div><button class="btn btn-glass" data-action="nav" data-to="town">🏰 街へ戻る</button></div>
      <div class="facility-switch">${FACILITIES.map(x=>`<button class="fswitch ${x.id===f.id?'on':''}" data-action="nav" data-to="facility" data-facility="${x.id}" style="--accent:${x.color}">${x.icon} ${e(x.name)}</button>`).join('')}</div>
      <div class="facility-tabs">${f.tabs.map((t,i)=>`<button class="ftab ${i===tab?'on':''}" data-action="tab" data-facility="${f.id}" data-i="${i}">${e(t)}</button>`).join('')}</div>
      <section class="facility-panel"><h3 class="tab-title">${e(tabName)}</h3>${content}</section>
    </main>
  </div>${toastArea(app)}`;
}

/* ============================ 進化・素材 ============================ */
function equipGlyph(type) {
  const shapes = {
    '剣':'<path d="M30 8h4l2 34h-8zM24 42h16v4H24zM29 46h6v12h-6z"/><path d="M30 8h4l1 20h-6z" opacity=".55"/>',
    '銃':'<path d="M8 27h38v6H8zM46 24h12v4H46zM20 33h6l4 18h-8z"/><circle cx="17" cy="30" r="4" opacity=".6"/>',
    '杖':'<path d="M29 16h5v42h-5z"/><circle cx="31.5" cy="12" r="9"/><circle cx="31.5" cy="12" r="4" opacity=".55"/>',
    '斧':'<path d="M28 10h6v48h-6zM34 12c12-4 18 2 18 12 0 8-8 14-18 14z"/><path d="M26 16c-8 0-12 6-12 12s4 12 10 14z" opacity=".7"/>',
    '槍':'<path d="M30 4l5 12-5 10-5-10zM29 25h5v35h-5z"/><path d="M31 4v22" opacity=".5"/>',
    '弓':'<path d="M20 6c16 8 16 44 0 52" fill="none" stroke-width="5"/><path d="M20 6v52" fill="none" stroke-width="1.6"/><path d="M22 32h28" stroke-width="2"/>',
    '拳':'<path d="M14 24h30v20c0 10-8 14-15 14S14 54 14 44z"/><path d="M14 24h6v-6h5v6h5v-8h5v8h5v-6h4v6z"/>',
    '短剣':'<path d="M29 20h6l1 18h-8zM23 38h18v4H23zM29 42h6v12h-6z"/><circle cx="32" cy="17" r="5" opacity=".6"/>',
    '特殊':'<rect x="14" y="14" width="36" height="36" rx="4" fill="none" stroke-width="4"/><circle cx="32" cy="32" r="9"/><path d="M32 8v10M32 46v10M8 32h10M46 32h10"/>',
    '軽装':'<path d="M22 12h20l10 10-6 8-4-3v27H22V27l-4 3-6-8z"/>',
    '重装':'<path d="M18 14h28l8 10-6 10-4-4v24H20V30l-4 4-6-10z"/><path d="M24 20h16v18H24z" opacity=".5"/>',
    '法衣':'<path d="M24 10h16l8 14-4 30H20L16 24z"/><path d="M32 10v44" opacity=".5"/>',
    '忍装':'<path d="M20 14h24l6 10-8 6-2 24H24l-2-24-8-6z"/><path d="M22 20h20v6H22z" opacity=".6"/>',
    '指輪':'<circle cx="32" cy="36" r="16" fill="none" stroke-width="7"/><path d="M26 14l6-9 6 9-6 7z"/>',
    '護符':'<path d="M20 8h24v40l-12 10-12-10z"/><circle cx="32" cy="28" r="8" opacity=".6"/>',
    '眼飾り':'<path d="M6 30c10-12 42-12 52 0-10 12-42 12-52 0z" fill="none" stroke-width="4"/><circle cx="32" cy="30" r="8"/>',
    '帯':'<path d="M8 24h48v16H8z"/><path d="M26 24h12v16H26z" opacity=".6"/>',
  };
  return shapes[type] || '<rect x="16" y="16" width="32" height="32" rx="6"/><circle cx="32" cy="32" r="9" opacity=".6"/>';
}
function equipRankVisual(def, rank, size = 112) {
  const r = CHAR_RARITY[rank] || CHAR_RARITY.R;
  const deco = { R:'', SR:'<circle class="eq-ring" cx="32" cy="32" r="27"/>',
    SSR:'<circle class="eq-ring" cx="32" cy="32" r="28"/><g class="eq-rays"><path d="M32 2v8M32 54v8M2 32h8M54 32h8M11 11l6 6M47 47l6 6M53 11l-6 6M17 47l-6 6"/></g>',
    UR:'<circle class="eq-ring" cx="32" cy="32" r="28"/><path class="eq-crown" d="M16 14l6 6 10-12 10 12 6-6-3 12H19z"/><g class="eq-sparks"><circle cx="9" cy="20" r="2"/><circle cx="55" cy="18" r="2"/><circle cx="12" cy="50" r="2"/><circle cx="52" cy="48" r="2"/></g>',
    LR:'<circle class="eq-ring rainbow" cx="32" cy="32" r="29"/><path class="eq-crown" d="M14 12l7 7 11-13 11 13 7-7-3 14H17z"/><g class="eq-sparks"><circle cx="7" cy="22" r="2.4"/><circle cx="57" cy="20" r="2.4"/><circle cx="10" cy="52" r="2.4"/><circle cx="54" cy="50" r="2.4"/><circle cx="32" cy="4" r="2.4"/></g>' }[rank] || '';
  return `<span class="eq-rank-visual ${r.css}" style="--eqc:${r.color};width:${size}px;height:${size}px">
    <svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-label="${e(def?.type||'装備')}">
      ${deco}<g class="eq-shape" fill="${r.color}" stroke="${r.color}" stroke-linejoin="round">${equipGlyph(def?.type)}</g>
    </svg></span>`;
}
function rankLine(rank, active) {
  const r = CHAR_RARITY[rank];
  return `<div class="rank-ladder-step ${r.css} ${active?'active':''}"><b>${r.name}</b><small>${e(r.label)}</small></div>`;
}
function materialReqList(mats, s) {
  return `<div class="mat-req-list">${mats.map(m => `<div class="mat-req ${m.have>=m.n?'ok':'bad'}" data-action="matDetail" data-id="${m.id}" role="button" tabindex="0">
    ${itemIcon(m.id,40)}<div><b>${e(MATERIAL_BY_ID[m.id]?.name || m.id)}</b><small>${e(MATERIAL_BY_ID[m.id]?.rank || '')} / ${e(MATERIAL_BY_ID[m.id]?.obtain || '')}</small></div>
    <span class="mat-count"><b class="${m.have>=m.n?'ok':'bad'}">${m.have}</b> / ${m.n}</span></div>`).join('')}</div>`;
}
function evolutionScreen(app, s) {
  const c = activeChar(s); if (!c) return noChar();
  const p = evolutionPreview(s, c);
  const cur = charRank(c);
  const next = p.nextRank;
  const after = p.max ? null : { ...c, rarity: p.rule.to };
  const res = app.evoResult?.type === 'char' ? app.evoResult.r : null;
  return `<div class="evo-screen">
    ${res ? `<div class="callout gold evo-result"><b>✨ ${e(res.rule.from)} → ${e(res.rule.to)} 進化完了</b>
      <div>上昇ステータス：${res.gains.map(g=>`${e(STAT_NAMES[g.key]||g.key)} +${g.value}`).join(' / ') || '—'}</div>
      <div>解放された技：<b>${e(res.skill?.name||'')}</b> ／ ${e(res.rule.gain)} ／ レベル・名前・元画像・職業・技・装備・戦績は維持</div>
      <button class="btn btn-mini ghost" data-action="evoResultClose">閉じる</button></div>` : ''}
    <div class="callout violet">🔰 <b>レベルとレアリティは別管理</b>です。レベルアップでレアリティは上がらず、進化ではレベル・名前・元画像・職業・習得済みの技・装備・戦績がすべて保持されます。</div>
    <div class="evo-ladder">${CHAR_RARITY_ORDER.map(r=>rankLine(r, r===c.rarity)).join('')}</div>
    <div class="two-col">
      <div class="panel soft"><h4>📊 現在 → 進化後</h4>
        <div class="evo-compare">
          <div class="evo-side"><h5>現在</h5>${charImage(c,'evo')}${rankBadge(c.rarity)}<div class="evo-facts"><span>レベル <b>Lv.${c.level}</b></span><span>戦闘力 <b>${fmt(powerScore(c,s))}</b></span><span>EXP <b>${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}</b></span></div>${statTable(p.beforeStats || computeStats(c,s))}</div>
          <div class="evo-arrow">➜</div>
          <div class="evo-side next">${p.max ? `<h5>最終ランク</h5>${charImage(c,'evo')}<div class="callout gold">LR に到達済み。転生でさらなる成長を。</div>` : `<h5>進化後（${e(p.rule.to)}）</h5>${charImage(after,'evo')}${rankBadge(p.rule.to)}<div class="evo-facts"><span>レベル <b>Lv.${c.level}（維持）</b></span><span>戦闘力 <b>${fmt(powerScore(after,s))}</b></span><span>習得技 <b>+${e(p.skill?.name||'')}</b></span></div>${statTable(p.afterStats)}`}</div>
        </div>
        <div class="hint-box small">進化後も元画像は差し替えられません。ランクごとの光・装飾・粒子は画像に重ねるだけで、顔や衣類は隠れません。</div>
      </div>
      <div class="panel soft"><h4>✦ 進化条件 ${p.max?'':`${e(p.rule.from)} → ${e(p.rule.to)}`}</h4>
        ${p.max ? '<div class="callout gold">R → SR → SSR → UR → LR の全段階を達成しました！</div>' : `
        <div class="evo-conds">
          <div class="list-line"><span>必要レベル</span><b class="${c.level>=p.rule.level?'ok':'bad'}">Lv.${p.rule.level}（現在 Lv.${c.level}）</b></div>
          <div class="list-line"><span>必要コイン</span><b class="${s.coins>=p.rule.coins?'ok':'bad'}">🪙 ${fmt(p.rule.coins)}（所持 ${fmt(s.coins)}）</b></div>
          <div class="list-line"><span>ステータス上昇</span><b>${e(p.rule.gain)}</b></div>
          <div class="list-line"><span>解放技</span><b>${e(p.skill?.name||'')}</b></div>
          <h4 class="mt">必要素材（クリックで詳細）</h4>${materialReqList(p.mats,s)}
          ${p.ok ? `<button class="btn btn-primary btn-lg full" data-action="evolveChar">✦ 進化を実行する</button>`
            : `<button class="btn btn-ghost full" disabled>条件が揃っていません</button><div class="hint-box">不足：${p.reasons.map(e).join(' / ')}</div>`}
        </div>`}
        <h4 class="mt">📈 レベル成長</h4>
        ${bar(c.exp,xpForLevel(c.level),'linear-gradient(90deg,#ffd77a,#ffe9a8)',`EXP ${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}`)}
        <div class="hint-box small">CPU対戦・ダンジョン・修行・クエストでEXPを獲得。必要EXPはレベルごとに増加し、レベルアップで全能力上昇＋振り分けポイント＋4、HP/MP全回復。上限到達後は転生で伸ばせます（上限 Lv.${levelCap(c)}）。</div>
        <div class="row-btns"><button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="nurture" data-tab="0">ステータスへ</button><button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="forge" data-tab="4">装備ランク進化へ</button></div>
      </div></div>
    <div class="panel soft mt"><h4>⚒ 武器・装備のランク進化 <small class="muted">育成の間からも実行できます</small></h4>
      ${SLOTS.map(slot=>{
        const inst=findInstance(s,c.equipment[slot]);
        if(!inst) return `<div class="list-line"><span>${e(SLOT_NAME[slot])}</span><b class="muted">未装備</b></div>`;
        const p=equipmentEvolvePreview(s,inst.uid), def=instanceDef(inst), rk=instanceRank(inst);
        return `<div class="eq-mini-evo"><div>${equipRankVisual(def,rk,52)}<div><b>${e(def.name)}</b> ${rankBadge(rk)}<small>${e(SLOT_NAME[slot])} / ${e(def.type)} / 攻撃 ${p.before?.atk||0} → ${p.after?.atk||p.before?.atk||0}${p.max?'（最終）':''}</small></div></div>
          ${p.max?'<span class="pill on">LR 到達</span>':`<button class="btn btn-mini" data-action="evolveEquip" data-uid="${inst.uid}" ${p.ok?'':'disabled'}>${rankBadge(p.next)} へ進化</button>`}</div>`;
      }).join('')}
      <div class="hint-box small">武器の種類・形状・特徴は維持したまま、攻撃力と特殊効果を強化しランク固有の装飾を追加します。詳細は <button class="btn btn-mini ghost" data-action="nav" data-to="facility" data-facility="forge" data-tab="4">工房のランク進化</button> へ。</div>
    </div>
    <div class="panel soft mt"><h4>🎁 所持素材一覧</h4>${materialGrid(app,s,Object.entries(s.inventory.items).filter(([id,n])=>isMaterial(id)&&n>0))}</div>
  </div>`;
}
function equipmentEvolutionScreen(app, s) {
  const selUid = app.evolveEquip || s.inventory.equipment[0]?.uid;
  const p = equipmentEvolvePreview(s, selUid);
  const insts = s.inventory.equipment.slice(0, 80);
  return `<div class="callout gold">⚒ <b>武器・防具・装飾品のランク進化</b>。武器の種類・形状・特徴はそのままに、攻撃力と特殊効果を強化し、ランク固有の装飾と発光を追加します（R → SR → SSR → UR → LR）。</div>
  <div class="two-col">
    <div class="panel soft"><h4>装備を選択</h4><div class="equip-list">${insts.map(inst=>{
      const def=instanceDef(inst), rank=instanceRank(inst);
      return `<div class="equip-line ${selUid===inst.uid?'sel':''}"><span class="eq-glow" style="--rc:${def.color}"></span>
        <div class="eq-main"><b style="color:${def.color}">${e(def.name)} <small>+${inst.enhance||0}</small></b><small>${e(def.type)} / ${e(SLOT_NAME[def.slot])}</small></div>
        ${rankBadge(rank)}<button class="btn btn-mini" data-action="equipEvolveSelect" data-uid="${inst.uid}">選択</button></div>`;
    }).join('') || '<p class="muted">装備がありません</p>'}</div></div>
    <div class="panel soft"><h4>進化プレビュー</h4>
      ${p.inst ? `<div class="eq-evo-compare">
        <div class="eq-evo-side"><h5>現在 ${rankBadge(p.cur)}</h5>${equipRankVisual(p.def,p.cur,120)}<b>${e(p.def.name)}</b><small>${e(p.def.type)} / ${e(p.def.rarity)}</small>${statTable(p.before)}</div>
        <div class="evo-arrow">➜</div>
        ${p.max ? '<div class="eq-evo-side"><h5>最終ランク</h5><div class="callout gold">LR 到達済み</div></div>' : `<div class="eq-evo-side next"><h5>進化後 ${rankBadge(p.next)}</h5>${equipRankVisual(p.def,p.next,120)}<b>${e(p.def.name)}</b><small>形状・種類は維持 / ${e(p.nextInfo.decor)}</small>${statTable(p.after)}<div class="hint-box small">攻撃力・特殊効果が上昇。${e(p.nextInfo.label)}</div></div>`}
      </div>
      ${p.max ? '' : `<div class="list-line"><span>必要コイン</span><b class="${s.coins>=p.coins?'ok':'bad'}">🪙 ${fmt(p.coins)}（所持 ${fmt(s.coins)}）</b></div>
        <h4 class="mt">必要素材</h4>${materialReqList(p.mats,s)}
        ${p.ok?`<button class="btn btn-primary btn-lg full" data-action="evolveEquip" data-uid="${selUid}">⚒ ランク進化を実行</button>`:`<button class="btn btn-ghost full" disabled>条件が揃っていません</button><div class="hint-box">不足：${p.reasons.map(e).join(' / ')}</div>`}`}`
      : '<p class="muted">装備を選択してください</p>'}
    </div></div>
    <div class="panel soft mt"><h4>🎁 所持素材</h4>${materialGrid(app,s,Object.entries(s.inventory.items).filter(([id,n])=>isMaterial(id)&&n>0))}</div>`;
}
function materialGrid(app, s, entries) {
  if (!entries.length) return '<p class="muted">素材を持っていません。CPU対戦・ダンジョン・修行・クエストで入手できます。</p>';
  return `<div class="mat-grid">${entries.map(([id,n])=>{
    const m=MATERIAL_BY_ID[id]; if(!m) return '';
    return `<button class="mat-card mat-${m.rank}" data-action="matDetail" data-id="${id}">
      ${itemIcon(id,54)}<b>${e(m.name)}</b><span class="mat-rank ${CHAR_RARITY[m.rank]?.css||''}">${m.rank}</span><small>×${n}</small></button>`;
  }).join('')}</div>`;
}
function materialCodex(app, s) {
  const owned = MATERIAL_ITEMS.filter(m=>itemCount(s,m.id)>0 || s.catalog.materials.includes(m.id));
  return `<div class="callout violet">📖 素材図鑑：<b>${owned.length} / ${MATERIAL_ITEMS.length}</b> 発見。8種類 × 5ランク＝40種。形・模様・質感・装飾・光り方が種類とランクごとに異なります。カードをクリックすると詳細が開きます。</div>
    ${MAT_RANKS.map(r=>`<h4 class="mt">${r} ランク <small class="muted">${e(MAT_RANK_INFO[r].label)} / ${e(MAT_RANK_INFO[r].source)}</small></h4>
      <div class="mat-codex-row">${MATERIAL_ITEMS.filter(m=>m.rank===r).map(m=>{
        const seen=s.catalog.materials.includes(m.id)||itemCount(s,m.id)>0;
        return `<button class="mat-card mat-${r} ${seen?'':'unknown'}" data-action="matDetail" data-id="${m.id}">
          ${itemIcon(m.id,54)}<b>${seen?e(m.name):'？？？'}</b><span class="mat-rank">${r}</span><small>${seen?`所持 ${itemCount(s,m.id)}`:'未発見'}</small></button>`;
      }).join('')}</div>`).join('')}
    <div class="hint-box">低ランク素材も上位進化の条件に残るため無駄になりません。余剰素材は「3個 → 上位ランク1個」の素材合成・交換に使えます。</div>`;
}
function materialModal(app, s) {
  const id = app.materialDetail;
  const m = MATERIAL_BY_ID[id];
  if (!m) return '';
  const uses = Object.entries(RANK_REQUIREMENTS).filter(([,list])=>list.some(x=>x.id===id))
    .map(([rank,list])=>({ rank, n:list.find(x=>x.id===id).n }));
  const target = materialUpgradeTarget(id);
  const step = MAT_RANKS.indexOf(m.rank)+1;
  return `<div class="modal-backdrop" data-action="matDetailClose" data-backdrop="1"><div class="modal-card mat-detail mat-${m.rank}">
    <button class="modal-close" data-action="matDetailClose">✕</button>
    <div class="mat-detail-top">${itemIcon(id,96)}<div><span class="mat-rank big ${CHAR_RARITY[m.rank]?.css||''}">${m.rank}</span>
      <h3>${e(m.name)}</h3><p>${e(m.desc)}</p><small>${e(MAT_RANK_INFO[m.rank].label)}</small></div></div>
    <div class="mat-detail-grid">
      <div class="list-line"><span>所持数</span><b>${itemCount(s,id)} 個</b></div>
      <div class="list-line"><span>用途</span><b>${e(m.use)}</b></div>
      <div class="list-line"><span>入手方法</span><b>${e(m.obtain)}</b></div>
      <div class="list-line"><span>売値</span><b>🪙 ${fmt(m.sell)}</b></div>
      <div class="list-line"><span>図鑑</span><b>${s.catalog.materials.includes(id)||itemCount(s,id)>0?'発見済':'未発見'}</b></div>
    </div>
    <h4>進化先と必要個数</h4>
    ${uses.length?`<div class="mat-use-list">${uses.map(u=>`<div class="mat-use"><b>${rankBadge(u.rank)} への進化</b><span>必要 ${u.n} 個 / 所持 ${itemCount(s,id)} 個</span><small>キャラクター進化・武器/防具/装飾品のランク進化で使用</small></div>`).join('')}</div>`:'<p class="muted">最終ランク素材は上位進化の直接条件には使われません。交換・売却に利用できます。</p>'}
    ${target?`<div class="mat-upgrade"><div><b>素材合成・交換</b><small>${e(m.name)} ×3 ＋ 🪙${fmt(160*step)} → ${e(MATERIAL_BY_ID[target]?.name||target)} ×1</small></div>
      <button class="btn btn-primary" data-action="matUpgrade" data-id="${id}" ${itemCount(s,id)<3||s.coins<160*step?'disabled':''}>合成する</button></div>`:''}
    <div class="hint-box small">CPU対戦・ダンジョン踏破・ボス撃破・高難易度クエスト・デイリーミッション・実績・素材交換で入手できます。高ランクほど強敵・高難易度から。</div>
  </div></div>`;
}

/* ==================== 武器ガチャ：ピックアップ / 演出 / 結果 ==================== */
const TIER_LABEL = { N:'ノーマル', R:'レア以上', E:'エピック以上', L:'レジェンダリー以上', M:'ミシック以上', S:'シークレット' };
const TIER_COLOR = { N:'#a9b4c4', R:'#59b6ff', E:'#b98bff', L:'#ffc75a', M:'#ff6fae', S:'#68f7d4' };

/** 武器イラスト（種類ごとの形状 × レアリティごとの装飾・発光） */
function weaponIllustration(defOrId, rarity, size = 220, hidden = false) {
  const def = typeof defOrId === 'string' ? (EQUIP_BY_ID[defOrId] || null) : defOrId;
  if (!def) return `<span class="weapon-art empty" style="width:${size}px;height:${size}px">？</span>`;
  const r = RARITY[rarity || def.rarity] || RARITY.N;
  const key = `wa_${String(def.id).replace(/[^A-Za-z0-9]/g,'')}_${r.id}_${hidden?'x':'o'}`;
  const deco = {
    N:`<circle cx="100" cy="100" r="86" fill="none" stroke="${r.color}" stroke-width="1" opacity=".35"/>`,
    R:`<circle cx="100" cy="100" r="88" fill="none" stroke="${r.color}" stroke-width="2" opacity=".65"/><circle cx="100" cy="100" r="72" fill="none" stroke="#e6f9ff" stroke-width="1" opacity=".35"/><g fill="#e6f9ff" opacity=".7"><circle cx="100" cy="12" r="2.5"/><circle cx="188" cy="100" r="2.5"/></g>`,
    E:`<circle cx="100" cy="100" r="90" fill="none" stroke="${r.color}" stroke-width="2.5" opacity=".8"/><circle cx="100" cy="100" r="76" fill="none" stroke="#d9b6ff" stroke-width="1" stroke-dasharray="6 6" opacity=".65"/><g fill="${r.color}" opacity=".7"><circle cx="100" cy="9" r="3"/><circle cx="100" cy="191" r="3"/><circle cx="9" cy="100" r="3"/><circle cx="191" cy="100" r="3"/><circle cx="38" cy="38" r="2"/><circle cx="162" cy="162" r="2"/></g>`,
    L:`<circle cx="100" cy="100" r="92" fill="none" stroke="${r.color}" stroke-width="3" opacity=".9"/><circle cx="100" cy="100" r="78" fill="none" stroke="#fff4c4" stroke-width="1.5"/><g stroke="${r.color}" stroke-width="2" opacity=".75"><path d="M100 2v18M100 180v18M2 100h18M180 100h18M30 30l13 13M157 157l13 13M170 30l-13 13M43 157l-13 13"/></g><path class="wa-pillar" d="M76 0h48L112 200H88z" fill="url(#${key}_pillar)" opacity=".55"/>`,
    M:`<circle cx="100" cy="100" r="94" fill="none" stroke="#ff8fa8" stroke-width="3" opacity=".95"/><circle cx="100" cy="100" r="82" fill="none" stroke="#ffd77a" stroke-width="2"/><circle cx="100" cy="100" r="68" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="4 5"/><g stroke="#ffd77a" stroke-width="2.5" opacity=".8"><path d="M100 0v22M100 178v22M0 100h22M178 100h22M26 26l16 16M158 158l16 16M174 26l-16 16M42 158l-16 16"/></g><g fill="#fff" opacity=".85"><circle cx="28" cy="60" r="2.5"/><circle cx="172" cy="52" r="2.5"/><circle cx="34" cy="150" r="2.5"/><circle cx="166" cy="156" r="2.5"/></g>`,
    S:`<circle cx="100" cy="100" r="94" fill="none" stroke="#68f7d4" stroke-width="3" opacity=".95"/><circle cx="100" cy="100" r="84" fill="none" stroke="#ff8fa8" stroke-width="2"/><circle cx="100" cy="100" r="74" fill="none" stroke="#ffd77a" stroke-width="2"/><circle cx="100" cy="100" r="64" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 6"/><g fill="#fff" opacity=".9"><circle cx="20" cy="40" r="2"/><circle cx="180" cy="36" r="2.5"/><circle cx="24" cy="164" r="2"/><circle cx="176" cy="168" r="2.5"/><circle cx="100" cy="8" r="2"/></g>`,
  }[r.id] || '';
  const shape = hidden
    ? `<path d="M100 22 L162 60 L152 150 L100 186 L48 150 L38 60 Z" fill="#0d1428" stroke="${r.color}" stroke-width="2" opacity=".9"/><text x="100" y="126" text-anchor="middle" font-size="76" fill="#fff" opacity=".9">？</text>`
    : `<g transform="translate(30 30) scale(2.2)" fill="url(#${key}_metal)" stroke="#0c1228" stroke-width="1.1" stroke-linejoin="round">${equipGlyph(def.type)}</g>`;
  return `<span class="weapon-art wa-${r.id} ${hidden?'wa-hidden':''}" style="--wc:${r.color};width:${size}px;height:${size}px">
    <svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${hidden?'正体不明':e(def.name)}">
      <defs>
        <radialGradient id="${key}_bg"><stop offset="0%" stop-color="${r.color}" stop-opacity=".30"/><stop offset="70%" stop-color="#101830" stop-opacity=".92"/><stop offset="100%" stop-color="#070c1c"/></radialGradient>
        <linearGradient id="${key}_metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="${r.color}"/><stop offset="100%" stop-color="#2a3550"/></linearGradient>
        <linearGradient id="${key}_pillar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="50%" stop-color="${r.color}" stop-opacity=".7"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#${key}_bg)"/>
      <g class="wa-deco">${deco}</g>
      ${shape}
    </svg></span>`;
}

function weaponSpec(defId, compact = false) {
  const w = weaponSummary(defId);
  if (!w) return '';
  const eff = w.effects.length
    ? w.effects.map(x => `<span class="w-effect">✧ ${e(x.label)} +${x.value}${x.id==='crit'||x.id==='lifesteal'||x.id==='counter'||x.id==='ignoreDef'||x.id==='damageCut'||x.id==='extraStrike'||x.id==='statusGuard'||x.id==='expBonus'||x.id==='coinBonus'||x.id==='bpBonus'?'%':''}${e(x.desc?'（'+x.desc+'）':'')}</span>`).join('')
    : '<span class="w-effect muted">特殊効果なし</span>';
  return `<div class="w-spec ${compact?'compact':''}">
    <div class="w-stat-row">${STAT_KEYS.filter(k=>w[k]).map(k=>`<span>${STAT_ICONS[k]} ${STAT_NAMES[k]} <b>+${w[k]}</b></span>`).join('') || '<span>基本ステータス上昇なし</span>'}</div>
    <div class="w-effect-row">${eff}</div>
    ${compact?'':`<p class="w-usage">${e(w.usage)}</p><p class="w-desc">${e(w.desc)}</p>`}
  </div>`;
}

/* ---------- 引く前の専用画面（ピックアップ） ---------- */
function gachaScreen(app, s) {
  const info = currentBanner(), banner = info.banner;
  const p = s.pity.weapon, pa = s.pity.armor;
  const rows = bannerRates(banner), totals = rateTotals(banner);
  const featured = featuredDefs(banner).sort((a,b)=>RARITY_ORDER.indexOf(b.rarity)-RARITY_ORDER.indexOf(a.rarity));
  const main = featured[0] || EQUIP_BY_ID['eq_weapon_剣_L'];
  const secret = hiddenSummary(banner);
  const last = app.lastPull || [], bonus = app.lastBonus || [];
  const rateS = rows.find(r=>r.id==='S');
  const hist = [...s.pity.weapon.history, ...s.pity.armor.history].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,24);
  return `<div class="pickup-screen" style="--pa:${banner.accent};--pb:${banner.accent2}">
    <section class="pickup-hero panel">
      <div class="pickup-eyebrow">✦ PICK UP 武器ガチャ ✦</div>
      <h2>${e(banner.name)}</h2>
      <p class="pickup-sub">${e(banner.subtitle)}</p>
      <div class="pickup-period">📅 ピックアップ期間 <b>${e(info.startLabel)} 〜 ${e(info.endLabel)}</b><span class="pill">残り ${info.remainingDays} 日 / ${PICKUP_PERIOD_DAYS}日ごとに次のピックアップへ自動切替</span></div>
      <div class="pickup-hero-body">
        <div class="pickup-art">${weaponIllustration(main, main.rarity, 280, false)}<span class="pickup-art-tag">PICK UP</span></div>
        <div class="pickup-info">
          ${rarityTag(main.rarity)}<span class="pill on">ピックアップ対象</span>
          <h3>${e(main.name)}</h3>
          <p class="pickup-tagline">${e(banner.tagline)}</p>
          ${weaponSpec(main.id)}
          <button class="btn btn-mini ghost mt" data-action="gachaItemDetail" data-id="${main.id}" data-pickup="1">🔎 この武器の詳細を見る</button>
        </div>
      </div>
      <div class="pickup-notice">⚠ ピックアップ武器は通常より出現しやすくなりますが、<b>必ず排出されるわけではありません</b>。天井・レアリティ排出確率は従来どおりです。</div>
    </section>

    <div class="two-col mt">
      <div class="panel soft"><h4>🎯 ピックアップ対象武器 <small class="muted">シークレット以外は全て事前公開</small></h4>
        <div class="pickup-list">${featured.map(d=>`<div class="pickup-item" style="--wc:${d.color}">
          ${weaponIllustration(d,d.rarity,86,false)}
          <div><b>${e(d.name)}</b>${rarityTag(d.rarity)}<small>${e(d.type)} / ${coreLine(d.stats)}</small>
            <small class="muted">${e((d.stats.effects||[]).map(x=>EFFECTS[x.id]?.name||EFFECT_LABELS[x.id]||x.id).join('・')||'特殊効果なし')}</small></div>
          <button class="btn btn-mini ghost" data-action="gachaItemDetail" data-id="${d.id}" data-pickup="1">🔎 詳細</button>
        </div>`).join('')}</div>
        <div class="secret-card">
          ${weaponIllustration({id:'secret_hidden',type:'特殊'},'S',92,true)}
          <div><span class="pill secret-pill">？？？ シークレット</span>
            <b>正体は入手まで非公開</b>
            <small>名前・画像・性能は事前に公開されません。存在と排出確率は公開しています。</small>
            <small>シークレット合計 <b>${rateS.total.toFixed(1)}%</b>（うちピックアップ枠 <b>${rateS.pickup.toFixed(2)}%</b> / 通常枠 <b>${rateS.normal.toFixed(2)}%</b>）</small></div>
        </div>
      </div>
      <div class="panel soft"><h4>📊 提供割合 <small class="muted">合計 ${totals.total.toFixed(2)}%</small></h4>
        <div class="rate-table">
          <div class="rate-thead"><span>レアリティ</span><span>合計</span><span>ピックアップ</span><span>通常</span></div>
          ${rows.map(r=>`<div class="rate-trow" style="--rc:${r.color}"><span>${e(r.name)}</span><b>${r.total.toFixed(1)}%</b><b class="pk">${r.hasPickup?r.pickup.toFixed(2)+'%':'—'}</b><b class="nm">${r.normal.toFixed(2)}%</b></div>`).join('')}
          <div class="rate-tfoot"><span>合計</span><b>${totals.total.toFixed(2)}%</b><b class="pk">${totals.pickup.toFixed(2)}%</b><b class="nm">${totals.normal.toFixed(2)}%</b></div>
        </div>
        <div class="hint-box small">「ピックアップ」は各レアリティの排出率の内訳です。レアリティ自体の確率（44.5 / 30.0 / 16.0 / 7.0 / 2.0 / 0.5%）は変更していません。ピックアップ枠の合計 ${totals.pickup.toFixed(2)}% + 通常枠 ${totals.normal.toFixed(2)}% = <b>${totals.total.toFixed(2)}%</b>。</div>
        <button class="btn btn-glass full" data-action="gachaRatesDetail">🔎 ガチャの詳細・提供割合を確認</button>
        <h4 class="mt">🏅 独立天井カウンタ</h4>
        <div class="list-line"><span>レジェンダリー天井</span><b>${p.legendary} / ${PITY_LEGENDARY}（あと <b class="ok">${PITY_LEGENDARY-p.legendary}</b> 連で L 以上確定）</b></div>
        ${bar(p.legendary,PITY_LEGENDARY,'linear-gradient(90deg,#ffd77a,#ff9e7a)',`L天井 ${p.legendary} / ${PITY_LEGENDARY}`)}
        <div class="list-line"><span>ミシック天井</span><b>${p.mythic} / ${PITY_MYTHIC}（あと <b class="ok">${PITY_MYTHIC-p.mythic}</b> 連で M 以上確定）</b></div>
        ${bar(p.mythic,PITY_MYTHIC,'linear-gradient(90deg,#ff8fa8,#c58cff)',`M天井 ${p.mythic} / ${PITY_MYTHIC}`)}
        <div class="hint-box small">L 以上で 60連カウンタ、M 以上で 120連カウンタをリセット。2つは独立管理され、履歴と一緒にセーブされます。天井による確定演出は実際の排出結果と必ず一致します。</div>
      </div>
    </div>

    <section class="panel pickup-actions"><h3>🪙 ガチャを引く <small class="muted">課金要素なし・ゲーム内コインのみ / 所持 ${fmt(s.coins)} コイン</small></h3>
      <div class="pull-buttons">
        <button class="btn btn-glass btn-lg" data-action="gacha" data-kind="weapon" data-n="1" ${s.coins<GACHA_COST?'disabled':''}>⚔ 1回ガチャ <small>🪙 ${fmt(GACHA_COST)}</small></button>
        <button class="btn btn-primary btn-lg" data-action="gacha" data-kind="weapon" data-n="10" ${s.coins<GACHA_COST_10?'disabled':''}>✦ 10回ガチャ <small>🪙 ${fmt(GACHA_COST_10)} / 専用演出＋素材ボーナス</small></button>
      </div>
      <div class="armor-mini"><b>🛡 装備ガチャ（従来どおり・演出対象外）</b><small>防具・アクセサリー・装飾品 / L天井 ${pa.legendary}/${PITY_LEGENDARY} / M天井 ${pa.mythic}/${PITY_MYTHIC}</small>
        <div class="row-btns"><button class="btn btn-mini" data-action="gacha" data-kind="armor" data-n="1" ${s.coins<GACHA_COST?'disabled':''}>1連</button><button class="btn btn-mini ghost" data-action="gacha" data-kind="armor" data-n="10" ${s.coins<GACHA_COST_10?'disabled':''}>10連</button></div></div>
      <div class="hint-box small">排出結果は演出開始前に確定します。スキップしても結果・報酬は一切変わりません。</div>
    </section>

    <div class="two-col mt">
      <div class="panel soft"><h4>🖼 直前のガチャ結果</h4>
        ${last.length?`<div class="pull-results">${last.map(inst=>{const d=instanceDef(inst);const r=RARITY[instanceRarity(inst)];return `<div class="pull-item" style="--rc:${r.color}">${weaponIllustration(d,d.rarity,52,false)}<span>${e(d.name)}</span>${rarityTag(d.rarity)}</div>`;}).join('')}</div>`:'<p class="muted">まだ引いていません。上のボタンからガチャを引けます。</p>'}
        ${bonus.length?`<h4 class="mt">🎁 10連ボーナス素材</h4><div class="mat-chip-row">${bonus.map(b=>matChip(b.id,b.n)).join('')}</div>`:''}
      </div>
      <div class="panel soft"><h4>📜 ガチャ履歴 <small class="muted">セーブされます / 最新24件</small></h4>
        <div class="gacha-history">${hist.length?hist.map(x=>`<div class="gacha-hist-line">
          <span class="gacha-hist-r" style="--rc:${RARITY[x.rarity]?.color||'#889'}">${e(RARITY[x.rarity]?.name||x.rarity)}</span>
          <b>${e(x.name)}</b>
          <small>${x.pickup?'<span class="pk-tag">PU</span>':''}${x.isNew?'<span class="new-tag">NEW</span>':''}${x.forced?`✨${e(x.forced)}`:''}${e(x.bannerName||'')} L${x.legendaryBefore} M${x.mythicBefore}</small>
          <time>${new Date(x.at).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</time>
        </div>`).join(''):'<p class="muted">履歴はまだありません</p>'}</div>
      </div>
    </div>
  </div>`;
}

/* ---------- ガチャ詳細モーダル ---------- */
function gachaRatesModal(app, s) {
  if (!app.gachaRatesDetail) return '';
  const info = currentBanner(), banner = info.banner;
  const rows = bannerRates(banner), totals = rateTotals(banner);
  return `<div class="modal-backdrop" data-action="gachaRatesDetailClose" data-backdrop="1"><div class="modal-card wide">
    <button class="modal-close" data-action="gachaRatesDetailClose">✕</button>
    <h3>🔎 ガチャの詳細・提供割合</h3>
    <p class="muted small">${e(banner.name)} / ${e(info.startLabel)} 〜 ${e(info.endLabel)}</p>
    <div class="rate-table"><div class="rate-thead"><span>レアリティ</span><span>合計</span><span>ピックアップ</span><span>通常</span></div>
      ${rows.map(r=>`<div class="rate-trow" style="--rc:${r.color}"><span>${e(r.name)}</span><b>${r.total.toFixed(1)}%</b><b class="pk">${r.hasPickup?r.pickup.toFixed(2)+'%':'—'}</b><b class="nm">${r.normal.toFixed(2)}%</b></div>`).join('')}
      <div class="rate-tfoot"><span>合計</span><b>${totals.total.toFixed(2)}%</b><b class="pk">${totals.pickup.toFixed(2)}%</b><b class="nm">${totals.normal.toFixed(2)}%</b></div></div>
    <h4 class="mt">仕組み</h4>
    <ul class="flow"><li>レアリティを先に抽選（ノーマル44.5 / レア30.0 / エピック16.0 / レジェンダリー7.0 / ミシック2.0 / シークレット0.5%）。</li>
      <li>そのレアリティ内で「ピックアップ枠 ${(PICKUP_SHARE*100).toFixed(0)}%」と「通常枠」に分けて武器を抽選。ピックアップ対象は同じレアリティの他武器より出やすくなります。</li>
      <li>ピックアップは<b>確定ではありません</b>。シークレットの名前・画像・性能は獲得まで非公開です。</li>
      <li>60連でレジェンダリー以上、120連でミシック以上が確定。カウンタは独立で、対応レアリティ出現時にリセットされます。</li>
      <li>排出結果は演出開始前に確定し、スキップや演出で変化しません。獲得武器は所持品に追加され装備・強化・進化できます。</li></ul>
    <div class="hint-box">ピックアップは ${PICKUP_PERIOD_DAYS} 日ごとに次のラインナップへ自動で切り替わります。期間終了後も天井カウンタ・履歴は引き継がれます。</div>
  </div></div>`;
}

/* ---------- 武器詳細モーダル ---------- */
function weaponDetailModal(app, s) {
  const id = app.gachaItemDetail;
  if (!id) return '';
  const defId = id.defId || id;
  const d = EQUIP_BY_ID[defId];
  if (!d) return '';
  const inst = id.uid ? findInstance(s, id.uid) : null;
  return `<div class="modal-backdrop" data-action="gachaDetailClose" data-backdrop="1"><div class="modal-card">
    <button class="modal-close" data-action="gachaDetailClose">✕</button>
    <div class="w-detail-top">${weaponIllustration(d,d.rarity,150,false)}<div>${rarityTag(d.rarity)}<h3>${e(d.name)}</h3><p>${e(d.desc)}</p></div></div>
    ${weaponSpec(d.id)}
    <div class="list-line"><span>スロット / 系統</span><b>${e(SLOT_NAME[d.slot])} / ${e(d.type)}</b></div>
    ${inst?`<div class="list-line"><span>強化 / ランク</span><b>+${inst.enhance||0} / ${e(instanceRank(inst))}</b></div>`:''}
    ${id.pickup?'<div class="callout gold">🎯 ピックアップ対象武器</div>':''}
    ${id.isNew?'<div class="callout green">✨ 新規入手（図鑑に登録されました）</div>':''}
    ${inst?`<button class="btn btn-primary full mt" data-action="gachaEquip" data-uid="${inst.uid}">⚔ この武器を装備する</button>`:''}
  </div></div>`;
}

/* ---------- ガチャ演出オーバーレイ ---------- */
function gachaIntro(g) {
  const t = g.guarantee, tier = t.on ? t.tier : 'N';
  return `<div class="gacha-overlay g-intro g-tier-${tier}" style="--gc:${TIER_COLOR[tier]}">
    <div class="g-bg-shift"></div>
    <div class="g-summon">
      <div class="g-circle c1"></div><div class="g-circle c2"></div><div class="g-circle c3"></div>
      <div class="g-silhouette"></div><div class="g-core">✦</div>
    </div>
    ${t.on?`<div class="g-guarantee"><small>✨ 確定演出 ✨</small><b>${e(TIER_LABEL[tier])} が出現確定</b><span>${e(t.reason)} / 実際の排出結果と一致しています</span></div>`
      :`<div class="g-no-guarantee">確定演出なし … それでも高レアリティが出る可能性はあります</div>`}
    ${g.count===10?`<div class="g-ten-only"><b>✦ 10 連専用召喚 ✦</b><small>10体を順番に公開し、最後の1体をグランドフィナーレで演出します</small>
      <div class="g-ten-track">${Array.from({length:10},(_,i)=>`<i>${i+1}</i>`).join('')}</div></div>`:''}
    <div class="g-intro-text">召喚陣が光り始めた。武器の気配が近づく…</div>
    <div class="g-progress">${g.count===10?'✦ 10連召喚':'1回召喚'} / ${e(g.bannerInfo?.banner?.short||'')}</div>
    <button class="btn btn-glass g-skip" data-action="gachaSkip">⏭ スキップ（結果は変わりません）</button>
  </div>`;
}
function gachaReveal(g) {
  const d = g.details[g.index];
  if (!d) return '';
  const r = RARITY[d.rarity] || RARITY.N;
  const hidden = !!g.preReveal;
  const art = hidden
    ? weaponIllustration({id:'pre_'+g.index,type:d.type}, d.rarity, 300, true)
    : weaponIllustration(d.defId, d.rarity, 300, false);
  const isLast = g.index === g.details.length - 1;
  const high = ['L','M','S'].includes(d.rarity);
  return `<div class="gacha-overlay g-reveal g-r-${d.rarity} ${isLast?'g-finale':''} ${hidden?'g-veiled':''}" style="--gc:${r.color}">
    <div class="g-reveal-bg"></div>
    <div class="g-reveal-rays"></div><div class="g-reveal-pillar"></div><div class="g-reveal-circle"></div><div class="g-reveal-particles"></div>
    ${d.rarity==='S'?'<div class="g-secret-shift"></div>':''}
    ${isLast&&g.count===10?'<div class="g-finale-burst">✦ 10 連 グ ラ ン ド フ ィ ナ ー レ ✦</div>':''}
    <div class="g-reveal-head">
      <span class="g-count">${g.count===10?`${g.index+1} / ${g.details.length}`:'RESULT'}</span>
      ${g.count===10?`<span class="g-ten-track mini">${Array.from({length:10},(_,i)=>`<i class="${i<g.index?'done':i===g.index?'now':''}">${i+1}</i>`).join('')}</span>`:''}
      ${isLast&&g.count===10?'<span class="pill on">✦ 最後の1体 ✦</span>':''}
      ${g.skipped?'':'<button class="btn btn-mini ghost g-skip" data-action="gachaSkip">⏭ スキップ</button>'}
    </div>
    <div class="g-reveal-art">${art}</div>
    <div class="g-reveal-info">
      ${hidden?'<div class="g-veil-title">？？？</div>':`${rarityTag(d.rarity)}<h2>${e(d.name)}</h2>`}
      ${hidden?'<p class="muted">正体が明らかになるまで、少しだけお待ちを…</p>':`<div class="g-badges">${d.pickup?'<span class="pk-tag">🎯 PICK UP</span>':''}${d.isNew?'<span class="new-tag">✨ NEW</span>':''}${d.forced?`<span class="forced-tag">${e(d.forced)}</span>`:''}</div>${weaponSpec(d.defId,true)}`}
      ${d.rarity==='S'&&!hidden?'<div class="g-secret-acclaim">✧ シークレット獲得 ✧</div>':''}
    </div>
  </div>`;
}
function gachaResultScreen(app, s, g) {
  const details = g.details || [];
  const top = details.reduce((a,b)=>RARITY_ORDER.indexOf(b.rarity)>RARITY_ORDER.indexOf(a.rarity)?b:a, details[0]||{});
  const secret = details.find(d=>d.rarity==='S');
  const inst = top.uid ? findInstance(s, top.uid) : null;
  return `<div class="gacha-overlay g-result g-r-${top.rarity||'N'}" style="--gc:${RARITY[top.rarity]?.color||'#a9b4c4'}">
    <div class="g-result-bg"></div>
    <div class="g-result-inner">
      <header class="g-result-head"><div><span class="eyebrow">✦ GACHA RESULT ✦</span><h2>${g.count===10?'10連ガチャ結果':'ガチャ結果'}</h2>
        <p>${e(g.bannerInfo?.banner?.name||'')} / 消費 🪙 ${fmt(g.count===10?GACHA_COST_10:GACHA_COST*g.count)}</p></div>
        <div class="g-result-actions"><button class="btn btn-mini ghost" data-action="gachaAgain" data-n="1">もう1回</button><button class="btn btn-mini ghost" data-action="gachaAgain" data-n="10">もう10回</button><button class="btn btn-glass" data-action="gachaClose">✕ ガチャ画面へ戻る</button></div></header>
      ${g.guarantee?.on?`<div class="g-result-guarantee">✨ ${e(TIER_LABEL[g.guarantee.tier])} 確定演出 — ${e(g.guarantee.reason)} / 結果と一致</div>`:''}
      ${g.skipped?'<div class="hint-box small">演出をスキップしました。排出結果・報酬は変化していません。</div>':''}
      ${secret?`<div class="g-secret-acquisition"><div class="g-secret-rainbow"></div><b>✧ シークレット武器 獲得 ✧</b><p>通常とは異なる特別な演出の末に、${e(secret.name)} が姿を現した。</p>${weaponIllustration(secret.defId,'S',120,false)}</div>`:''}
      <section class="g-hero-card" style="--wc:${RARITY[top.rarity]?.color||'#a9b4c4'}">
        <div class="g-hero-art">${weaponIllustration(top.defId,top.rarity,300,false)}</div>
        <div class="g-hero-info">
          ${rarityTag(top.rarity)}<h2>${e(top.name)}</h2>
          <div class="g-badges">${top.pickup?'<span class="pk-tag">🎯 ピックアップ対象</span>':'<span class="pill">通常枠</span>'}${top.isNew?'<span class="new-tag">✨ 新規入手</span>':'<span class="pill">再入手</span>'}</div>
          ${weaponSpec(top.defId)}
          <div class="g-hero-btns">${inst?`<button class="btn btn-primary" data-action="gachaEquip" data-uid="${inst.uid}">⚔ 装備する</button>`:''}
            <button class="btn btn-glass" data-action="gachaItemDetail" data-id="${top.defId}" data-uid="${top.uid||''}" data-pickup="${top.pickup?1:0}" data-new="${top.isNew?1:0}">🔎 詳細を確認</button></div>
          <small class="muted">装備後は工房で強化・ランク進化できます。</small>
        </div>
      </section>
      <h4 class="mt">📦 ${g.kind==='weapon'?'獲得武器':'獲得装備'}一覧 <span class="pill">${details.length} 件</span></h4>
      <div class="g-result-grid">${details.map((d,i)=>`<button type="button" class="g-result-item g-r-${d.rarity}" style="--wc:${RARITY[d.rarity]?.color||'#889'}" data-action="gachaItemDetail" data-id="${d.defId}" data-uid="${d.uid}" data-pickup="${d.pickup?1:0}" data-new="${d.isNew?1:0}">
        ${weaponIllustration(d.defId,d.rarity,74,false)}
        <div><b>${e(d.name)}</b>${rarityTag(d.rarity)}<small>${e(d.type)} / ${coreLine((EQUIP_BY_ID[d.defId]||{}).stats)}</small>
          <small>${(weaponSummary(d.defId)?.effects||[]).map(x=>e(x.label)+'+'+x.value).join('・')||'特殊効果なし'}</small>
          <span class="g-item-flags">${d.pickup?'<span class="pk-tag">PU</span>':''}${d.isNew?'<span class="new-tag">NEW</span>':''}${d.forced?`<span class="forced-tag">${e(d.forced)}</span>`:''}</span></div>
        <span class="g-item-no">#${i+1}</span>
      </button>`).join('')}</div>
      ${g.bonus?.length?`<h4 class="mt">🎁 10連ボーナス素材</h4><div class="mat-chip-row">${g.bonus.map(b=>matChip(b.id,b.n)).join('')}</div>`:''}
      <div class="row-btns"><button class="btn btn-primary btn-lg" data-action="gachaAgain" data-n="10">✦ もう10回引く</button><button class="btn btn-glass btn-lg" data-action="gachaClose">ガチャ画面へ戻る</button></div>
    </div>
  </div>`;
}
function gachaPresentation(app, s) {
  const g = app.gacha;
  if (!g) return '';
  if (g.phase === 'intro') return gachaIntro(g);
  if (g.phase === 'reveal') return gachaReveal(g);
  return gachaResultScreen(app, s, g);
}

/* ---------- 育成の間 ---------- */
function nurtureTab(tab, app, s) {
  const c = activeChar(s);
  if (!c) return noChar();
  if (tab === 4) return evolutionScreen(app, s);
  const st = computeStats(c,s), job = JOB[c.jobId];
  if (tab === 0) {
    return `<div class="two-col">
      <div class="panel soft">
        <div class="prof-head">${charImage(c,'medium')}<div><h4>${e(c.name)} <small>Lv.${c.level} / ${e(job.name)}</small></h4>
          <p class="muted">${rankBadge(c.rarity)} ${e(AWAKENING_NAMES[c.awakening])} ・ 転生${c.rebirth||0}回 ・ 戦闘力 ${fmt(powerScore(c,s))}</p></div></div>
        <div class="hint-box small">レベルは日々の成長、レアリティは進化段階。レベルだけではレアリティは上がりません。<button class="btn btn-mini" data-action="nav" data-to="facility" data-facility="nurture" data-tab="4">✦ 進化へ</button></div>
        ${bar(c.hp,st.hp,'linear-gradient(90deg,#ff6b6b,#ff9e7a)',`HP ${fmt(c.hp)} / ${fmt(st.hp)}`)}
        ${bar(c.mp,st.mp,'linear-gradient(90deg,#5b9dff,#8ce6ff)',`MP ${fmt(c.mp)} / ${fmt(st.mp)}`)}
        ${bar(c.exp,xpForLevel(c.level),'linear-gradient(90deg,#ffd77a,#ffe9a8)',`EXP ${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}（次まで ${fmt(Math.max(0,xpForLevel(c.level)-c.exp))}）`)}
        ${bar(c.jobExp[c.jobId]||0,jobXpForLevel(c.jobLevels[c.jobId]||1),'linear-gradient(90deg,#8ce6a8,#b6f0c6)',`職業熟練度 Lv.${c.jobLevels[c.jobId]||1} / ${fmt(c.jobExp[c.jobId]||0)}`)}
        <div class="callout gold">✨ レベルアップで <b>ステータスポイント+4</b> と <b>HP・MP全回復</b>。レベル上限 Lv.${levelCap(c)}。</div>
        <div class="row-btns"><button class="btn btn-glass" data-action="restore">💚 全回復（200コイン）</button><button class="btn btn-ghost" data-action="resetAlloc">↺ 振り分けリセット（1,000）</button></div>
      </div>
      <div class="panel soft">
        <h4>能力値と自由振り分け <span class="pill">残り ${c.statPoints} P</span></h4>
        <div class="alloc-grid">${STAT_KEYS.map(k=>`<div class="alloc-cell"><span>${STAT_ICONS[k]} ${STAT_NAMES[k]}</span><b>${fmt(st[k])}</b><small>基礎+${fmt(c.alloc[k]||0)}</small><div class="row-btns tiny"><button class="btn btn-mini" data-action="alloc" data-stat="${k}" data-n="1" ${c.statPoints<1?'disabled':''}>+1</button><button class="btn btn-mini" data-action="alloc" data-stat="${k}" data-n="5" ${c.statPoints<5?'disabled':''}>+5</button></div></div>`).join('')}</div>
        <div class="hint-box">1 ポイントで <b>HP+12 / 攻撃力+3 / 防御力+3 / MP+6</b>。4 種類の基本ステータスを自由に伸ばせます。修行場でもポイントを得られます。</div>
      </div></div>`;
  }
  if (tab === 1) {
    const jobSum = Object.values(c.jobLevels).reduce((a,b)=>a+b,0);
    const hist = [...(c.jobChangeHistory||[])].reverse().slice(0,8);
    return `<div class="callout">現在の役職：<b>${job.icon} ${e(job.name)}</b> / 職業Lv.${c.jobLevels[c.jobId]||1} / 全職業熟練度合計 ${jobSum}。<b>役職変更はランクアップ時・転生時のみ</b>可能です。ここでは確認だけできます。</div>
    <div class="hint-box">変更の機会は「進化」タブでランクを上げたとき、または「やり込み」の転生時に表示されます。${c.godUnlocked?`<br><span class="pill on">特殊役職「神」解放済（${e(SPECIAL_NAME_LABEL[c.specialKey])}）</span>`:''}</div>
    <div class="job-grid">${JOBS.map(j=>{
      const ok = jobUnlocked(s,c,j), cur = c.jobId===j.id;
      return `<div class="job-card ${cur?'current':''} ${ok?'':'locked'}" style="--jc:${j.color}">
        <div class="job-top"><span class="job-icon">${j.icon}</span><div><b>${e(j.name)}</b><small>${j.req?.god?'特殊役職・神':['','基本職','上級職','特殊職'][j.tier]||'特殊職'} / Lv.${c.jobLevels[j.id]||0}</small></div></div>
        <p>${e(j.desc)}</p>
        <div class="job-growth">${STAT_KEYS.map(k=>`<span>${STAT_NAMES[k].slice(0,2)} <b>${Math.round(toCoreStats(j.growth)[k]*10)/10}</b></span>`).join('')}</div>
        <small class="muted">武器：${j.weapons.join('・')}<br>解放：${e(jobReqText(j))}</small>
        ${cur?`<span class="pill on">現在の役職（変更不可）</span>`:ok?`<span class="pill off">ランクアップ／転生時に変更可</span>`:`<span class="pill off">未解放</span>`}
      </div>`;}).join('')}</div>
    <div class="panel soft"><h4>役職変更履歴 <small class="muted">セーブされます</small></h4>
      ${hist.length?`<div class="log-list">${hist.map(h=>`<div class="log-line"><span>${new Date(h.at).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span> ${e(h.reason==='rebirth'?'転生':'ランクアップ')} / ${e(h.from||'—')} → ${e(h.to||'—')} ${h.kept?'（維持）':''}</div>`).join('')}</div>`:'<p class="muted">まだ役職変更の履歴はありません。</p>'}</div>
    <div class="panel soft"><h4>職業熟練度一覧</h4><div class="mastery-grid">${Object.entries(c.jobLevels).map(([id,lv])=>`<div><span>${e(JOB[id]?.name||id)}</span>${bar(lv,30,`#6cc8ff`,`Lv.${lv} / 30`)}</div>`).join('')}</div></div>`;
  }
  if (tab === 2) {
    const filter = app.skillFilter || 'all';
    const cats = ['all',...new Set(SKILLS.map(x=>x.cat))];
    const offset = app.skillOffset || 0;
    const unlearned = SKILLS.filter(x => !c.skills.some(y=>y.id===x.id) && !x.ultimate && x.source!=='god'
      && (filter==='all'||x.cat===filter) && (x.cat!=='覚醒限定技'||c.awakening>=1));
    const shown = unlearned.slice(offset, offset+24);
    const books = Object.entries(s.inventory.items).filter(([id,n])=>n>0 && ITEM[id]?.kind==='book');
    return `<div class="two-col">
      <div class="panel soft"><h4>習得済みの技 <span class="pill">${c.skills.filter(k=>!ULTIMATE_IDS.has(k.id)&&SKILL[k.id]?.source!=='god').length} / ${LEARNABLE_SKILL_COUNT}</span></h4>
        <p class="muted small">戦闘で使える技は最大8つ。★を押して入れ替えられます。熟練度は修行場で上げられます。</p>
        <div class="skill-list">${c.skills.map(k=>{const sk=SKILL[k.id]; const on=c.equippedSkills.includes(k.id);return `<div class="skill-line">${elementTag(sk.element)}<div><b>${e(sk.name)}</b><small>${e(sk.cat)} / 威力${sk.power||'—'} / MP${sk.mp} / CD${sk.cd} / 熟練${k.mastery}/20</small></div><button class="btn btn-mini ${on?'on':''}" data-action="skillToggle" data-skill="${sk.id}">${on?'★ 装備中':'☆ 装備'}</button></div>`;}).join('')}</div>
        <h4 class="mt">技の書を使う</h4>${books.length?`<div class="chip-row">${books.map(([id,n])=>`<button class="btn btn-mini" data-action="useBook" data-book="${id}">${e(ITEM[id].name)} ×${n}</button>`).join('')}</div>`:'<p class="muted">技の書を持っていません（道具屋・交換所で入手）</p>'}
      </div>
      <div class="panel soft"><h4>技を習得する <span class="pill">🔷 ${fmt(s.bp)} BP</span></h4>
        <label class="field"><span>種別で絞り込み</span><select data-change="skillFilter">${cats.map(x=>`<option value="${e(x)}" ${filter===x?'selected':''}>${x==='all'?'すべて':e(x)}</option>`).join('')}</select></label>
        <div class="skill-list">${shown.map(sk=>{const cost = 25 + sk.tier*22 + (sk.cat==='覚醒限定技'?200:0);
          return `<div class="skill-line">${elementTag(sk.element)}<div><b>${e(sk.name)}</b><small>${e(sk.cat)} / 威力${sk.power||'—'} / MP${sk.mp} / ${e(sk.desc)}</small></div><button class="btn btn-mini" data-action="skillLearn" data-skill="${sk.id}" data-cost="${cost}" ${s.bp<cost?'disabled':''}>🔷${fmt(cost)}</button></div>`;}).join('')}</div>
        <div class="row-btns">${offset>0?`<button class="btn btn-ghost" data-action="skillPage" data-delta="-24">← 前へ</button>`:''}${offset+24<unlearned.length?`<button class="btn btn-ghost" data-action="skillPage" data-delta="24">次へ →</button>`:''}<span class="muted small">${offset+1}–${Math.min(offset+24,unlearned.length)} / ${unlearned.length} 件</span></div>
      </div></div>`;
  }
  const a = awakenStatus(s,c);
  const stage = a.stage;
  return `<div class="two-col">
    <div class="panel soft"><h4>覚醒段階 <span class="pill">${c.awakening} / 5</span></h4>
      <div class="awaken-track">${[0,1,2,3,4,5].map(i=>`<div class="awaken-node ${i<=c.awakening?'on':''}"><span>${i===0?'未':i}</span><small>${e(AWAKENING_NAMES[i])}</small></div>`).join('')}</div>
      <div class="callout violet">進化段階：${c.evolution} ／ 覚醒で全能力値が <b>+13%</b> ずつ上昇し、ステータスポイント+10、覚醒限定技が解放されます。覚醒IIで「進化」、覚醒Vで最終形態。</div>
      ${a.max ? '<div class="callout gold">🌟 最終段階まで到達しました！転生でさらに高みを目指せます。</div>' : `
        <h4>次の覚醒条件（${e(AWAKENING_NAMES[c.awakening+1])}）</h4>
        <ul class="cond-list">
          <li class="${c.level>=stage.level?'ok':''}">レベル ${c.level} / ${stage.level}</li>
          <li class="${a.jobSum>=stage.jobSum?'ok':''}">職業熟練度合計 ${a.jobSum} / ${stage.jobSum}</li>
          <li class="${s.stats.bossKills>=stage.boss?'ok':''}">ボス撃破 ${s.stats.bossKills} / ${stage.boss}</li>
          <li class="${s.coins>=stage.coins?'ok':''}">コイン ${fmt(s.coins)} / ${fmt(stage.coins)}</li>
          ${Object.entries(stage.materials).map(([id,n])=>`<li class="${itemCount(s,id)>=n?'ok':''}">${itemIcon(id,26)}${e(ITEM[id]?.name||id)} ${itemCount(s,id)} / ${n}</li>`).join('')}
        </ul>
        ${a.ok?`<button class="btn btn-primary btn-lg full" data-action="doAwaken">✦ 覚醒する</button>`:`<button class="btn btn-ghost full" disabled>条件が揃っていません</button><div class="hint-box">不足：${a.reasons.map(e).join(' / ')}</div>`}`}
      <div class="row-btns"><button class="btn btn-glass" data-action="nav" data-to="endgame">🏆 転生・やり込み</button><button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">⚔ ボスに挑む</button></div>
    </div>
    <div class="panel soft"><h4>覚醒で解放される技・特殊能力</h4>
      <div class="skill-list">${['sk_awaken1','sk_awaken2','sk_awaken3','sk_eclipse','sk_genesis','sk_secret'].map((id,i)=>`<div class="skill-line">${elementTag(SKILL[id].element)}<div><b>${e(SKILL[id].name)}</b><small>${e(SKILL[id].desc)}</small></div><span class="pill ${c.skills.some(k=>k.id===id)?'on':'off'}">${c.skills.some(k=>k.id===id)?'習得済':'覚醒'+Math.min(5,i+1)}</span></div>`).join('')}</div>
      <h4 class="mt">覚醒による効果</h4><div class="effect-grid"><div>会心率 <b>+${3+c.awakening*2}%</b></div><div>吸血 <b>+${c.awakening>=4?4:0}%</b></div><div>全能力 <b>×${(1+c.awakening*0.13+c.evolution*0.05).toFixed(2)}</b></div><div>限定技 <b>${c.skills.filter(k=>SKILL[k.id]?.cat==='覚醒限定技').length} 種</b></div></div>
    </div></div>`;
}

/* ---------- 武器・装備工房 ---------- */
function equipRow(inst, s, opts={}) {
  const def = instanceDef(inst);
  const es = equipmentStats(inst, activeChar(s));
  return `<div class="equip-line ${opts.sel?'sel':''}">
    <span class="eq-glow" style="--rc:${def.color}"></span>
    <div class="eq-main"><b style="color:${def.color}">${e(def.name)} <small>+${inst.enhance||0}</small></b>
      <small>${e(def.type)} / ${e(SLOT_NAME[def.slot])} / ${STAT_KEYS.filter(k=>es[k]).map(k=>`${STAT_NAMES[k]}+${es[k]}`).join(' ') || '—'}</small>
      ${(es.effects||[]).map(x=>`<small class="effect">✧ ${e(EFFECTS[x.id]?.name||x.id)} +${x.value}</small>`).join('')}
    </div>${rarityTag(def.rarity)}${rankBadge(instanceRank(inst))}${opts.button||''}</div>`;
}
function forgeTab(tab, app, s) {
  const c = activeChar(s);
  if (!c) return noChar();
  if (tab === 4) return equipmentEvolutionScreen(app, s);
  if (tab === 0) {
    return `<div class="two-col">
      <div class="panel soft"><h4>現在の装備</h4>${SLOTS.map(slot=>{
        const inst = findInstance(s,c.equipment[slot]); const def = instanceDef(inst);
        return `<div class="slot-row"><span class="slot-name">${e(SLOT_NAME[slot])}</span>${def?`<div class="slot-item" style="--rc:${def.color}"><b>${e(def.name)} +${inst.enhance||0}</b><small>${e(def.type)} ${rarityTag(def.rarity)}</small></div>`:'<span class="muted">空き</span>'}<button class="btn btn-mini" data-action="unequip" data-slot="${slot}" ${inst?'':'disabled'}>外す</button></div>`;
      }).join('')}
      <div class="callout">武器は現在の職業 <b>${e(JOB[c.jobId].name)}</b> が扱える系統（${JOB[c.jobId].weapons.join('・')}）のみ装備できます。</div>
      <h4 class="mt">装備による能力上昇</h4>${statTable(computeStats(c,s))}</div>
      <div class="panel soft"><h4>所持装備一覧 <span class="pill">${s.inventory.equipment.length} 個</span></h4>
        <label class="field"><span>スロットで絞り込み</span><select data-change="equipSlot"><option value="all">すべて</option>${SLOTS.map(x=>`<option value="${x}" ${app.equipSlot===x?'selected':''}>${e(SLOT_NAME[x])}</option>`).join('')}</select></label>
        <div class="equip-list">${s.inventory.equipment.filter(inst=>app.equipSlot==='all'||app.equipSlot===undefined||instanceDef(inst)?.slot===app.equipSlot).slice(0,60).map(inst=>{
          const def = instanceDef(inst); const worn = SLOTS.some(sl=>c.equipment[sl]===inst.uid);
          return equipRow(inst,s,{button:`<div class="eq-btns"><button class="btn btn-mini" data-action="equip" data-uid="${inst.uid}" data-slot="${def.slot}" ${worn?'disabled':''}>${worn?'装備中':'装備'}</button><button class="btn btn-mini ghost" data-action="sellEquip" data-uid="${inst.uid}">売却</button></div>`});
        }).join('') || '<p class="muted">装備がありません。ガチャで入手しましょう。</p>'}</div>
      </div></div>`;
  }
  if (tab === 1) return gachaScreen(app, s);
  if (tab === 2) {
    const sel = findInstance(s, app.selectedEquip);
    const cost = sel ? Math.round(180*Math.pow(1.55,sel.enhance||0)) : 0;
    const ore = sel ? 1+Math.floor((sel.enhance||0)/3) : 0;
    return `<div class="two-col">
      <div class="panel soft"><h4>装備を選ぶ</h4><div class="equip-list">${s.inventory.equipment.slice(0,80).map(inst=>equipRow(inst,s,{sel:app.selectedEquip===inst.uid,button:`<button class="btn btn-mini" data-action="enhanceSelect" data-uid="${inst.uid}">選択</button>`})).join('') || '<p class="muted">装備がありません</p>'}</div></div>
      <div class="panel soft"><h4>強化詳細</h4>${sel?`<div class="enhance-card" style="--rc:${instanceDef(sel).color}"><div class="enhance-visual">⚒<span>+${sel.enhance||0} → +${(sel.enhance||0)+1}</span></div><h3>${e(instanceDef(sel).name)}</h3>${equipRow(sel,s)}<div class="list-line"><span>必要コイン</span><b class="${s.coins>=cost?'ok':'bad'}">${fmt(cost)}</b></div><div class="list-line"><span>精錬鉱石</span><b class="${itemCount(s,'mat_ore')>=ore?'ok':'bad'}">${itemCount(s,'mat_ore')} / ${ore}</b></div><button class="btn btn-primary btn-lg full" data-action="enhance" ${sel.enhance>=10||s.coins<cost||itemCount(s,'mat_ore')<ore?'disabled':''}>⚒ 強化する（最大+10）</button></div>`:'<p class="muted">左から装備を選択してください。</p>'}
      <div class="hint-box">強化1段階で全ステータスが約11%ずつ上昇し、特殊効果も強まります。素材は道具屋・ダンジョン・修行で入手できます。</div></div></div>`;
  }
  const chosen = app.selectedSynth || [];
  const insts = chosen.map(u=>findInstance(s,u)).filter(Boolean);
  const rar = insts.length ? instanceRarity(insts[0]) : null;
  const idx = rar ? RARITY_ORDER.indexOf(rar) : 0;
  const cost = rar ? (rar==='S'?6000:Math.round(500*Math.pow(2.1,idx))) : 0;
  return `<div class="two-col">
    <div class="panel soft"><h4>素材を3つ選択 <span class="pill">${chosen.length} / 3</span></h4>
      <div class="hint-box">同じレアリティの装備3つと合成触媒で、1段階上のレアリティの装備が生まれます。装備中のものは外れます。</div>
      <div class="equip-list">${s.inventory.equipment.filter(inst=>!rar||instanceRarity(inst)===rar).slice(0,80).map(inst=>equipRow(inst,s,{sel:chosen.includes(inst.uid),button:`<button class="btn btn-mini" data-action="synthToggle" data-uid="${inst.uid}">${chosen.includes(inst.uid)?'✓ 選択中':'選ぶ'}</button>`})).join('') || '<p class="muted">装備がありません</p>'}</div></div>
    <div class="panel soft"><h4>合成結果</h4>
      <div class="synth-flow">${[0,1,2].map(i=>insts[i]?`<div class="synth-mat" style="--rc:${instanceDef(insts[i]).color}">${e(instanceDef(insts[i]).name)}<small>${rarityTag(instanceRarity(insts[i]))}</small></div>`:'<div class="synth-mat empty">？</div>').join('')}<div class="synth-arrow">➜</div><div class="synth-mat result">${rar?e(RARITY_ORDER[idx+1]?RARITY[RARITY_ORDER[idx+1]].name:'シークレット（強化+3）'):'？'}</div></div>
      <div class="list-line"><span>必要コイン</span><b class="${s.coins>=cost?'ok':'bad'}">${fmt(cost)}</b></div><div class="list-line"><span>合成触媒</span><b class="${itemCount(s,'mat_catalyst')>=(rar==='S'?2:1)?'ok':'bad'}">${itemCount(s,'mat_catalyst')} / ${rar==='S'?2:1}</b></div>
      <button class="btn btn-primary btn-lg full" data-action="synth" ${insts.length!==3||insts.some(i=>instanceRarity(i)!==rar)||s.coins<cost||itemCount(s,'mat_catalyst')<(rar==='S'?2:1)?'disabled':''}>✦ 合成する</button>
      <div class="hint-box">シークレット同士の合成は +3 の強化付きシークレットに生まれ変わります。累計合成 ${s.stats.syntheses} 回。</div>
    </div></div>`;
}

/* ---------- 修行場 ---------- */
function trainingTab(tab, app, s) {
  const c = activeChar(s); if (!c) return noChar();
  if (tab === 0) {
    const cost = trainingCost(s,'hp');
    return `<div class="callout green">修行では <b>EXP・職業熟練度・ステータスポイント</b> を同時に獲得できます。コインはCPU対戦やクエストで稼ぎましょう。累計修行 ${s.stats.trainings} 回。</div>
    <div class="train-grid">${TRAINING.map(t=>`<div class="train-card"><div class="train-icon">${t.icon}</div><b>${e(t.name)}</b><p>${e(t.desc)}</p><small>必要コイン 🪙 ${fmt(cost)} / 1回</small><div class="row-btns"><button class="btn btn-primary" data-action="training" data-id="${t.id}" data-sets="1" ${s.coins<cost?'disabled':''}>1回</button><button class="btn btn-glass" data-action="training" data-id="${t.id}" data-sets="3" ${s.coins<cost*3?'disabled':''}>3回</button></div></div>`).join('')}</div>
    <div class="panel soft"><h4>現在の能力値</h4>${statTable(computeStats(c,s))}</div>`;
  }
  if (tab === 1) {
    return `<div class="callout">技の練習で <b>熟練度 1→20</b> まで鍛えられます。熟練度1につき技の威力が <b>+3%</b>、職業熟練度も上がります。</div>
    <div class="skill-list wide">${c.skills.map(k=>{const sk=SKILL[k.id];const cost=220+k.mastery*90;return `<div class="skill-line">${elementTag(sk.element)}<div><b>${e(sk.name)} <small class="muted">熟練 ${k.mastery}/20（威力+${k.mastery*3}%）</small></b><small>${e(sk.cat)} / 威力${sk.power||'—'} / MP${sk.mp}</small></div>${bar(k.mastery,20,'linear-gradient(90deg,#8ce6a8,#b6f0c6)','')}<button class="btn btn-mini" data-action="practice" data-skill="${sk.id}" ${k.mastery>=20||s.coins<cost?'disabled':''}>練習 ${fmt(cost)}</button></div>`;}).join('')}</div>`;
  }
  return `<div class="callout gold">修行クエストは達成条件と報酬が設定された一回限りの挑戦。日替わり修行は何度でも受けられます。</div>
    <div class="quest-grid">${TRAINING_QUESTS.map(q=>{const st=trainingQuestStatus(s,c,q);return `<div class="quest-card ${st.done?'done':''}"><b>${e(q.name)}</b><p>${e(q.desc)}</p>
      <small class="muted">消費 ${fmt(q.cost)}コイン ／ 報酬：${Object.entries(q.reward).map(([k,v])=>k==='items'?Object.entries(v).map(([id,n])=>`${itemIcon(id,22)}${e(ITEM[id]?.name||id)}×${n}`).join('・'):k==='exp'?`EXP${v}`:k==='bp'?`BP${v}`:`${fmt(v)}コイン`).join(' / ')}</small>
      ${st.done?'<span class="pill on">達成済み</span>':st.ok?`<button class="btn btn-primary" data-action="trainingQuest" data-id="${q.id}">挑戦する</button>`:`<div class="cond-mini">${st.reasons.map(e).join(' / ')}</div><button class="btn btn-ghost" disabled>条件未達</button>`}</div>`;}).join('')}</div>
    <div class="panel soft"><h4>日替わり修行（繰り返し可能）</h4><p class="muted">320コインで EXP+180・職業熟練+12・ランダム素材1個。</p><button class="btn btn-primary" data-action="repeatTraining" ${s.coins<320?'disabled':''}>修行する</button></div>`;
}

/* ---------- 冒険者ギルド ---------- */
function enemyCard(app, s, en, mode='cpu', floor=0) {
  const unlocked = enemyUnlocked(s,en);
  const st = buildEnemyCombatant(en);
  const lockedText = en.hidden ? '覚醒III / ボス3体 / ダンジョン10階' : en.boss ? '6勝 + シルバーランク' : en.tier>=1 ? '3勝で解放' : '';
  return `<div class="enemy-card ${unlocked?'':'locked'}" style="--accent:${en.palette?.accent||'#ffd77a'}">
    <div class="enemy-sprite">${app.enemySprites[en.id]?`<img src="${app.enemySprites[en.id]}" alt="${e(en.name)}">`:''}</div>
    <div class="enemy-info"><b>${e(en.name)}</b><small>${e(JOB[en.job]?.name||'')} / Lv.${en.level} / ${e(en.difficulty||'CPU')}</small>
      <div class="enemy-metrics">${STAT_KEYS.map(k=>`<span>${STAT_ICONS[k]} ${STAT_NAMES[k]} ${fmt(st[k]||0)}</span>`).join('')}</div>
      <div class="enemy-skills">${en.skills.slice(0,3).map(id=>`<span>${e(SKILL[id]?.name||'')}</span>`).join('')}</div>
    </div>
    ${unlocked?`<button class="btn btn-primary" data-action="battleStart" data-enemy="${e(en.id)}" data-mode="${mode}" data-floor="${floor}">⚔ 対戦</button>`:`<button class="btn btn-ghost" disabled>🔒 ${e(lockedText)}</button>`}
  </div>`;
}
function guildTab(tab, app, s) {
  const c = activeChar(s); if (!c) return noChar();
  const r = rankInfo(s);
  if (tab === 0) {
    const group = app.enemyGroup || 'normal';
    const list = ENEMIES.filter(en => group==='normal' ? (!en.boss && !en.id.startsWith('ex_') && en.tier===0)
      : group==='strong' ? (!en.boss && (en.id.startsWith('ex_') || en.tier>=1))
      : (en.boss || en.hidden));
    return `<div class="guild-top">
      <div class="rank-box"><div class="rank-emblem">🏅</div><div><small>CPU対戦ランク</small><h4>${e(r.name)} <span>RP ${fmt(s.rankPoints)}</span></h4>${r.next?bar(s.rankPoints-r.min,r.next.min-r.min,'linear-gradient(90deg,#ffd77a,#ff9e7a)',`次の${r.next.name}まで ${fmt(Math.max(0,r.next.min-s.rankPoints))} RP`):'<span class="pill on">最高ランク到達</span>'}</div></div>
      <div class="streak-box"><small>現在の連勝</small><b>🔥 ${s.winStreak}</b><span>最高 ${s.bestStreak} ／ 連勝ボーナス +${Math.min(60,s.winStreak*4)}%</span></div>
      <div class="record-box"><small>通算戦績</small><b>${s.stats.wins} 勝 ${s.stats.losses} 敗</b><span>勝率 ${s.stats.battles?Math.round(s.stats.wins/s.stats.battles*100):0}% ／ ボス撃破 ${s.stats.bossKills}</span></div>
    </div>
    <div class="filter-tabs">${[['normal','ノーマル'],['strong','強敵'],['boss','ボス・隠し']].map(([id,label])=>`<button class="ftab ${group===id?'on':''}" data-action="enemyGroup" data-group="${id}">${label}</button>`).join('')}</div>
    <div class="enemy-grid">${list.map(en=>enemyCard(app,s,en)).join('')}</div>
    <div class="panel soft mt"><h4>ランク報酬</h4><div class="rank-rewards">${RANKS.map((rk,i)=>`<div class="rank-reward ${s.rankClaimed.includes(i)?'claimed':''}"><span>${e(rk.name)}</span><small>RP ${fmt(rk.min)} / 🪙 ${fmt(rk.reward)}</small>${i===0?'<span class="pill">初期</span>':s.rankClaimed.includes(i)?'<span class="pill on">受取済</span>':r.idx>=i?`<button class="btn btn-mini" data-action="claimRank" data-idx="${i}">受け取る</button>`:'<span class="pill off">未到達</span>'}</div>`).join('')}</div></div>`;
  }
  if (tab === 1) {
    const d = s.dungeon, hard = d.hard;
    return `<div class="two-col">
      <div class="panel soft"><h4>ダンジョン「水晶の迷宮」</h4>
        <div class="dungeon-visual"><div class="dungeon-floor">F<span>${d.floor}</span></div><div class="dungeon-path">${Array.from({length:10},(_,i)=>`<span class="${(d.floor-1)%10>=i?'on':''}">${i===9?'👑':i%5===4?'💠':'◆'}</span>`).join('')}</div></div>
        <div class="list-line"><span>現在の階</span><b>${d.floor} 階 ${hard?'（深淵・高難易度）':''}</b></div>
        <div class="list-line"><span>最高踏破</span><b>${d.best} 階</b></div>
        <div class="list-line"><span>次の敵</span><b>${e(dungeonEnemy(s,d.floor,hard).name)}</b></div>
        <div class="row-btns"><button class="btn btn-primary btn-lg" data-action="dungeonStart" data-hard="0">⚔ ${d.floor}階に挑む</button><button class="btn btn-glass" data-action="dungeonReset" data-hard="0">1階からやり直す</button></div>
        <div class="hint-box">勝利すると次の階へ進み、コイン・EXP・BP・ランクPを獲得。5階ごとに進化の結晶、敗北しても少量のポイントが入ります。進行状況はセーブされます。</div>
      </div>
      <div class="panel soft"><h4>高難易度・隠し要素</h4>
        <div class="special-card"><b>🌑 高難易度ダンジョン「深淵」</b><p>敵の能力が約1.6倍。報酬も大幅アップ。</p><small>解放条件：ダンジョン15階踏破（現在 ${d.best}階）</small>${hardDungeonUnlocked(s)?`<button class="btn btn-primary" data-action="dungeonStart" data-hard="1">深淵に挑む</button><button class="btn btn-ghost" data-action="dungeonReset" data-hard="1">深淵をリセット</button>`:'<span class="pill off">未解放</span>'}</div>
        <div class="special-card"><b>☄ 隠しボス「虚無の王 ノクティス」</b><p>撃破で転生の証・BP600・専用称号。</p><small>解放条件：覚醒III / ボス撃破3体 / ダンジョン10階（現在 覚醒${c.awakening}・${s.stats.bossKills}体・${d.best}階）</small>${hiddenBossUnlocked(s,c)?`<button class="btn btn-primary" data-action="hiddenBoss">☄ 挑戦する</button>`:'<span class="pill off">未解放</span>'}</div>
        <div class="special-card"><b>🏅 特別な強敵</b><p>「ボス・隠し」タブから塔の主・時空の番人・星輝の守護者に挑めます。撃破で「強敵の証」を入手。</p><button class="btn btn-glass" data-action="enemyGroup" data-group="boss">強敵一覧へ</button></div>
      </div></div>`;
  }
  if (tab === 2) {
    return `<div class="two-col">
      <div class="panel soft"><h4>クエスト <small class="muted">デイリーは毎日リセット</small></h4>
        <div class="quest-list">${QUESTS.map(q=>{const p=Math.min(q.need,questProgress(s,q)), done=questClaimed(s,q);return `<div class="quest-line ${done?'done':''}"><div><b>${e(q.name)} ${q.daily?'<span class="pill">DAILY</span>':''}</b><small>${e(q.desc)}</small><div class="reward-mini">報酬：${Object.entries(q.reward).map(([k,v])=>k==='items'?Object.entries(v).map(([id,n])=>`${itemIcon(id,22)}${e(ITEM[id]?.name||id)}×${n}`).join('・'):k==='exp'?`EXP${v}`:k==='bp'?`BP${v}`:`${fmt(v)}コイン`).join(' / ')}</div></div>${bar(p,q.need,'linear-gradient(90deg,#ffd77a,#8ce6a8)',`${fmt(p)} / ${fmt(q.need)}`)}${done?'<span class="pill on">受取済</span>':p>=q.need?`<button class="btn btn-primary" data-action="claimQuest" data-id="${q.id}">受け取る</button>`:'<span class="pill off">進行中</span>'}</div>`;}).join('')}</div>
      </div>
      <div class="panel soft"><h4>実績 <span class="pill">${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length}</span></h4>
        <div class="ach-list">${ACHIEVEMENTS.map(a=>`<div class="ach-line ${s.achievements[a.id]?'done':''}"><b>${s.achievements[a.id]?'🏆':'🔒'} ${e(a.name)}</b><small>${e(a.desc)} ／ 報酬：${e(a.title)} + ${Object.entries(a.reward).map(([k,v])=>k==='items'?Object.entries(v).map(([id,n])=>`${itemIcon(id,22)}${e(ITEM[id]?.name||id)}×${n}`).join('・'):`${fmt(v)}${k==='coins'?'コイン':'BP'}`).join(' / ')}</small></div>`).join('')}</div>
        <div class="hint-box">実績は条件達成時に自動で解放され、報酬と称号が即座に付与されます。称号はキャラクター画面で装備できます。</div>
      </div></div>`;
  }
  return `<div class="two-col">
    <div class="panel soft"><h4>戦績</h4><div class="record-grid">
      <div><small>通算対戦</small><b>${s.stats.battles}</b></div><div><small>勝利</small><b>${s.stats.wins}</b></div><div><small>敗北</small><b>${s.stats.losses}</b></div>
      <div><small>最高連勝</small><b>${s.bestStreak}</b></div><div><small>ランク</small><b>${e(r.name)}</b></div><div><small>ランクP</small><b>${fmt(s.rankPoints)}</b></div>
      <div><small>ボス撃破</small><b>${s.stats.bossKills}</b></div><div><small>最大一撃</small><b>${fmt(s.stats.maxDamage)}</b></div>
      <div><small>累計与ダメージ</small><b>${fmt(s.stats.damageDealt)}</b></div><div><small>ダンジョン最高</small><b>${s.dungeon.best}階</b></div></div>
      <h4 class="mt">キャラクター別戦績</h4>${s.characters.map(ch=>`<div class="list-line"><span>${e(ch.name)}</span><b>${ch.record.wins}勝 ${ch.record.losses}敗 / 最高${ch.record.bestStreak}連勝</b></div>`).join('')}
    </div>
    <div class="panel soft"><h4>対戦ポイント交換所 <span class="pill">🔷 ${fmt(s.bp)} BP</span></h4>
      <div class="exchange-list">${EXCHANGE.map(ex=>{const owned = ex.kind==='skill' && c.skills.some(k=>k.id===ex.skill);
        const need = ex.skill==='sk_secret'?5:ex.skill==='sk_awaken3'||ex.skill==='sk_awaken2'?2:1;
        const lock = ex.kind==='skill' && c.awakening<need;
        return `<div class="ex-line"><div><b>${e(ex.name)}</b><small>${e(ex.desc)}${lock?` ／ 覚醒${need}以上が必要`:''}</small></div><button class="btn btn-mini" data-action="exchange" data-id="${ex.id}" ${s.bp<ex.cost||owned||lock?'disabled':''}>${owned?'習得済':lock?'🔒':`🔷 ${fmt(ex.cost)}`}</button></div>`;}).join('')}</div>
      <div class="hint-box">勝利でBP、敗北でも少量のBPを獲得。連勝・ボス・ダンジョンでさらに増えます。</div>
    </div></div>`;
}

/* ---------- 道具屋 ---------- */
function shopTab(tab, app, s) {
  const c = activeChar(s); if (!c) return noChar();
  if (tab === 0) {
    return `<div class="callout">所持コイン 🪙 <b>${fmt(s.coins)}</b>。回復アイテムは戦闘中にも使えます。</div>
      <div class="shop-grid">${SHOP_STOCK.map(id=>{const it=ITEM[id];return `<div class="shop-card"><div class="shop-icon">${itemIcon(id,44)}</div><div><b>${e(it.name)}</b><p>${e(it.desc)}</p><small>所持 ${itemCount(s,id)} / 🪙 ${fmt(it.price)}</small></div><div class="row-btns tiny"><button class="btn btn-mini" data-action="buy" data-id="${id}" data-n="1" ${s.coins<it.price?'disabled':''}>買う</button><button class="btn btn-mini ghost" data-action="buy" data-id="${id}" data-n="5" ${s.coins<it.price*5?'disabled':''}>×5</button></div></div>`;}).join('')}</div>`;
  }
  if (tab === 1) {
    return `<div class="two-col">
      <div class="panel soft"><h4>アイテムを売却</h4>${Object.entries(s.inventory.items).filter(([id,n])=>n>0).map(([id,n])=>`<div class="sell-line"><span>${itemIcon(id,28)} ${e(ITEM[id]?.name||id)} <small>×${n}</small></span><small>売値 ${fmt(ITEM[id]?.sell||30)} / 個</small><div class="row-btns tiny"><button class="btn btn-mini" data-action="sell" data-id="${id}" data-n="1">1個</button><button class="btn btn-mini ghost" data-action="sell" data-id="${id}" data-n="999">全部</button></div></div>`).join('') || '<p class="muted">売却できるアイテムがありません</p>'}</div>
      <div class="panel soft"><h4>装備を売却</h4><p class="muted small">装備中のものを売ると自動で外れます。不要なノーマル・レアを整理しましょう。</p>${s.inventory.equipment.slice(0,80).map(inst=>equipRow(inst,s,{button:`<button class="btn btn-mini ghost" data-action="sellEquip" data-uid="${inst.uid}">売却</button>`})).join('') || '<p class="muted">装備がありません</p>'}</div></div>`;
  }
  const mats = Object.entries(s.inventory.items).filter(([id,n])=>isMaterial(id)&&n>0);
  const upgrades = MATERIAL_ITEMS.filter(m=>m.rank!=='LR' && itemCount(s,m.id)>=3).slice(0,16);
  return `<div class="callout violet">🎁 進化素材：8種類 × 5ランク = 40種。カードをクリックすると名前・レアリティ・説明・所持数・進化先・必要個数・入手方法を確認できます。</div>
    <div class="two-col">
      <div class="panel soft"><h4>所持素材 <span class="pill">${mats.length} 種</span></h4>${materialGrid(app,s,mats)}
        <h4 class="mt">素材合成・交換</h4><div class="hint-box small">同じ素材3個とコインで1ランク上の素材に合成できます。余った低ランク素材も無駄になりません。</div>
        <div class="mat-upgrade-list">${upgrades.map(m=>`<div class="mat-upgrade"><div>${itemIcon(m.id,34)}<b>${e(m.name)} ×${itemCount(s,m.id)}</b><small>→ ${e(MATERIAL_BY_ID[materialUpgradeTarget(m.id)]?.name||'')} 🪙${fmt(160*(MAT_RANKS.indexOf(m.rank)+1))}</small></div>
          <button class="btn btn-mini" data-action="matUpgrade" data-id="${m.id}" ${s.coins<160*(MAT_RANKS.indexOf(m.rank)+1)?'disabled':''}>合成</button></div>`).join('') || '<p class="muted">合成可能な素材がありません（3個以上必要）</p>'}</div>
        <div class="row-btns mt"><button class="btn btn-glass" data-action="nav" data-to="codex" data-codex-tab="6">📖 素材図鑑を見る</button></div>
      </div>
      <div class="panel soft"><h4>素材の入手先</h4>
        <div class="source-list">
          <div><b>⚔ CPU対戦</b><small>勝利で進化石・武器強化鉱石 R。強敵ほど上位ランク。</small></div>
          <div><b>🌑 ダンジョン踏破</b><small>5階ごとに覚醒結晶・属性の宝石。高難易度はさらに上位。</small></div>
          <div><b>☄ ボス撃破</b><small>ボスの核 SSR / 職業の証。隠しボスは伝説の素材 LR。</small></div>
          <div><b>📜 高難易度クエスト・修行</b><small>魔力結晶・属性の宝石・伝説の素材。</small></div>
          <div><b>🗓 デイリーミッション / 実績</b><small>低ランク素材を安定供給。上位実績で UR/LR。</small></div>
          <div><b>🔷 BP交換所 / 道具屋 / ガチャ10連</b><small>低ランク購入・上位素材交換・ガチャ結果ボーナス。</small></div>
        </div>
        <h4 class="mt">低ランク素材も必要</h4><div class="hint-box">SR以降の進化条件にも R 素材が混ざるため、序盤の素材が無駄になりません。余剰は合成・交換・売却に使えます。</div>
        <div class="row-btns"><button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="nurture" data-tab="4">✦ キャラ進化</button><button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="forge" data-tab="4">⚒ 装備進化</button></div>
      </div></div>
    <h4 class="mt">🛒 購入可能な素材</h4><div class="shop-grid">${SHOP_STOCK.filter(id=>isMaterial(id)).map(id=>{const it=ITEM[id];return `<div class="shop-card">${itemIcon(id,48)}<div><b>${e(it.name)}</b><p>${e(it.desc)}</p><small>所持 ${itemCount(s,id)} / 🪙 ${fmt(it.price)}</small></div><div class="row-btns tiny"><button class="btn btn-mini" data-action="buy" data-id="${id}" data-n="1" ${s.coins<it.price?'disabled':''}>買う</button><button class="btn btn-mini ghost" data-action="sell" data-id="${id}" data-n="1" ${itemCount(s,id)<1?'disabled':''}>売る</button></div></div>`;}).join('')}</div>`;
}

function noChar() { return `<div class="no-char"><div>🎨</div><h3>まだキャラクターがいません</h3><p>あなたの画像からオリジナルキャラクターを作成しましょう。</p><button class="btn btn-primary btn-lg" data-action="newChar">キャラクター作成へ</button></div>`; }

/* ============================ キャラクター / 見た目 ============================ */
function characterScreen(app, s) {
  const c = activeChar(s); if (!c) return `${navBar(app,s)}<main class="page">${noChar()}</main>`;
  const st = computeStats(c,s);
  return `${navBar(app,s)}<main class="page char-page">
    <div class="page-head"><div><h2>🧙 キャラクター</h2><p>画像・能力値・職業・技・装備・戦績を一元管理</p></div><div class="row-btns"><button class="btn btn-primary" data-action="nav" data-to="appearance">🎨 見た目を変更</button><button class="btn btn-glass" data-action="newChar">＋ 新規作成</button></div></div>
    <div class="char-layout">
      <div class="panel char-sheet">
        <div class="char-portrait large ${c.frame}">${charImage(c,'portrait')}<div class="portrait-name">${e(c.name)}</div></div>
        <div class="char-badges">${rankBadge(c.rarity)}<span class="pill">Lv.${c.level}</span><span class="pill">${e(AWAKENING_NAMES[c.awakening])}</span></div>
        <div class="exp-line"><small>EXP</small>${bar(c.exp, xpForLevel(c.level), 'linear-gradient(90deg,#ffd77a,#ffe9a8)', `EXP ${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}（次Lvまで ${fmt(Math.max(0,xpForLevel(c.level)-c.exp))}）`)}</div>
        <div class="row-btns"><button class="btn btn-mini" data-action="nav" data-to="facility" data-facility="nurture" data-tab="4">✦ 進化画面へ</button></div>
        <label class="field"><span>名前を変更</span><div class="inline"><input type="text" maxlength="16" value="${e(c.name)}" data-draft="charName"><button class="btn btn-mini" data-action="renameChar">変更</button></div></label>
        <div class="list-line"><span>職業</span><b>${e(JOB[c.jobId].name)} Lv.${c.jobLevels[c.jobId]||1}</b></div>
        <div class="list-line"><span>スタイル</span><b>${e(STYLES.find(x=>x.id===c.styleId)?.name||'')}</b></div>
        <div class="list-line"><span>称号</span><b>${e(TITLE[c.titleId]?.name||'なし')}</b></div>
        <div class="list-line"><span>戦闘力</span><b>${fmt(powerScore(c,s))}</b></div>
        <div class="list-line"><span>戦績</span><b>${c.record.wins}勝 ${c.record.losses}敗</b></div>
        <div class="list-line"><span>転生</span><b>${c.rebirth||0} 回</b></div>
        <h4 class="mt">称号を装備</h4><select data-change="equipTitle">${s.titles.map(id=>`<option value="${id}" ${c.titleId===id?'selected':''}>${e(TITLE[id]?.name||id)} — ${e(TITLE[id]?.desc||'')}</option>`).join('')}</select>
        <h4 class="mt">フレーム</h4><div class="chip-row">${['gold','blue','violet','prism'].map(f=>`<button class="btn btn-mini ${c.frame===f?'on':''}" data-action="setFrame" data-id="${f}">${({gold:'金',blue:'蒼',violet:'紫',prism:'虹'})[f]}</button>`).join('')}</div>
      </div>
      <div class="char-detail">
        <div class="panel soft"><h4>能力値</h4>${statTable(st)}${bar(c.hp,st.hp,'linear-gradient(90deg,#ff6b6b,#ff9e7a)',`HP ${fmt(c.hp)} / ${fmt(st.hp)}`)}${bar(c.mp,st.mp,'linear-gradient(90deg,#5b9dff,#8ce6ff)',`MP ${fmt(c.mp)} / ${fmt(st.mp)}`)}${bar(c.exp,xpForLevel(c.level),'linear-gradient(90deg,#ffd77a,#ffe9a8)',`EXP ${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}`)}</div>
        <div class="panel soft"><h4>装備中</h4>${SLOTS.map(slot=>{const inst=findInstance(s,c.equipment[slot]);const def=instanceDef(inst);return `<div class="list-line"><span>${e(SLOT_NAME[slot])}</span><b style="color:${def?.color||'#889'}">${e(def?.name||'なし')} ${def?`+${inst.enhance||0}`:''}</b></div>`;}).join('')}</div>
        <div class="panel soft"><h4>習得技（装備中 ★）</h4><div class="chip-row">${c.skills.map(k=>`<span class="chip ${c.equippedSkills.includes(k.id)?'on':''}">${c.equippedSkills.includes(k.id)?'★':'☆'} ${e(SKILL[k.id]?.name||k.id)}</span>`).join('')}</div></div>
        <div class="panel soft"><h4>キャラクター切替 <span class="pill">${s.characters.length} 人</span></h4>${s.characters.map(ch=>`<div class="switch-line">${charImage(ch,'tiny')}<div><b>${e(ch.name)}</b><small>Lv.${ch.level} / ${e(JOB[ch.jobId].name)}</small></div>${ch.id===s.activeId?'<span class="pill on">選択中</span>':`<button class="btn btn-mini" data-action="switchChar" data-id="${ch.id}">選択</button>`}${s.characters.length>1?`<button class="btn btn-mini ghost" data-action="deleteChar" data-id="${ch.id}">削除</button>`:''}</div>`).join('')}</div>
      </div>
    </div></main>${toastArea(app)}`;
}

/* ============================ 図鑑 ============================ */
function codexScreen(app, s) {
  const tab = app.codexTab || 0;
  const tabs = ['職業','技','装備','CPU','実績','称号','素材図鑑'];
  const collected = collectedSkills(s);
  let body = '';
  if (tab === 0) body = `<div class="callout">収集：${s.catalog.jobs.length} / ${JOBS.length} 職業。転職すると図鑑に記録されます。</div><div class="codex-grid">${JOBS.map(j=>`<div class="codex-card ${s.catalog.jobs.includes(j.id)?'':'unknown'}" style="--jc:${j.color}"><span>${j.icon}</span><b>${s.catalog.jobs.includes(j.id)?e(j.name):'？？？'}</b><small>${['','基本職','上級職','特殊職'][j.tier]} / ${e(jobReqText(j))}</small></div>`).join('')}</div>`;
  if (tab === 1) {
    const ordinary = SKILLS.filter(sk=>!ULTIMATE_IDS.has(sk.id)&&sk.source!=='god');
    const specials = SKILLS.filter(sk=>ULTIMATE_IDS.has(sk.id)||sk.source==='god');
    const card = sk => `<div class="codex-skill ${collected.includes(sk.id)?'':'unknown'}">${elementTag(sk.element)}<b>${collected.includes(sk.id)?e(sk.name):'？？？'}</b><small>${collected.includes(sk.id)?`${e(sk.cat)} / 威力${sk.power||'—'} / MP${sk.mp||0}`:'未習得・進化で解放'}</small></div>`;
    body = `<div class="callout">全技収集：${collected.filter(id=>!ULTIMATE_IDS.has(id)&&SKILL[id]?.source!=='god').length} / ${LEARNABLE_SKILL_COUNT} 種 ${collected.filter(id=>!ULTIMATE_IDS.has(id)&&SKILL[id]?.source!=='god').length>=LEARNABLE_SKILL_COUNT?'🌟 コンプリート！':''}</div>
      <div class="codex-skills">${ordinary.map(card).join('')}</div>
      <h4 class="mt">✵ 奥義・神専用技 <small class="muted">ランク進化 / 特殊ギミックで解放</small></h4>
      <div class="codex-skills">${specials.map(card).join('')}</div>`;
  }
  if (tab === 2) body = `<div class="callout">装備図鑑：${s.catalog.equipment.length} / ${EQUIPMENT.length} 種。ガチャ・交換・合成で入手すると記録されます。</div><div class="codex-skills">${EQUIPMENT.map(d=>`<div class="codex-skill ${s.catalog.equipment.includes(d.id)?'':'unknown'}" style="--rc:${d.color}"><b style="color:${s.catalog.equipment.includes(d.id)?d.color:'#667'}">${s.catalog.equipment.includes(d.id)?e(d.name):'？？？'}</b><small>${s.catalog.equipment.includes(d.id)?`${e(d.type)} / ${e(SLOT_NAME[d.slot])}`:'未発見'} ${rarityTag(d.rarity)}</small></div>`).join('')}</div>`;
  if (tab === 3) body = `<div class="callout">撃破・対戦したCPU：${s.catalog.enemies.length} / ${ENEMIES.length + 20} 記録（ダンジョンの敵も含む）</div><div class="enemy-grid">${ENEMIES.map(en=>`<div class="codex-card ${s.catalog.enemies.includes(en.id)?'':'unknown'}"><span>${en.boss?'☄':en.tier>=1?'⚔':'✦'}</span><b>${s.catalog.enemies.includes(en.id)?e(en.trueName||en.name):'？？？'}</b><small>${s.catalog.enemies.includes(en.id)?`${e(JOB[en.job]?.name||'')} / Lv.${en.level}`:'未対戦'}</small></div>`).join('')}</div>`;
  if (tab === 4) body = `<div class="callout">実績：${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length} 達成</div><div class="codex-grid">${ACHIEVEMENTS.map(a=>`<div class="codex-card ${s.achievements[a.id]?'':'unknown'}"><span>${s.achievements[a.id]?'🏆':'🔒'}</span><b>${e(a.name)}</b><small>${e(a.desc)} / 称号「${e(a.title)}」</small></div>`).join('')}</div>`;
  if (tab === 6) body = materialCodex(app, s);
  if (tab === 5) body = `<div class="callout">称号：${s.titles.length-1} / ${TITLES.length-1} 解放。称号は能力値ボーナスを与えます。</div><div class="codex-grid">${TITLES.filter(t=>t.id!=='t_none').map(t=>`<div class="codex-card ${s.titles.includes(t.id)?'':'unknown'}"><span>🎖</span><b>${s.titles.includes(t.id)?e(t.name):'？？？'}</b><small>${s.titles.includes(t.id)?e(t.desc):'未解放'}</small></div>`).join('')}</div>`;
  return `${navBar(app,s)}<main class="page codex-page"><div class="page-head"><div><h2>📖 図鑑</h2><p>職業・技・装備・CPU・実績・称号の収集状況</p></div><button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ</button></div>
    <div class="facility-tabs">${tabs.map((t,i)=>`<button class="ftab ${tab===i?'on':''}" data-action="codexTab" data-i="${i}">${t}</button>`).join('')}</div>
    <section class="panel soft">${body}</section></main>${toastArea(app)}`;
}

/* ============================ やり込み ============================ */
function endgameScreen(app, s) {
  const c = activeChar(s); if (!c) return `${navBar(app,s)}<main class="page">${noChar()}</main>`;
  const collected = collectedSkills(s);
  const r = rankInfo(s);
  const rows = [
    { icon:'🕊', name:'最大レベル到達後の転生', cond:`Lv.${levelCap(c)} 到達 / 転生の証 / 5,000コイン`, reward:'全能力+12%（永続）/ BP350 / 称号「転生者」', status:`${c.rebirth||0} 回 / 現在Lv.${c.level}`, btn: canRebirth(s,c)?'<button class="btn btn-primary" data-action="rebirth">転生する</button>':'<span class="pill off">条件未達</span>' },
    { icon:'📈', name:'職業ごとの熟練度', cond:'全21職を経験し、各職業Lv.30まで鍛える', reward:'コイン20,000 / BP500 / 称号「職業の覇者」', status:`${Object.keys(c.jobLevels).length} / ${JOBS.length} 職経験 / 合計Lv.${Object.values(c.jobLevels).reduce((a,b)=>a+b,0)}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="nurture" data-tab="1">職業へ</button>' },
    { icon:'✦', name:'全技の収集', cond:`${SKILLS.length}種すべてを習得`, reward:'BP1,200 / コイン30,000 / 称号「技の化身」', status:`${collected.length} / ${SKILLS.length}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="nurture" data-tab="2">技習得へ</button>' },
    { icon:'🌟', name:'覚醒段階の完全解放', cond:'覚醒Vまで到達（レベル・熟練度・ボス・素材）', reward:'全能力×1.65 / 覚醒限定技6種 / 称号「極致の超越者」', status:`覚醒 ${c.awakening} / 5`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="nurture" data-tab="3">覚醒へ</button>' },
    { icon:'🌟', name:'レアリティ R → LR 完全進化', cond:'レベル条件と進化素材を揃えて4回進化', reward:'全能力×2.10 / 進化限定技4種 / 虹白金の専用オーラ', status:`${e(c.rarity)} / 累計進化 ${s.stats.evolutions||0} 回`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="nurture" data-tab="4">進化へ</button>' },
    { icon:'⚒', name:'装備ランク進化 LR', cond:'武器・防具・装飾品を素材で R→LR まで進化', reward:'攻撃力・特殊効果の大幅強化 / ランク固有の装飾と発光', status:`装備進化 ${s.stats.equipEvolutions||0} 回`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="forge" data-tab="4">工房へ</button>' },
    { icon:'📖', name:'武器・装備・技・職業図鑑', cond:`装備${EQUIPMENT.length}種 / 技${SKILLS.length}種 / 職業${JOBS.length}種を記録`, reward:'称号「鑑定士」「技博覧」ほか', status:`装備${s.catalog.equipment.length} / 技${collected.length} / 職${s.catalog.jobs.length}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="codex">図鑑へ</button>' },
    { icon:'🏅', name:'CPU対戦ランク', cond:'ランクP 6,500で神階到達', reward:'各ランク到達でコイン最大30,000', status:`${e(r.name)} / RP ${fmt(s.rankPoints)}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">対戦へ</button>' },
    { icon:'🔥', name:'連勝記録', cond:'10連勝 / 不敗の証', reward:'コイン5,000 / BP180 / 称号「不敗王」', status:`最高 ${s.bestStreak} 連勝 / 現在 ${s.winStreak}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">連勝へ</button>' },
    { icon:'🏆', name:'実績・称号', cond:`${ACHIEVEMENTS.length}個の実績条件を達成`, reward:`${TITLES.length-1}種の称号と通貨・素材`, status:`${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length} 実績 / ${s.titles.length-1} 称号`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="2">実績へ</button>' },
    { icon:'☄', name:'隠しボス', cond:'覚醒III / ボス3体 / ダンジョン10階', reward:'転生の証 / BP600 / 称号「虚無の征服者」', status: hiddenBossUnlocked(s,c)?`解放済 / 撃破${s.stats.hiddenKills}回`:'未解放', btn: hiddenBossUnlocked(s,c)?'<button class="btn btn-primary" data-action="hiddenBoss">挑戦</button>':'<span class="pill off">未解放</span>' },
    { icon:'🌑', name:'高難易度ダンジョン', cond:'ダンジョン15階踏破', reward:'報酬1.6倍 / 星砂 / 称号「迷宮の主」', status: hardDungeonUnlocked(s)?'解放済':'未解放', btn: hardDungeonUnlocked(s)?'<button class="btn btn-glass" data-action="dungeonStart" data-hard="1">深淵へ</button>':'<span class="pill off">未解放</span>' },
    { icon:'⚒', name:'レア装備の合成', cond:'同レアリティ装備3つ + 合成触媒', reward:'1段階上のレアリティ / シークレット+3強化', status:`累計 ${s.stats.syntheses} 回`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="forge" data-tab="3">合成へ</button>' },
    { icon:'🎨', name:'キャラクターの見た目変更', cond:'元画像が保存されていればいつでも可能', reward:'元画像の差し替え / 表示設定 / オーラ / フレーム', status:`${c.original?'保存済':'未保存'} / オーラ ${e(AURAS.find(a=>a.id===c.aura)?.name||'なし')}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="appearance">変更へ</button>' },
  ];
  return `${navBar(app,s)}<main class="page endgame-page">
    <div class="page-head"><div><h2>🏆 やり込み要素</h2><p>長く遊べる12の目標。すべてに達成条件と報酬があります。</p></div><button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ</button></div>
    <div class="endgame-grid">${rows.map(x=>`<div class="end-card"><div class="end-icon">${x.icon}</div><div class="end-body"><b>${e(x.name)}</b><p>条件：${e(x.cond)}</p><p class="reward">報酬：${e(x.reward)}</p><small>進捗：${e(x.status)}</small></div><div class="end-btn">${x.btn}</div></div>`).join('')}</div>
    <div class="panel soft mt"><h4>📜 育成記録 <span class="pill">最新 ${s.log.length} 件</span></h4><div class="log-list">${s.log.slice(0,60).map(l=>`<div class="log-line"><span>${new Date(l.t).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span><em class="k-${e(l.kind)}">${e(l.kind)}</em>${e(l.text)}</div>`).join('') || '<p class="muted">まだ記録がありません</p>'}</div></div>
  </main>${toastArea(app)}`;
}

/* ============================ 設定 ============================ */
function settingsScreen(app, s) {
  return `${navBar(app,s)}<main class="page settings-page">
    <div class="page-head"><div><h2>⚙ 設定・セーブ</h2><p>進行状況はブラウザ内の IndexedDB に自動保存されます</p></div><button class="btn btn-ghost" data-action="nav" data-to="town">🏰 街へ</button></div>
    <div class="two-col">
      <div class="panel soft"><h4>ゲーム設定</h4>
        <div class="setting-line"><div><b>効果音</b><small>戦闘・ボタンの効果音（WebAudioで生成）</small></div><button class="btn btn-mini ${s.settings.sfx?'on':''}" data-action="toggleSfx">${s.settings.sfx?'ON':'OFF'}</button></div>
        <div class="setting-line"><div><b>環境音</b><small>静かなファンタジー風のアルペジオ</small></div><button class="btn btn-mini ${s.settings.bgm?'on':''}" data-action="toggleBgm">${s.settings.bgm?'ON':'OFF'}</button></div>
        <div class="setting-line"><div><b>自動セーブ</b><small>操作のたびに保存（推奨）</small></div><button class="btn btn-mini ${s.settings.autosave?'on':''}" data-action="toggleAutosave">${s.settings.autosave?'ON':'OFF'}</button></div>
        <label class="set-row"><span>戦闘演出の速さ<small>大きいほど高速</small></span><input type="range" data-setting="anim" data-target="settings" min="0.5" max="3" step="0.25" value="${s.settings.animSpeed}"><output id="out_settings_anim">${s.settings.animSpeed}</output></label>
        <div class="list-line"><span>最終セーブ</span><b>${s.savedAt?new Date(s.savedAt).toLocaleString('ja-JP'):'未保存'}</b></div>
        <div class="list-line"><span>キャラクター数</span><b>${s.characters.length} 人</b></div>
        <div class="row-btns"><button class="btn btn-primary" data-action="saveNow">💾 今すぐセーブ</button><button class="btn btn-glass" data-action="exportSave">📤 書き出す</button></div>
      </div>
      <div class="panel soft"><h4>データ管理</h4>
        <div class="hint-box">「書き出す」でセーブデータ（元画像・表示設定・育成状況をすべて含むJSON）をダウンロードできます。別の端末で「読み込む」を選べば続きから遊べます。</div>
        <label class="btn btn-glass full" for="importFile">📥 セーブデータを読み込む</label><input id="importFile" type="file" accept="application/json,.json" data-file="import" hidden>
        <button class="btn btn-ghost full mt" data-action="resetGame">🗑 データを初期化</button>
        ${app.confirmReset?`<div class="danger-box"><b>本当に初期化しますか？</b><p>全キャラクター・画像・進行状況が消えます。元に戻せません。</p><div class="row-btns"><button class="btn btn-danger" data-action="resetGameConfirm">初期化を確定</button><button class="btn btn-ghost" data-action="resetCancel">キャンセル</button></div></div>`:''}
        <h4 class="mt">あそび方</h4><ol class="flow"><li>タイトル「ゲームスタート」→ 画像を読み込み、そのままキャラクター登録</li><li>街の5施設でレベル・職業・技・装備・覚醒を育成</li><li>冒険者ギルドのCPU対戦でコイン・EXP・BP・ランクPを獲得</li><li>対戦ポイントで限定技・特別装備・覚醒素材と交換</li><li>ダンジョン・隠しボス・転生で長期的な目標に挑戦</li></ol>
        <div class="hint-box">CPU対戦はローカル完結。友達とのオンライン対戦を後から追加できるよう、対戦エンジンはプレイヤー/CPUを独立したデータ構造で分離しています。</div>
      </div>
    </div></main>${toastArea(app)}`;
}

/* ============================ 戦闘 ============================ */
function combatPanel(b, side, label, char) {
  const isP = side === b.player;
  const statuses = b.statusLabel(side);
  const jobName = JOB[side.job]?.name || '—';
  const rarity = isP ? (char?.rarity || 'R')
    : (side.hidden ? 'S' : side.boss ? 'M' : side.level >= 40 ? 'L' : side.level >= 25 ? 'E' : 'R');
  return `<div class="combatant ${isP?'p1':'p2'} ${isP&&char?.jobId===GOD_JOB_ID?'god-mode':''}" id="${isP?'arena-player':'arena-enemy'}">
    <div class="combat-sprite ${isP?'':'mirrored'}">${isP && char ? charImage(char,'battle') : spriteImg(side.sprite,'battle',side.aura)}</div>
    ${isP && char ? `<div class="combat-rank">${rankBadge(char.rarity)}</div>` : ''}
    <div class="combat-info">
      <div class="combat-name">${e(side.name)}</div>
      <div class="combat-meta"><span class="pill">${e(rarity)}</span><span>Lv.${side.level}</span><span>${e(jobName)}</span></div>
      ${bar(side.hp,side.maxHp,'linear-gradient(90deg,#ff5f6d,#ffb37b)',`HP ${fmt(side.hp)} / ${fmt(side.maxHp)}`)}
      ${bar(side.mp,side.maxMp,'linear-gradient(90deg,#4f8cff,#8ce6ff)',`MP ${fmt(side.mp)} / ${fmt(side.maxMp)}`)}
      <div class="combat-status">${side.shield?`<span class="st shield">🛡 ${fmt(side.shield)}</span>`:''}${side.guard?'<span class="st">防御</span>':''}${statuses?`<span class="st bad">${e(statuses)}</span>`:''}${side.buffs.filter(x=>x.amount>0).map(x=>`<span class="st good">${e(({hp:'HP↑',atk:'攻↑',def:'防↑',mp:'MP↑',hit:'命中↑',dodge:'回避↑',crit:'会心↑'})[x.stat]||x.stat)}</span>`).join('')}</div>
    </div></div>`;
}
function battleScreen(app, s) {
  const b = app.battle;
  if (!b) return `${navBar(app,s)}<main class="page">${noChar()}</main>`;
  const tab = app.battleTab || 'skill';
  const actions = b.actionList(b.player);
  const items = b.usableItems();
  const locked = b.phase !== 'player';
  const speed = b.autoSpeed || 1;
  const ultimates = actions.filter(sk => sk.ultimate);
  const gauge = Math.min(ULTIMATE_GAUGE_MAX, Math.round(b.ultimateGauge || 0));
  const phaseLabel = b.phase==='player'?'あなたのターン':b.phase==='cpu'?'CPUのターン':b.phase==='end'?'決着':'処理中…';
  return `<div class="battle-screen" style="background-image:url('assets/battle_bg.jpg')">
    <div class="battle-shade"></div>
    <header class="battle-top">
      <div class="battle-turn"><span class="eyebrow">${b.mode==='dungeon'?`ダンジョン ${b.floor}階`:b.mode==='hidden'?'隠しボス戦':'CPU対戦'} / ${e(phaseLabel)}</span><h2>⚔ TURN ${b.turn}</h2></div>
      <div class="battle-top-right">
        <span class="pill ${b.phase==='player'?'on':''}">${e(phaseLabel)}</span>
        <span class="pill ${b.autoMode?'on':'off'} auto-state">AUTO <b>${b.autoMode?'ON':'OFF'}</b></span>
        <button class="btn ${b.autoMode?'btn-primary':'btn-glass'} btn-mini" data-action="battleAuto">${b.autoMode?'AUTO 停止':'AUTO'}</button>
        <div class="speed-switch" role="group" aria-label="AUTO 戦闘速度">
          ${[1,2,3].map(n=>`<button class="spd ${speed===n&&b.autoMode?'on':''}" data-action="battleSpeed" data-speed="${n}" ${b.autoMode?'':'disabled'}>${n}倍速</button>`).join('')}
        </div>
        <button class="btn btn-ghost btn-mini" data-action="battleSurrender">🏳 降参</button>
      </div>
    </header>
    <div class="battle-hud">
      <div class="gauge-box"><span>✵ 奥義ゲージ</span>${bar(gauge, ULTIMATE_GAUGE_MAX, 'linear-gradient(90deg,#ffd77a,#ff8fa8,#68f7d4)', `${gauge} / ${ULTIMATE_GAUGE_MAX}`)}</div>
      <div class="auto-opt"><label><input type="checkbox" data-setting="autoUltimate" data-target="settings" ${b.autoUltimate?'checked':''}> AUTOで奥義を使う</label><span class="muted small">${b.autoMode?`${speed}倍速で進行中`:'手動戦闘（通常速度）'}</span></div>
    </div>
    <div class="arena">
      <div class="arena-floor"></div>
      <div class="combat-row">${combatPanel(b,b.player,'player',activeChar(s))}<div class="vs-mark">VS</div>${combatPanel(b,b.enemy,'enemy',null)}</div>
      <div id="battleBanner" class="battle-banner"></div>
    </div>
    <div class="battle-lower">
      <div class="battle-vitals">
        <span><b>🧙 ${e(b.player.name)}</b> HP ${bar(b.player.hp,b.player.maxHp,'linear-gradient(90deg,#ff5f6d,#ffb37b)',`${fmt(b.player.hp)}/${fmt(b.player.maxHp)}`)} MP ${bar(b.player.mp,b.player.maxMp,'linear-gradient(90deg,#4f8cff,#8ce6ff)',`${fmt(b.player.mp)}/${fmt(b.player.maxMp)}`)}</span>
        <span><b>👹 ${e(b.enemy.name)}</b> HP ${bar(b.enemy.hp,b.enemy.maxHp,'linear-gradient(90deg,#ff5f6d,#ffb37b)',`${fmt(b.enemy.hp)}/${fmt(b.enemy.maxHp)}`)} MP ${bar(b.enemy.mp,b.enemy.maxMp,'linear-gradient(90deg,#4f8cff,#8ce6ff)',`${fmt(b.enemy.mp)}/${fmt(b.enemy.maxMp)}`)}</span>
      </div>
      <section class="battle-log panel"><h4>📜 バトルログ</h4><div id="logScroll" class="log-scroll">${b.logs.map(l=>`<div class="blog ${e(l.kind)}"><small>T${l.turn}</small> ${e(l.text)}</div>`).join('')}</div></section>
      <section class="battle-actions panel">
        <h4>コマンド <span class="muted small">${locked?'相手の行動中…':'行動を選択'} / ${b.autoMode?'AUTO':`手動`}</span></h4>
        ${ultimates.length?`<div class="ultimate-row"><span class="ur-label">✵ 奥義</span>${ultimates.map(sk=>{
          const ready = b.canUseUltimate(sk) && !locked;
          return `<button class="ultimate-btn ${ready?'ready':''}" data-action="battleAction" data-id="${e(sk.id)}" ${ready?'':'disabled'} style="--ec:${(ELEMENTS[sk.element]||ELEMENTS.none).color}">
            <b>${e(sk.name)}</b><small>威力 ${sk.power} / MP ${sk.mp} / ${ready?'発動可能':`ゲージ ${gauge}%・CD ${b.player.cds[sk.id]||0}`}</small></button>`;
        }).join('')}</div>`:''}
        <div class="filter-tabs small">${[['skill','技'],['item','アイテム'],['basic','基本']].map(([id,label])=>`<button class="ftab ${tab===id?'on':''}" data-action="battleTab" data-tab="${id}">${label}</button>`).join('')}</div>
        ${tab==='skill'?`<div class="action-grid">${actions.filter(sk=>!sk.ultimate).map(sk=>{
          const cd=b.player.cds[sk.id]||0;
          const usable=sk.usable!==false && !locked && b.player.mp>=(sk.mp||0) && cd===0 && b.canAct(b.player);
          return `<button class="action-btn" data-action="battleAction" data-id="${e(sk.id)}" ${usable?'':'disabled'} style="--ec:${(ELEMENTS[sk.element]||ELEMENTS.none).color}">
            <span class="ab-top">${elementTag(sk.element)}<small>${e(sk.cat)}</small></span><b>${e(sk.name)}</b>
            <small>威力 ${sk.power||'—'}${sk.parts?.[0]?.hits>1?` ×${sk.parts[0].hits}`:''} / MP ${sk.mp||0} / CD ${sk.cd||0}</small>
            ${cd?`<span class="cd">あと${cd}ターン</span>`:''}${sk.parts?.some(p=>p.op==='heal')?'<span class="ab-tag heal">回復</span>':''}${sk.cat==='覚醒限定技'?'<span class="ab-tag awake">覚醒</span>':''}
          </button>`;}).join('')}</div>`:''}
        ${tab==='item'?`<div class="item-actions">${items.map(it=>`<button class="action-btn item" data-action="battleAction" data-id="__item:${e(it.id)}" ${locked?'disabled':''}><span>${it.icon}</span><b>${e(it.name)} ×${it.n}</b><small>${e(it.desc)}</small></button>`).join('') || '<p class="muted">使えるアイテムがありません。道具屋で購入できます。</p>'}</div>`:''}
        ${tab==='basic'?`<div class="item-actions">
          <button class="action-btn item" data-action="battleAction" data-id="__attack" ${locked?'disabled':''}><span>⚔</span><b>通常攻撃</b><small>MP消費なし / 威力100</small></button>
          <button class="action-btn item" data-action="battleAction" data-id="__guard" ${locked?'disabled':''}><span>🛡</span><b>防御する</b><small>被ダメ軽減 / MP+14 / HP少回復</small></button>
          <button class="action-btn item" data-action="battleAuto"><span>AUTO</span><b>${b.autoMode?'AUTO を OFF':'AUTO を ON'}</b><small>戦闘中いつでも切替 / ターンは飛びません</small></button>
          <button class="action-btn item" data-action="battleSurrender"><span>🏳</span><b>降参する</b><small>敗北扱い。少量のポイントは獲得</small></button>
        </div><div class="hint-box">表示サイズは「見た目の変更」で戦闘開始前に設定し、戦闘中は固定です。技の装備は育成の間 → 技で変更できます。</div>`:''}
      </section>
    </div>
  </div>${toastArea(app)}`;
}

/* ============================ 戦闘結果 ============================ */
function resultScreen(app, s) {
  const r = app.result;
  if (!r) return townScreen(app,s);
  const rows = [
    ['🪙 コイン',`+${fmt(r.rewards.coins)}`],['✨ 経験値',`+${fmt(r.rewards.exp)}${r.rewards.levels?` / Lv.${r.rewards.levels}UP`:''}`],
    ['🔷 対戦ポイント',`+${fmt(r.rewards.bp)}`],['🏅 ランクP',`+${fmt(r.rewards.rp)}`],
    ['🔥 連勝',`${r.rewards.streak} 連勝${r.won&&r.rewards.streak>=3?'（ボーナス適用）':''}`],
    ['⚔ 与ダメージ',fmt(r.damage)],
  ];
  return `<div class="result-screen" style="background-image:linear-gradient(180deg,rgba(8,12,26,.8),rgba(8,12,26,.96)),url('assets/title_bg.jpg')">
    <div class="result-card ${r.won?'win':'lose'}">
      <div class="result-crest">${r.won?'🏆':'⚔'}</div>
      <h1>${r.won?'VICTORY':'DEFEAT'}</h1><h2>${r.won?'勝利！':'敗北…'}</h2>
      <p>${e(r.enemy.trueName||r.enemy.name)} との対戦を ${r.turns} ターンで終えた。</p>
      ${r.rewards?.levels ? `<div class="callout gold">📈 レベルアップ！ Lv.${r.rewards.levels} 上昇。<b>HP・攻撃力・防御力・MP</b> の 4 種類が上がり、ステータスポイントを獲得。HP/MP全回復。</div>` : ''}
      ${r.rewards?.materials?.length ? `<div class="reward-mats"><h4>🎁 入手素材</h4><div class="mat-chip-row">${r.rewards.materials.map(id=>matChip(id,1)).join('')}</div></div>` : ''}
      ${r.won&&r.enemy.boss?'<div class="callout gold">強敵の証を獲得！覚醒・特殊職の条件が進みました。</div>':''}
      ${r.won&&r.enemy.hidden?'<div class="callout violet">虚無の王を撃破！転生の証と専用称号を獲得。</div>':''}
      ${!r.won?'<div class="hint-box">敗北でも少額のコイン・EXP・BPを獲得できます。育成して再挑戦しましょう。</div>':''}
      <div class="reward-table">${rows.map(([k,v])=>`<div class="list-line"><span>${k}</span><b>${e(v)}</b></div>`).join('')}</div>
      <div class="row-btns">
        ${r.mode==='dungeon'&&r.won?`<button class="btn btn-primary btn-lg" data-action="resultNextFloor">次の階へ →</button>`:''}
        <button class="btn btn-glass btn-lg" data-action="resultRetry">🔁 再戦する</button>
        <button class="btn btn-glass btn-lg" data-action="nav" data-to="town">🏰 街へ戻る</button>
        <button class="btn btn-ghost btn-lg" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">対戦一覧</button>
      </div>
    </div></div>${toastArea(app)}`;
}

/* ============================ ルート ============================ */
export function renderScreen(app, s) {
  const html = (() => { switch (app.screen) {
    case 'title': return titleScreen(app,s);
    case 'create': return createScreen(app,s);
    case 'town': return townScreen(app,s);
    case 'story': return storyScreen(app,s);
    case 'gather': return gatherScreen(app,s);
    case 'help': return helpScreen(app,s);
    case 'hints': return hintsScreen(app,s);
    case 'facility': return facilityScreen(app,s);
    case 'character': return characterScreen(app,s);
    case 'appearance': return appearanceScreen(app,s);
    case 'codex': return codexScreen(app,s);
    case 'endgame': return endgameScreen(app,s);
    case 'settings': return settingsScreen(app,s);
    case 'battle': return battleScreen(app,s);
    case 'result': return resultScreen(app,s);
    default: return titleScreen(app,s);
  } })();
  return html + materialModal(app, s) + gachaRatesModal(app, s)
    + weaponDetailModal(app, s) + gachaPresentation(app, s) + jobChangeModal(app, s);
}
