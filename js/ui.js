/* ===========================================================
   画面レンダリング（HTML生成のみ・イベントは main.js）
   =========================================================== */
import {
  RARITIES, RARITY, RARITY_ORDER, STAT_KEYS, STAT_NAMES, STAT_ICONS, ELEMENTS,
  SKILLS, SKILL, JOBS, JOB, EQUIPMENT, EQUIP_BY_ID, ITEM, ITEMS, ENEMIES, ENEMY,
  RANKS, QUESTS, ACHIEVEMENTS, TITLES, TITLE, EXCHANGE, STYLES, FACILITIES, SLOTS,
  SLOT_NAME, AWAKENING_NAMES, MAX_LEVEL_BASE, collectedSkills,
} from './data.js';
import {
  fmt, clamp, activeChar, computeStats, powerScore, xpForLevel, jobXpForLevel, levelCap,
  instanceDef, instanceRarity, equipmentStats, findInstance, itemCount,
  jobUnlocked, jobReqText, questProgress, questClaimed, rankInfo,
  SHOP_STOCK, TRAINING, TRAINING_QUESTS, AWAKEN_STAGES, GACHA_COST, GACHA_COST_10,
  trainingCost, trainingQuestStatus, awakenStatus, canRebirth,
  hiddenBossUnlocked, hardDungeonUnlocked, enemyUnlocked, dungeonEnemy,
  buildEnemyCombatant, hasSaveFlag, AURAS, gachaRates, defaultPixelSettings,
} from './state.js';

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
export function spriteImg(src, cls='', aura='none') {
  if (!src) return `<div class="sprite-empty ${cls}">✦</div>`;
  const colors = { blue:'#4fd8ff', gold:'#ffd77a', violet:'#b98bff', rainbow:'#68f7d4', void:'#ff6fae' };
  const glow = colors[aura] ? `--aura:${colors[aura]}` : '';
  return `<img class="sprite ${cls}" src="${e(src)}" alt="キャラクター" style="${glow}">`;
}
function statTable(st, extra = '') {
  return `<div class="stat-grid">${STAT_KEYS.map(k => `
    <div class="stat-cell"><span>${STAT_ICONS[k]} ${STAT_NAMES[k]}</span><b>${fmt(st[k]||0)}</b>${extra ? '' : ''}</div>`).join('')}</div>`;
}

/* ============================ タイトル ============================ */
function titleScreen(app, s) {
  const has = hasSaveFlag() || s.characters.length > 0;
  return `
  <div class="title-screen" style="background-image:url('assets/title_bg.jpg')">
    <div class="title-veil"></div>
    <div class="title-inner">
      <div class="title-crest">✦ ORIGINAL CHARACTER FIGHTERS ✦</div>
      <h1 class="game-title">オリキャラ<br><span>ファイターズ</span></h1>
      <p class="title-lead">あなたの一枚が、最強の戦士になる。<br>画像から生まれるドット絵育成・対戦RPG</p>
      <div class="title-menu">
        <button class="btn btn-primary btn-lg" data-action="titleStart">⚔　ゲームスタート</button>
        <button class="btn btn-glass btn-lg" data-action="titleContinue">📂　つづきから${has ? `<small>セーブデータあり</small>` : `<small>データなし</small>`}</button>
        <button class="btn btn-glass btn-lg" data-action="titleCreate">🎨　キャラクター作成</button>
        <button class="btn btn-glass btn-lg" data-action="titleCodex">📖　図鑑</button>
        <button class="btn btn-glass btn-lg" data-action="titleSettings">⚙　設定</button>
      </div>
      <div class="title-foot">ver 1.0 ・ PC / スマートフォン対応 ・ セーブは自動で端末に保存されます</div>
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
    ${c ? `<div class="topbar-char" data-action="nav" data-to="character">${spriteImg(c.sprite,'tiny',c.aura)}<span>${e(c.name)}<small>Lv.${c.level}</small></span></div>` : ''}
  </header>`;
}

function toastArea(app) { return `<div class="toast" id="toast" role="status">${e(app.toast||'')}</div>`; }

/* ============================ キャラクター作成 ============================ */
function stepIndicator(step) {
  return `<div class="steps">${['① 画像の読み込み・調整','② ドット絵変換','③ プロフィール設定'].map((t,i)=>`<span class="${step===i+1?'on':''} ${step>i+1?'done':''}">${t}</span>`).join('')}</div>`;
}
function settingRow(label, key, min, max, stepv, value, hint, target='draft') {
  return `<label class="set-row"><span>${label}<small>${e(hint||'')}</small></span>
    <input type="range" data-setting="${key}" data-target="${target}" min="${min}" max="${max}" step="${stepv}" value="${value}">
    <output id="out_${target}_${key}">${typeof value==='number'? (stepv<1?value.toFixed(2):value) : value}</output></label>`;
}
function createScreen(app, s) {
  const d = app.draft;
  const st = d.settings;
  let body = '';
  if (d.step === 1) {
    body = `
    <div class="create-grid">
      <section class="panel">
        <h3>① 画像を選ぶ</h3>
        <div class="upload-zone" id="dropzone">
          <div class="upload-icon">🖼</div>
          <p>あなたの画像を読み込む</p>
          <small>写真・イラスト・アニメ画像・既存のオリキャラ画像<br>PNG / JPEG / WebP / GIF 対応</small>
          <div class="upload-buttons">
            <label class="btn btn-primary" for="fileUpload">📁 ファイルを選択</label>
            <input id="fileUpload" type="file" accept="image/*" data-file="create" hidden>
            <label class="btn btn-glass" for="cameraUpload">📷 カメラで撮影</label>
            <input id="cameraUpload" type="file" accept="image/*" capture="environment" data-file="create" hidden>
            <button class="btn btn-glass" data-action="createSample">✨ サンプル画像で試す</button>
          </div>
        </div>
        <div class="hint-box">スマートフォンでは「ファイルを選択」から端末内の写真を選べます。顔と体が見切れないよう、次の調整で拡大・位置合わせができます。</div>
      </section>
      <section class="panel">
        <h3>② 切り抜き・位置調整 <small class="muted">ドラッグで移動 / ホイールで拡大</small></h3>
        <div class="crop-wrap"><canvas id="cropCanvas"></canvas></div>
        ${settingRow('拡大縮小（キャラクターの大きさ）','scale',0.5,3,0.05,st.scale,'顔と全身が収まる倍率に')}
        ${settingRow('横位置','cropX',0,1,0.01,st.cropX,'左右の位置')}
        ${settingRow('縦位置','cropY',0,1,0.01,st.cropY,'上下の位置')}
        <label class="set-row"><span>描画範囲<small>全身 or 上半身</small></span>
          <select data-setting="body" data-target="draft"><option value="full" ${st.body==='full'?'selected':''}>全身</option><option value="upper" ${st.body==='upper'?'selected':''}>上半身（顔を重視）</option></select></label>
        <div class="row-btns">
          <button class="btn btn-ghost" data-action="createResetCrop">位置をリセット</button>
          <button class="btn btn-primary" data-action="createStep" data-step="2">ドット絵変換へ進む →</button>
        </div>
      </section>
    </div>`;
  } else if (d.step === 2) {
    body = `
    <div class="create-grid">
      <section class="panel">
        <h3>③ ドット絵変換の設定</h3>
        <p class="muted small">単なる縮小ではなく、エッジ保持平滑化・顔特徴の鮮鋭化・適応パレット・ディザ・陰影バンド化・輪郭の描き起こしでピクセルアートとして描き直します。</p>
        ${settingRow('ドットの細かさ','grid',20,72,2,st.grid,'小さいほど粗いドット')}
        ${settingRow('色数','colors',5,48,1,st.colors,'多いほど元の色を再現')}
        ${settingRow('キャラクターの大きさ','scale',0.5,3,0.05,st.scale,'切り抜き倍率')}
        ${settingRow('輪郭の強さ','outline',0,4,1,st.outline,'0で輪郭なし')}
        ${settingRow('ディザリング','dither',0,1,0.05,st.dither,'中間色の表現')}
        ${settingRow('彩度','saturation',0.7,1.6,0.02,st.saturation,'髪・服の色')}
        ${settingRow('コントラスト','contrast',0.8,1.4,0.02,st.contrast,'目・眉の明瞭さ')}
        <label class="set-row"><span>描画範囲<small>全身 / 上半身</small></span>
          <select data-setting="body" data-target="draft"><option value="full" ${st.body==='full'?'selected':''}>全身</option><option value="upper" ${st.body==='upper'?'selected':''}>上半身</option></select></label>
        <label class="check-row"><input type="checkbox" data-setting="transparent" data-target="draft" ${st.transparent?'checked':''}> <span>背景を透過する<small>画像の周囲の背景色を自動判定</small></span></label>
        <label class="check-row"><input type="checkbox" data-setting="faceBoost" data-target="draft" ${st.faceBoost?'checked':''}> <span>顔・髪型を強調する<small>肌色から顔領域を推定して特徴を保持</small></span></label>
        <div class="row-btns">
          <button class="btn btn-glass" data-action="createStep" data-step="1">← 画像調整に戻る</button>
          <button class="btn btn-primary" data-action="createGenerate">✦ 再生成する</button>
          <button class="btn btn-ghost" data-action="createCompare">⇄ ${app.compare ? '比較を閉じる' : '元画像と比較'}</button>
        </div>
      </section>
      <section class="panel">
        <h3>生成プレビュー <small class="muted" id="spriteMeta">${d.meta ? `${d.meta.width} × ${d.meta.height} ドット${d.meta.face?' / 顔領域を検出':''}` : '生成中…'}</small></h3>
        ${app.compare ? `<div class="compare-pair"><figure><img src="${e(d.original)}" alt="元画像"><figcaption>元画像</figcaption></figure><figure><div class="pixel-preview" id="draftPreview">${spriteImg(d.sprite,'big')}</div><figcaption>ドット絵</figcaption></figure></div>`
          : `<div class="pixel-preview big-preview" id="draftPreview">${spriteImg(d.sprite,'big')}</div>`}
        <div class="hint-box">気に入らなければ設定を変えて何度でも再生成できます。元画像の特徴（顔・髪型・服装・色・シルエット）を保持し、装飾は追加しません。</div>
        <button class="btn btn-primary btn-lg full" data-action="createStep" data-step="3" ${d.sprite?'':'disabled'}>このドット絵でキャラクターを作る →</button>
      </section>
    </div>`;
  } else {
    const basicJobs = JOBS.filter(j => j.tier === 1);
    const job = JOB[d.jobId] || JOB.warrior;
    const style = STYLES.find(x => x.id === d.styleId) || STYLES[0];
    body = `
    <div class="create-grid">
      <section class="panel">
        <h3>④ キャラクタープロフィール</h3>
        <label class="field"><span>キャラクター名</span><input type="text" maxlength="16" value="${e(d.name)}" data-draft="name" placeholder="例：アオイ"></label>
        <label class="field"><span>初期職業</span><select data-draft="jobId">${basicJobs.map(j=>`<option value="${j.id}" ${d.jobId===j.id?'selected':''}>${j.icon} ${j.name}</option>`).join('')}</select></label>
        <div class="desc-card"><b>${job.icon} ${job.name}</b><p>${e(job.desc)}</p><small>成長：HP ${job.growth.hp} / 攻 ${job.growth.atk} / 防 ${job.growth.def} / 魔 ${job.growth.mag}　使用武器：${job.weapons.join('・')}</small></div>
        <label class="field"><span>初期武器</span><select data-draft="weaponType">${job.weapons.map(w=>`<option value="${e(w)}" ${d.weaponType===w?'selected':''}>${e(w)}</option>`).join('')}</select></label>
        <label class="field"><span>戦闘スタイル</span><select data-draft="styleId">${STYLES.map(x=>`<option value="${x.id}" ${d.styleId===x.id?'selected':''}>${x.name} — ${e(x.desc)}</option>`).join('')}</select></label>
        <div class="desc-card"><b>✧ ${style.name}</b><p>${e(style.desc)}</p><small>初期ボーナス：${Object.entries(style.bonus).map(([k,v])=>`${STAT_NAMES[k]}+${v}`).join(' / ')}</small></div>
        <div class="hint-box">初期能力値・技・装備はここでの選択で決まります。育成・転職・覚醒はゲーム内でいつでも変更できます。</div>
        <div class="row-btns">
          <button class="btn btn-glass" data-action="createStep" data-step="2">← ドット絵に戻る</button>
          <button class="btn btn-primary btn-lg" data-action="createFinish">✦ キャラクターを作成</button>
        </div>
      </section>
      <section class="panel center-panel">
        <h3>完成プレビュー</h3>
        <div class="char-portrait ${d.frame||'gold'}">${spriteImg(d.sprite,'portrait')}<div class="portrait-name">${e(d.name||'名無し')}</div></div>
        <div class="preview-tags"><span class="rar-tag">Lv.1</span><span class="el-tag">${job.icon} ${e(job.name)}</span><span class="el-tag">${e(d.weaponType)}</span></div>
        <h4>初期技</h4>
        <div class="chip-row">${['sk_none_slash','sk_charge',...job.skills.slice(0,2)].filter((v,i,a)=>a.indexOf(v)===i).map(id=>`<span class="chip">${e(SKILL[id]?.name||id)}</span>`).join('')}</div>
        <h4>育成の流れ</h4>
        <ol class="flow"><li>街の5施設で育成・装備・修行</li><li>冒険者ギルドでCPUと対戦してコイン・BP獲得</li><li>ポイントで限定技や装備と交換</li><li>覚醒・転生でさらに高みへ</li></ol>
      </section>
    </div>`;
  }
  return `${navBar(app,s)}<main class="page create-page"><div class="page-head"><div><h2>🎨 キャラクター作成</h2><p>あなたの画像から、世界に一体だけのドット絵ファイターを生み出します</p></div><button class="btn btn-ghost" data-action="nav" data-to="${s.characters.length?'town':'title'}">${s.characters.length?'街へ戻る':'タイトルへ'}</button></div>${stepIndicator(d.step)}${body}</main>${toastArea(app)}`;
}

/* ============================ 街 ============================ */
function townScreen(app, s) {
  const c = activeChar(s);
  const st = c ? computeStats(c,s) : null;
  const r = rankInfo(s);
  return `${navBar(app,s)}
  <main class="page town-page" style="background-image:linear-gradient(180deg,rgba(9,13,28,.86),rgba(9,13,28,.96)),url('assets/title_bg.jpg')">
    <div class="town-hero">
      <div class="town-char">${c ? `<div class="char-portrait ${c.frame}">${spriteImg(c.sprite,'portrait',c.aura)}</div>` : ''}</div>
      <div class="town-info">
        <div class="eyebrow">✦ 冒険の拠点・クリスタルタウン</div>
        <h2>${c ? e(c.name) : 'キャラクター未作成'} <small>${c ? `Lv.${c.level} / ${JOB[c.jobId].name} / ${AWAKENING_NAMES[c.awakening]}` : ''}</small></h2>
        ${c ? `<div class="town-bars">${bar(c.hp,st.hp,'linear-gradient(90deg,#ff6b6b,#ff9e7a)',`HP ${fmt(c.hp)} / ${fmt(st.hp)}`)}${bar(c.mp,st.mp,'linear-gradient(90deg,#5b9dff,#8ce6ff)',`MP ${fmt(c.mp)} / ${fmt(st.mp)}`)}${bar(c.exp,xpForLevel(c.level),'linear-gradient(90deg,#ffd77a,#ffe9a8)',`EXP ${fmt(c.exp)} / ${fmt(xpForLevel(c.level))}`)}</div>` : '<p>まずはキャラクターを作成しましょう。</p>'}
        <div class="town-metrics">${c ? `<span>⚔ 戦闘力 <b>${fmt(powerScore(c,s))}</b></span><span>🏅 ${e(r.name)}</span><span>🔥 連勝 ${s.winStreak} / 最高 ${s.bestStreak}</span><span>📊 ${s.stats.wins}勝 ${s.stats.losses}敗</span>` : ''}</div>
      </div>
      <div class="town-quick">
        <button class="btn btn-primary" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">⚔ CPU対戦へ</button>
        <button class="btn btn-glass" data-action="nav" data-to="character">🧙 キャラクター</button>
        <button class="btn btn-glass" data-action="nav" data-to="codex">📖 図鑑</button>
        <button class="btn btn-glass" data-action="nav" data-to="endgame">🏆 やり込み</button>
        <button class="btn btn-glass" data-action="newChar">🎨 新規作成</button>
        <button class="btn btn-ghost" data-action="saveNow">💾 今すぐセーブ</button>
      </div>
    </div>
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

/* ---------- 育成の間 ---------- */
function nurtureTab(tab, app, s) {
  const c = activeChar(s);
  if (!c) return noChar();
  const st = computeStats(c,s), job = JOB[c.jobId];
  if (tab === 0) {
    return `<div class="two-col">
      <div class="panel soft">
        <div class="prof-head">${spriteImg(c.sprite,'medium',c.aura)}<div><h4>${e(c.name)} <small>Lv.${c.level} / ${e(job.name)}</small></h4>
          <p class="muted">${e(AWAKENING_NAMES[c.awakening])} ・ 転生${c.rebirth||0}回 ・ 戦闘力 ${fmt(powerScore(c,s))}</p></div></div>
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
        <div class="hint-box">HP+12 / MP+6 / 攻防速魔+3 / 命中回避+1 ずつ上昇。修行場でもポイントを得られます。</div>
      </div></div>`;
  }
  if (tab === 1) {
    const jobSum = Object.values(c.jobLevels).reduce((a,b)=>a+b,0);
    return `<div class="callout">現在の職業：<b>${job.icon} ${e(job.name)}</b> / 職業Lv.${c.jobLevels[c.jobId]||1} / 全職業熟練度合計 ${jobSum}。職業Lvを上げると技を習得し、上級職が解放されます。</div>
    <div class="job-grid">${JOBS.map(j=>{
      const ok = jobUnlocked(s,c,j), cur = c.jobId===j.id;
      return `<div class="job-card ${cur?'current':''} ${ok?'':'locked'}" style="--jc:${j.color}">
        <div class="job-top"><span class="job-icon">${j.icon}</span><div><b>${e(j.name)}</b><small>${['','基本職','上級職','特殊職'][j.tier]} / Lv.${c.jobLevels[j.id]||0}</small></div></div>
        <p>${e(j.desc)}</p>
        <div class="job-growth">${STAT_KEYS.slice(2,6).map(k=>`<span>${STAT_NAMES[k].slice(0,2)} <b>${j.growth[k]}</b></span>`).join('')}</div>
        <small class="muted">武器：${j.weapons.join('・')}<br>解放：${e(jobReqText(j))}</small>
        ${cur?`<span class="pill on">就業中</span>`:ok?`<button class="btn btn-mini" data-action="changeJob" data-job="${j.id}">転職（${fmt(j.tier*500)}コイン）</button>`:`<span class="pill off">未解放</span>`}
      </div>`;}).join('')}</div>
    <div class="panel soft"><h4>職業熟練度一覧</h4><div class="mastery-grid">${Object.entries(c.jobLevels).map(([id,lv])=>`<div><span>${e(JOB[id]?.name||id)}</span>${bar(lv,30,`#6cc8ff`,`Lv.${lv} / 30`)}</div>`).join('')}</div></div>`;
  }
  if (tab === 2) {
    const filter = app.skillFilter || 'all';
    const cats = ['all',...new Set(SKILLS.map(x=>x.cat))];
    const offset = app.skillOffset || 0;
    const unlearned = SKILLS.filter(x => !c.skills.some(y=>y.id===x.id) && (filter==='all'||x.cat===filter) && (x.cat!=='覚醒限定技'||c.awakening>=1));
    const shown = unlearned.slice(offset, offset+24);
    const books = Object.entries(s.inventory.items).filter(([id,n])=>n>0 && ITEM[id]?.kind==='book');
    return `<div class="two-col">
      <div class="panel soft"><h4>習得済みの技 <span class="pill">${c.skills.length} / ${SKILLS.length}</span></h4>
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
          ${Object.entries(stage.materials).map(([id,n])=>`<li class="${itemCount(s,id)>=n?'ok':''}">${e(ITEM[id].name)} ${itemCount(s,id)} / ${n}</li>`).join('')}
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
  const es = equipmentStats(inst);
  return `<div class="equip-line ${opts.sel?'sel':''}">
    <span class="eq-glow" style="--rc:${def.color}"></span>
    <div class="eq-main"><b style="color:${def.color}">${e(def.name)} <small>+${inst.enhance||0}</small></b>
      <small>${e(def.type)} / ${e(SLOT_NAME[def.slot])} / ${STAT_KEYS.filter(k=>es[k]).map(k=>`${STAT_NAMES[k]}+${es[k]}`).join(' ') || '—'}</small>
      ${(es.effects||[]).map(x=>`<small class="effect">✧ ${e(({crit:'会心強化',lifesteal:'吸血',mpRegen:'魔力循環',hpRegen:'自動回復',counter:'反撃',firstStrike:'先制',ignoreDef:'貫通',damageCut:'鉄壁',extraStrike:'追撃',statusGuard:'状態耐性',expBonus:'賢者の加護',coinBonus:'福運',bpBonus:'闘志'})[x.id]||x.id)} +${x.value}</small>`).join('')}
    </div>${rarityTag(def.rarity)}${opts.button||''}</div>`;
}
function forgeTab(tab, app, s) {
  const c = activeChar(s);
  if (!c) return noChar();
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
  if (tab === 1) {
    const last = app.lastPull || [];
    return `<div class="two-col">
      <div class="panel soft"><h4>ガチャ排出確率 <small class="muted">課金要素なし・ゲーム内コインのみ</small></h4>
        <div class="rates">${gachaRates('weapon',s.pity.weapon).map(r=>`<div class="rate-line" style="--rc:${r.color}"><span>${r.name}</span><b>${r.rate.toFixed(1)}%</b></div>`).join('')}</div>
        <div class="hint-box">天井：<b>60連</b>でレジェンダリー以上、<b>120連</b>でミシック以上が確定。高レアリティが出るとカウントはリセットされます。</div>
        ${['weapon','armor'].map(kind=>`<div class="gacha-box"><div><b>${kind==='weapon'?'⚔ 武器ガチャ':'🛡 装備ガチャ'}</b><small>天井まで ${(s.pity[kind].count>=120?0:s.pity[kind].count>=60?120:60)-s.pity[kind].count} 連 / 累計 ${s.pity[kind].total} 回</small>${bar(Math.min(s.pity[kind].count,120),120,'linear-gradient(90deg,#ffd77a,#ff8fa8)',`${s.pity[kind].count} / 120`)}</div>
          <div class="row-btns"><button class="btn btn-primary" data-action="gacha" data-kind="${kind}" data-n="1" ${s.coins<GACHA_COST?'disabled':''}>1連 ${fmt(GACHA_COST)}</button><button class="btn btn-glass" data-action="gacha" data-kind="${kind}" data-n="10" ${s.coins<GACHA_COST_10?'disabled':''}>10連 ${fmt(GACHA_COST_10)}</button></div></div>`).join('')}
        <div class="muted small">現在のコイン：🪙 ${fmt(s.coins)} / 累計ガチャ ${s.stats.pulls} 回</div>
      </div>
      <div class="panel soft"><h4>排出結果</h4>${last.length?`<div class="pull-results">${last.map(inst=>{const d=instanceDef(inst);return `<div class="pull-item" style="--rc:${d.color}"><span>${e(d.name)}</span>${rarityTag(d.rarity)}<small>${e(d.type)} / ${e(SLOT_NAME[d.slot])}</small></div>`;}).join('')}</div>`:'<p class="muted">まだ引いていません。左のボタンからガチャを引けます。</p>'}
        <h4 class="mt">レアリティ特殊効果</h4><div class="hint-box">エピック以上には会心・吸血・反撃・貫通・獲得ボーナスなどの特殊効果が付きます。ミシック以上は2つの効果と専用の輝きを持ち、シークレットは最上位の倍率です。</div>
      </div></div>`;
  }
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
      <small class="muted">消費 ${fmt(q.cost)}コイン ／ 報酬：${Object.entries(q.reward).map(([k,v])=>k==='items'?Object.entries(v).map(([id,n])=>`${ITEM[id].name}×${n}`).join('・'):k==='exp'?`EXP${v}`:k==='bp'?`BP${v}`:`${fmt(v)}コイン`).join(' / ')}</small>
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
      <div class="enemy-metrics"><span>❤ ${fmt(st.hp)}</span><span>⚔ ${fmt(st.atk)}</span><span>🛡 ${fmt(st.def)}</span></div>
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
        <div class="quest-list">${QUESTS.map(q=>{const p=Math.min(q.need,questProgress(s,q)), done=questClaimed(s,q);return `<div class="quest-line ${done?'done':''}"><div><b>${e(q.name)} ${q.daily?'<span class="pill">DAILY</span>':''}</b><small>${e(q.desc)}</small><div class="reward-mini">報酬：${Object.entries(q.reward).map(([k,v])=>k==='items'?Object.entries(v).map(([id,n])=>`${ITEM[id].name}×${n}`).join('・'):k==='exp'?`EXP${v}`:k==='bp'?`BP${v}`:`${fmt(v)}コイン`).join(' / ')}</div></div>${bar(p,q.need,'linear-gradient(90deg,#ffd77a,#8ce6a8)',`${fmt(p)} / ${fmt(q.need)}`)}${done?'<span class="pill on">受取済</span>':p>=q.need?`<button class="btn btn-primary" data-action="claimQuest" data-id="${q.id}">受け取る</button>`:'<span class="pill off">進行中</span>'}</div>`;}).join('')}</div>
      </div>
      <div class="panel soft"><h4>実績 <span class="pill">${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length}</span></h4>
        <div class="ach-list">${ACHIEVEMENTS.map(a=>`<div class="ach-line ${s.achievements[a.id]?'done':''}"><b>${s.achievements[a.id]?'🏆':'🔒'} ${e(a.name)}</b><small>${e(a.desc)} ／ 報酬：${e(a.title)} + ${Object.entries(a.reward).map(([k,v])=>k==='items'?Object.entries(v).map(([id,n])=>`${ITEM[id].name}×${n}`).join('・'):`${fmt(v)}${k==='coins'?'コイン':'BP'}`).join(' / ')}</small></div>`).join('')}</div>
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
      <div class="shop-grid">${SHOP_STOCK.map(id=>{const it=ITEM[id];return `<div class="shop-card"><div class="shop-icon">${it.icon}</div><div><b>${e(it.name)}</b><p>${e(it.desc)}</p><small>所持 ${itemCount(s,id)} / 🪙 ${fmt(it.price)}</small></div><div class="row-btns tiny"><button class="btn btn-mini" data-action="buy" data-id="${id}" data-n="1" ${s.coins<it.price?'disabled':''}>買う</button><button class="btn btn-mini ghost" data-action="buy" data-id="${id}" data-n="5" ${s.coins<it.price*5?'disabled':''}>×5</button></div></div>`;}).join('')}</div>`;
  }
  if (tab === 1) {
    return `<div class="two-col">
      <div class="panel soft"><h4>アイテムを売却</h4>${Object.entries(s.inventory.items).filter(([id,n])=>n>0).map(([id,n])=>`<div class="sell-line"><span>${ITEM[id]?.icon||'📦'} ${e(ITEM[id]?.name||id)} <small>×${n}</small></span><small>売値 ${fmt(ITEM[id]?.sell||30)} / 個</small><div class="row-btns tiny"><button class="btn btn-mini" data-action="sell" data-id="${id}" data-n="1">1個</button><button class="btn btn-mini ghost" data-action="sell" data-id="${id}" data-n="999">全部</button></div></div>`).join('') || '<p class="muted">売却できるアイテムがありません</p>'}</div>
      <div class="panel soft"><h4>装備を売却</h4><p class="muted small">装備中のものを売ると自動で外れます。不要なノーマル・レアを整理しましょう。</p>${s.inventory.equipment.slice(0,80).map(inst=>equipRow(inst,s,{button:`<button class="btn btn-mini ghost" data-action="sellEquip" data-uid="${inst.uid}">売却</button>`})).join('') || '<p class="muted">装備がありません</p>'}</div></div>`;
  }
  return `<div class="callout violet">覚醒・進化・強化・合成の素材です。ダンジョンや修行クエストでも入手できます。</div>
    <div class="shop-grid">${ITEMS.filter(i=>i.kind==='material'||i.kind==='book').map(it=>`<div class="shop-card"><div class="shop-icon">${it.icon}</div><div><b>${e(it.name)}</b><p>${e(it.desc)}</p><small>所持 ${itemCount(s,it.id)} ${it.price?`/ 🪙 ${fmt(it.price)}`:'/ 交換所・報酬限定'}</small></div><div class="row-btns tiny">${it.price?`<button class="btn btn-mini" data-action="buy" data-id="${it.id}" data-n="1" ${s.coins<it.price?'disabled':''}>買う</button>`:''}<button class="btn btn-mini ghost" data-action="sell" data-id="${it.id}" data-n="1" ${itemCount(s,it.id)<1?'disabled':''}>売る</button></div></div>`).join('')}</div>`;
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
        <div class="char-portrait large ${c.frame}">${spriteImg(c.sprite,'portrait',c.aura)}<div class="portrait-name">${e(c.name)}</div></div>
        <div class="char-badges">${rarityTag(c.awakening>=4?'S':c.awakening>=2?'E':'N')}<span class="pill">Lv.${c.level}</span><span class="pill">${e(AWAKENING_NAMES[c.awakening])}</span></div>
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
        <div class="panel soft"><h4>キャラクター切替 <span class="pill">${s.characters.length} 人</span></h4>${s.characters.map(ch=>`<div class="switch-line">${spriteImg(ch.sprite,'tiny',ch.aura)}<div><b>${e(ch.name)}</b><small>Lv.${ch.level} / ${e(JOB[ch.jobId].name)}</small></div>${ch.id===s.activeId?'<span class="pill on">選択中</span>':`<button class="btn btn-mini" data-action="switchChar" data-id="${ch.id}">選択</button>`}${s.characters.length>1?`<button class="btn btn-mini ghost" data-action="deleteChar" data-id="${ch.id}">削除</button>`:''}</div>`).join('')}</div>
      </div>
    </div></main>${toastArea(app)}`;
}

function appearanceScreen(app, s) {
  const c = s.characters.find(x=>x.id===app.look?.charId) || activeChar(s);
  if (!c) return `${navBar(app,s)}<main class="page">${noChar()}</main>`;
  const L = app.look || (app.look = {charId:c.id, settings:{...c.spriteSettings}, sprite:c.sprite, original:c.original, image:null});
  const st = L.settings;
  return `${navBar(app,s)}<main class="page create-page">
    <div class="page-head"><div><h2>🎨 見た目の変更</h2><p>保存済みの元画像から、いつでもドット絵を再生成できます。元画像の再読み込みは不要です。</p></div><button class="btn btn-ghost" data-action="nav" data-to="character">← キャラクターへ</button></div>
    <div class="create-grid">
      <section class="panel"><h3>再生成の設定</h3>
        <label class="btn btn-glass full" for="replaceUpload">📁 元画像を差し替える</label><input id="replaceUpload" type="file" accept="image/*" data-file="appearance" hidden>
        <div class="crop-wrap small"><canvas id="lookCropCanvas"></canvas></div>
        ${settingRow('ドットの細かさ','grid',20,72,2,st.grid,'','look')}
        ${settingRow('色数','colors',5,48,1,st.colors,'','look')}
        ${settingRow('拡大縮小','scale',0.5,3,0.05,st.scale,'','look')}
        ${settingRow('輪郭の強さ','outline',0,4,1,st.outline,'','look')}
        ${settingRow('ディザ','dither',0,1,0.05,st.dither,'','look')}
        ${settingRow('彩度','saturation',0.7,1.6,0.02,st.saturation,'','look')}
        <label class="set-row"><span>描画範囲</span><select data-setting="body" data-target="look"><option value="full" ${st.body==='full'?'selected':''}>全身</option><option value="upper" ${st.body==='upper'?'selected':''}>上半身</option></select></label>
        <label class="check-row"><input type="checkbox" data-setting="transparent" data-target="look" ${st.transparent?'checked':''}><span>背景を透過</span></label>
        <label class="check-row"><input type="checkbox" data-setting="faceBoost" data-target="look" ${st.faceBoost?'checked':''}><span>顔・髪型を強調</span></label>
        <div class="row-btns"><button class="btn btn-primary" data-action="lookGenerate">✦ 再生成</button><button class="btn btn-glass" data-action="saveLook">💾 この見た目を保存</button></div>
      </section>
      <section class="panel"><h3>プレビュー</h3>
        <div class="compare-pair"><figure><img src="${e(L.original)}" alt="元画像"><figcaption>保存済みの元画像</figcaption></figure><figure><div class="pixel-preview" id="lookPreview">${spriteImg(L.sprite,'big')}</div><figcaption>新しいドット絵</figcaption></figure></div>
        <h4 class="mt">オーラ（戦闘演出）</h4><div class="chip-row">${AURAS.map(a=>`<button class="btn btn-mini ${c.aura===a.id?'on':''}" data-action="buyAura" data-id="${a.id}" style="--rc:${a.color}">${a.id==='none'?'なし':e(a.name)}${a.cost?` 🪙${fmt(a.cost)}`:''}</button>`).join('')}</div>
        <p class="muted small">オーラは一度購入すれば全キャラクターで使えます。解放条件：ランク・勝利数・覚醒段階など。</p>
        <div class="hint-box">「この見た目を保存」でドット絵・設定・元画像がセーブされます。戦闘・育成画面にすぐ反映されます。</div>
      </section></div></main>${toastArea(app)}`;
}

/* ============================ 図鑑 ============================ */
function codexScreen(app, s) {
  const tab = app.codexTab || 0;
  const tabs = ['職業','技','装備','CPU','実績','称号'];
  const collected = collectedSkills(s);
  let body = '';
  if (tab === 0) body = `<div class="callout">収集：${s.catalog.jobs.length} / ${JOBS.length} 職業。転職すると図鑑に記録されます。</div><div class="codex-grid">${JOBS.map(j=>`<div class="codex-card ${s.catalog.jobs.includes(j.id)?'':'unknown'}" style="--jc:${j.color}"><span>${j.icon}</span><b>${s.catalog.jobs.includes(j.id)?e(j.name):'？？？'}</b><small>${['','基本職','上級職','特殊職'][j.tier]} / ${e(jobReqText(j))}</small></div>`).join('')}</div>`;
  if (tab === 1) body = `<div class="callout">全技収集：${collected.length} / ${SKILLS.length} 種 ${collected.length>=SKILLS.length?'🌟 コンプリート！':''}</div><div class="codex-skills">${SKILLS.map(sk=>`<div class="codex-skill ${collected.includes(sk.id)?'':'unknown'}">${elementTag(sk.element)}<b>${collected.includes(sk.id)?e(sk.name):'？？？'}</b><small>${collected.includes(sk.id)?`${e(sk.cat)} / 威力${sk.power||'—'} / MP${sk.mp}`:'未習得'}</small></div>`).join('')}</div>`;
  if (tab === 2) body = `<div class="callout">装備図鑑：${s.catalog.equipment.length} / ${EQUIPMENT.length} 種。ガチャ・交換・合成で入手すると記録されます。</div><div class="codex-skills">${EQUIPMENT.map(d=>`<div class="codex-skill ${s.catalog.equipment.includes(d.id)?'':'unknown'}" style="--rc:${d.color}"><b style="color:${s.catalog.equipment.includes(d.id)?d.color:'#667'}">${s.catalog.equipment.includes(d.id)?e(d.name):'？？？'}</b><small>${s.catalog.equipment.includes(d.id)?`${e(d.type)} / ${e(SLOT_NAME[d.slot])}`:'未発見'} ${rarityTag(d.rarity)}</small></div>`).join('')}</div>`;
  if (tab === 3) body = `<div class="callout">撃破・対戦したCPU：${s.catalog.enemies.length} / ${ENEMIES.length + 20} 記録（ダンジョンの敵も含む）</div><div class="enemy-grid">${ENEMIES.map(en=>`<div class="codex-card ${s.catalog.enemies.includes(en.id)?'':'unknown'}"><span>${en.boss?'☄':en.tier>=1?'⚔':'✦'}</span><b>${s.catalog.enemies.includes(en.id)?e(en.trueName||en.name):'？？？'}</b><small>${s.catalog.enemies.includes(en.id)?`${e(JOB[en.job]?.name||'')} / Lv.${en.level}`:'未対戦'}</small></div>`).join('')}</div>`;
  if (tab === 4) body = `<div class="callout">実績：${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length} 達成</div><div class="codex-grid">${ACHIEVEMENTS.map(a=>`<div class="codex-card ${s.achievements[a.id]?'':'unknown'}"><span>${s.achievements[a.id]?'🏆':'🔒'}</span><b>${e(a.name)}</b><small>${e(a.desc)} / 称号「${e(a.title)}」</small></div>`).join('')}</div>`;
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
    { icon:'📖', name:'武器・装備・技・職業図鑑', cond:`装備${EQUIPMENT.length}種 / 技${SKILLS.length}種 / 職業${JOBS.length}種を記録`, reward:'称号「鑑定士」「技博覧」ほか', status:`装備${s.catalog.equipment.length} / 技${collected.length} / 職${s.catalog.jobs.length}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="codex">図鑑へ</button>' },
    { icon:'🏅', name:'CPU対戦ランク', cond:'ランクP 6,500で神階到達', reward:'各ランク到達でコイン最大30,000', status:`${e(r.name)} / RP ${fmt(s.rankPoints)}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">対戦へ</button>' },
    { icon:'🔥', name:'連勝記録', cond:'10連勝 / 不敗の証', reward:'コイン5,000 / BP180 / 称号「不敗王」', status:`最高 ${s.bestStreak} 連勝 / 現在 ${s.winStreak}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="0">連勝へ</button>' },
    { icon:'🏆', name:'実績・称号', cond:`${ACHIEVEMENTS.length}個の実績条件を達成`, reward:`${TITLES.length-1}種の称号と通貨・素材`, status:`${Object.keys(s.achievements).length} / ${ACHIEVEMENTS.length} 実績 / ${s.titles.length-1} 称号`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="guild" data-tab="2">実績へ</button>' },
    { icon:'☄', name:'隠しボス', cond:'覚醒III / ボス3体 / ダンジョン10階', reward:'転生の証 / BP600 / 称号「虚無の征服者」', status: hiddenBossUnlocked(s,c)?`解放済 / 撃破${s.stats.hiddenKills}回`:'未解放', btn: hiddenBossUnlocked(s,c)?'<button class="btn btn-primary" data-action="hiddenBoss">挑戦</button>':'<span class="pill off">未解放</span>' },
    { icon:'🌑', name:'高難易度ダンジョン', cond:'ダンジョン15階踏破', reward:'報酬1.6倍 / 星砂 / 称号「迷宮の主」', status: hardDungeonUnlocked(s)?'解放済':'未解放', btn: hardDungeonUnlocked(s)?'<button class="btn btn-glass" data-action="dungeonStart" data-hard="1">深淵へ</button>':'<span class="pill off">未解放</span>' },
    { icon:'⚒', name:'レア装備の合成', cond:'同レアリティ装備3つ + 合成触媒', reward:'1段階上のレアリティ / シークレット+3強化', status:`累計 ${s.stats.syntheses} 回`, btn:'<button class="btn btn-glass" data-action="nav" data-to="facility" data-facility="forge" data-tab="3">合成へ</button>' },
    { icon:'🎨', name:'キャラクターの見た目変更', cond:'元画像が保存されていればいつでも可能', reward:'ドット絵の再生成 / オーラ / フレーム', status:`${c.sprite?'保存済':'未保存'} / オーラ ${e(AURAS.find(a=>a.id===c.aura)?.name||'なし')}`, btn:'<button class="btn btn-glass" data-action="nav" data-to="appearance">変更へ</button>' },
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
        <div class="hint-box">「書き出す」でセーブデータ（元画像・ドット絵・育成状況をすべて含むJSON）をダウンロードできます。別の端末で「読み込む」を選べば続きから遊べます。</div>
        <label class="btn btn-glass full" for="importFile">📥 セーブデータを読み込む</label><input id="importFile" type="file" accept="application/json,.json" data-file="import" hidden>
        <button class="btn btn-ghost full mt" data-action="resetGame">🗑 データを初期化</button>
        ${app.confirmReset?`<div class="danger-box"><b>本当に初期化しますか？</b><p>全キャラクター・画像・進行状況が消えます。元に戻せません。</p><div class="row-btns"><button class="btn btn-danger" data-action="resetGameConfirm">初期化を確定</button><button class="btn btn-ghost" data-action="resetCancel">キャンセル</button></div></div>`:''}
        <h4 class="mt">あそび方</h4><ol class="flow"><li>タイトル「ゲームスタート」→ 画像を読み込みドット絵を作成</li><li>街の5施設でレベル・職業・技・装備・覚醒を育成</li><li>冒険者ギルドのCPU対戦でコイン・EXP・BP・ランクPを獲得</li><li>対戦ポイントで限定技・特別装備・覚醒素材と交換</li><li>ダンジョン・隠しボス・転生で長期的な目標に挑戦</li></ol>
        <div class="hint-box">CPU対戦はローカル完結。友達とのオンライン対戦を後から追加できるよう、対戦エンジンはプレイヤー/CPUを独立したデータ構造で分離しています。</div>
      </div>
    </div></main>${toastArea(app)}`;
}

/* ============================ 戦闘 ============================ */
function combatPanel(b, side, label) {
  const isP = side === b.player;
  const statuses = b.statusLabel(side);
  return `<div class="combatant ${isP?'p1':'p2'}" id="${isP?'arena-player':'arena-enemy'}">
    <div class="combat-sprite ${isP?'':'mirrored'}">${spriteImg(side.sprite,'battle',side.aura)}</div>
    <div class="combat-info"><div class="combat-name">${e(side.name)} <small>Lv.${side.level} ${e(JOB[side.job]?.name||'')}</small></div>
      ${bar(side.hp,side.maxHp,'linear-gradient(90deg,#ff5f6d,#ffb37b)',`HP ${fmt(side.hp)} / ${fmt(side.maxHp)}`)}
      ${bar(side.mp,side.maxMp,'linear-gradient(90deg,#4f8cff,#8ce6ff)',`MP ${fmt(side.mp)} / ${fmt(side.maxMp)}`)}
      <div class="combat-status">${side.shield?`<span class="st shield">🛡 ${fmt(side.shield)}</span>`:''}${side.guard?'<span class="st">防御</span>':''}${statuses?`<span class="st bad">${e(statuses)}</span>`:''}${side.buffs.filter(x=>x.amount>0).map(x=>`<span class="st good">${e(({atk:'攻↑',def:'防↑',spd:'速↑',mag:'魔↑',acc:'命中↑',eva:'回避↑'})[x.stat]||x.stat)}</span>`).join('')}</div>
    </div></div>`;
}
function battleScreen(app, s) {
  const b = app.battle;
  if (!b) return `${navBar(app,s)}<main class="page">${noChar()}</main>`;
  const tab = app.battleTab || 'skill';
  const actions = b.actionList(b.player);
  const items = b.usableItems();
  const locked = b.phase !== 'player';
  return `<div class="battle-screen" style="background-image:url('assets/battle_bg.jpg')">
    <div class="battle-shade"></div>
    <header class="battle-top"><div><span class="eyebrow">${b.mode==='dungeon'?`ダンジョン ${b.floor}階`:b.mode==='hidden'?'隠しボス戦':'CPU対戦'}</span><h2>⚔ TURN ${b.turn}</h2></div>
      <div class="battle-top-right"><span class="pill ${b.phase==='player'?'on':''}">${b.phase==='player'?'あなたのターン':b.phase==='cpu'?'CPUのターン':b.phase==='end'?'決着':'処理中…'}</span>
      <button class="btn btn-ghost" data-action="battleAuto">${b.autoMode?'⏹ おまかせ停止':'🤖 おまかせ'}</button><button class="btn btn-ghost" data-action="battleSurrender">🏳 降参</button></div></header>
    <div class="arena">
      <div class="arena-floor"></div>
      <div class="combat-row">${combatPanel(b,b.player,'player')}<div class="vs-mark">VS</div>${combatPanel(b,b.enemy,'enemy')}</div>
      <div id="battleBanner" class="battle-banner"></div>
    </div>
    <div class="battle-lower">
      <section class="battle-log panel"><h4>📜 バトルログ</h4><div id="logScroll" class="log-scroll">${b.logs.map(l=>`<div class="blog ${e(l.kind)}">${e(l.text)}</div>`).join('')}</div></section>
      <section class="battle-actions panel"><h4>コマンド <span class="muted small">${locked?'相手の行動中…':'行動を選択'}</span></h4>
        <div class="filter-tabs small">${[['skill','技'],['item','アイテム'],['basic','基本']].map(([id,label])=>`<button class="ftab ${tab===id?'on':''}" data-action="battleTab" data-tab="${id}">${label}</button>`).join('')}</div>
        ${tab==='skill'?`<div class="action-grid">${actions.map(sk=>{
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
          <button class="action-btn item" data-action="battleAuto" ${locked&&!b.autoMode?'disabled':''}><span>🤖</span><b>おまかせ戦闘</b><small>${b.autoMode?'停止する':'自動で技を選んで戦う'}</small></button>
          <button class="action-btn item" data-action="battleSurrender"><span>🏳</span><b>降参する</b><small>敗北扱い。少量のポイントは獲得</small></button>
        </div><div class="hint-box">技の装備は「育成の間 → 技」で最大8つまで変更できます。属性が相手に有利だとダメージ1.3倍。</div>`:''}
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
  switch (app.screen) {
    case 'title': return titleScreen(app,s);
    case 'create': return createScreen(app,s);
    case 'town': return townScreen(app,s);
    case 'facility': return facilityScreen(app,s);
    case 'character': return characterScreen(app,s);
    case 'appearance': return appearanceScreen(app,s);
    case 'codex': return codexScreen(app,s);
    case 'endgame': return endgameScreen(app,s);
    case 'settings': return settingsScreen(app,s);
    case 'battle': return battleScreen(app,s);
    case 'result': return resultScreen(app,s);
    default: return titleScreen(app,s);
  }
}
