/* 敵キャラクター画像の表示不具合・総合実動作テスト。
   実行: node tests/check_enemy_art.mjs

   ユーザー指定の最終テスト 1〜8 を、本物のアプリ (jsdom) で実際に
   「ダンジョンに入る → 遭遇 → 描画 → 攻撃 → 撃破 → 戦闘後」まで通して確認する。
   併せて台帳 180 ファイル / 36 種 / 67 体の ID 紐付け、全戦闘形式、
   複数敵・ボス・色違い、静止素材の扱い、失敗時のエラー表示と
   「代替画像で正常に見せかけない」ことも検証する。
*/
import fs from 'node:fs';
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const { w, document } = setup();
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
process.on('unhandledRejection', e => errors.push('rejection ' + (e?.stack || e)));

// 実ブラウザと同じ CSS カスケードを jsdom に読み込ませる。
// レイアウト検証に必要なブロックだけを挿入する（全 CSS だと jsdom の
// セレクタマッチャが :has()/複雑セレクタで警告を出すため）。
const cssText = fs.readFileSync(ROOT + '/css/style.css', 'utf8');
const pickRule = sel => {
  const i = cssText.indexOf(sel);
  assert(i >= 0, `CSS ルール ${sel} が存在`);
  return cssText.slice(i, cssText.indexOf('}', i) + 1);
};
const cssForLayout = ['.combat-row{', '.combatant{', '.combatant.p2{',
  '.combat-sprite{', '.enemy-art{', '.enemy-art .enemy-art-img{']
  .map(pickRule).join('\n');
const styleEl = document.createElement('style');
styleEl.textContent = cssForLayout;
document.head.appendChild(styleEl);

await import(fileURL('js/main.js') + '?enemyart=1');
await wait(200);
const O = w.__OCF;
const { app, S, D, EA, ASSETS } = O;
const U = await import(fileURL('js/ui.js'));
const { Battle } = await import(fileURL('js/battle.js'));
const A = await import(fileURL('js/enemyAssets.js'));
const { ENEMY_KIND, ENEMY_KINDS, ASSET_FILES, FILES_BY_ENEMY, DUNGEON_PLAN } = A;
assert(!!O && !!D && !!ASSETS, 'アプリが起動');
O.state.settings.sfx = false;
const q = s => document.querySelector(s);
const qa = s => [...document.querySelectorAll(s)];
const html = () => document.getElementById('app').innerHTML;

const st = O.state;
const c = S.createCharacter(st, {
  name:'検証用', jobId:'warrior', weaponType:'剣',
  original:'data:image/png;base64,AAAA',
});
const snap = { chars:clone(st.characters), coins:st.coins, items:clone(st.inventory.items),
  equipment:clone(st.inventory.equipment), version:st.version, story:clone(st.story),
  dungeon:clone(st.dungeon), catalog:clone(st.catalog) };

/* =========================================================
   1. 画像データ・保存場所・参照先・拡張子・ID 紐付け
   ========================================================= */
console.log('== 1. 全画像データの所在と参照先の整合 ==');
assert(ASSET_FILES.length === 180 && ENEMY_KINDS.length === 36,
  `台帳 180 ファイル / 36 敵（実際 ${ASSET_FILES.length}/${ENEMY_KINDS.length}）`);
const missing = [];
let pngChecked = 0;
for (const r of ASSET_FILES) {
  if (!fs.existsSync(r.src)) { missing.push(r.src + ' (missing)'); continue; }
  if (r.src.endsWith('.png')) {
    const fd = fs.openSync(r.src, 'r');
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') missing.push(r.src + ' (PNG署名)');
    else if (b.readUInt32BE(16) !== r.w || b.readUInt32BE(20) !== r.h)
      missing.push(r.src + ` (寸法 ${b.readUInt32BE(16)}x${b.readUInt32BE(20)} != ${r.w}x${r.h})`);
    else if (fs.statSync(r.src).size !== r.bytes) missing.push(r.src + ' (バイト数)');
    pngChecked++;
  } else if (r.src.endsWith('.zip')) {
    const fd = fs.openSync(r.src, 'r');
    const b = Buffer.alloc(2);
    fs.readSync(fd, b, 0, 2, 0);
    fs.closeSync(fd);
    if (b.toString() !== 'PK') missing.push(r.src + ' (ZIP署名)');
  } else missing.push(r.src + ' (想定外の拡張子)');
}
assert(!missing.length,
  `180 ファイルの所在・PNG署名・IHDR寸法・バイト数・拡張子が一致（PNG ${pngChecked} 枚 / 不一致 ${missing.length}: ${missing.slice(0,3)}）`);
assert(A.UNREADABLE_FILES.length === 0, '読み込み不可ファイル 0 件');
const pngDims = ASSET_FILES.filter(r => r.readable && r.src.endsWith('.png')).map(r => r.w);
assert(pngDims.length === 177 && Math.min(...pngDims) >= 512,
  `組み込み PNG 177 枚はすべて高解像度イラスト（最小幅 ${Math.min(...pngDims)}px / ドット絵 0 枚）`);

const badKind = [];
for (const k of ENEMY_KINDS) {
  for (const p of [k.art, k.bundled, ...(k.variants || [])]) {
    if (!p || !p.endsWith('.png') || !fs.existsSync(p)) badKind.push(`${k.id} -> ${p}`);
  }
  // バリエーションは必ず「その敵に割り当てられたファイル」だけ（別キャラの画像は混ぜない）
  // 代表 PNG は Drive 原本のバイトそのままのコピーなので、自敵のファイルとして扱う。
  const own = new Set([
    ...(FILES_BY_ENEMY[k.id] || []).filter(f => f.src.endsWith('.png')).map(f => f.src),
    k.art, k.bundled,
  ]);
  for (const p of k.variants || []) if (!own.has(p)) badKind.push(`${k.id} に別敵の画像 ${p}`);
  if (!k.variants?.length) badKind.push(`${k.id} variants 空`);
}
assert(!badKind.length,
  `36 種の art / bundled / variants は全て実在 PNG かつ自敵のファイルのみ（不整合 ${badKind.length}: ${badKind.slice(0,3)}）`);
const firstSrcs = ENEMY_KINDS.map(k => k.variants[0]);
assert(new Set(firstSrcs).size === 36, '36 種の既定画像はすべて別ファイル（種類ごとに見た目が違う）');
assert(new Set(ENEMY_KINDS.map(k => k.bundled)).size === 36, '代表 PNG 36 枚もすべて別ファイル');

// ゴブリン / 上位種 / 色違いがそれぞれ別画像であること
const goblins = ['goblin_club','goblin_sword','goblin_axe','goblin_bow','goblin_archer',
  'goblin_shaman','goblin_japan','goblin_king'];
assert(goblins.every(id => ENEMY_KIND[id]) && new Set(goblins.map(id => ENEMY_KIND[id].bundled)).size === 8,
  'ゴブリン 8 種（ゴブリンキング含む）はそれぞれ別の画像');
for (const id of goblins) {
  assert(new Set(ENEMY_KIND[id].variants).size === ENEMY_KIND[id].variants.length,
    `${id} の色違い ${ENEMY_KIND[id].variants.length} 枚は全て別ファイル`);
}
for (const id of ['greater_plain','greater_magic','greater_staff','greater_both','lich_m','lich_f']) {
  assert(ENEMY_KIND[id] && ENEMY_KIND[id].bundled !== ENEMY_KIND.goblin_king.bundled,
    `上位種 ${id} は専用画像`);
}
assert(new Set(['greater_plain','greater_magic','greater_staff','greater_both']
  .map(id => ENEMY_KIND[id].bundled)).size === 4, '上位種どうしも別画像');

// 敵データは「名前」ではなく固有 ID (artId) で台帳へ紐付く
assert(D.ENEMIES.length === 67, `敵データ 67 体（実際 ${D.ENEMIES.length}）`);
const badLink = D.ENEMIES.filter(en => !en.artId || !ENEMY_KIND[en.artId]);
assert(!badLink.length,
  `全 67 体が artId で ENEMY_KIND へ解決できる（未解決 ${badLink.length}: ${badLink.slice(0,3).map(x=>x.id)}）`);
assert(D.ENEMIES.every(en => !en.model3d && !en.animationClip),
  '3D モデル・アニメーションクリップの登録は 0 件（静止 PNG のみ）');
const valgas = D.ENEMIES.find(en => en.name.includes('ヴァルガス'));
assert(valgas && valgas.boss && ENEMY_KIND[valgas.artId],
  `スクリーンショットのボス「塔の主・ヴァルガス」も ID ${valgas?.artId} で台帳に紐付く`);
assert(DUNGEON_PLAN.length === 30 && DUNGEON_PLAN.every(f => ENEMY_KIND[f.enemyId]),
  `ダンジョン全 30 階の enemyId が台帳の固有 ID と一致（${DUNGEON_PLAN.length} 階）`);

/* =========================================================
   2. 根本原因: 敵側コンテナの幅 (CSS)
   ========================================================= */
console.log('== 2. 戦闘画面のレイアウト原因と修正 ==');
assert(/\.combat-sprite\{[^}]*width:100%/.test(cssText),
  '.combat-sprite に幅 100% を明示（p2 の align-items:flex-end で 0px に潰れない）');
assert(/\.combatant\.p2\{align-items:flex-end\}/.test(cssText),
  '敵パネルの右寄せ (align-items:flex-end) は維持');
const probe = document.createElement('div');
probe.className = 'combat-sprite';
document.body.appendChild(probe);
const cs = w.getComputedStyle(probe);
assert(cs.width === '100%' && cs.height === '210px',
  `CSS カスケード後の .combat-sprite は幅 100% / 高さ 210px（実際 ${cs.width} / ${cs.height}）`);
probe.remove();
assert(/\.enemy-art \.enemy-art-img\{[\s\S]*?object-fit:contain/.test(cssText)
  && /\.enemy-art \.enemy-art-img\{[\s\S]*?image-rendering:auto/.test(cssText),
  '縦横比は object-fit:contain、高解像度イラストは補間 (auto) で元のデザインを忠実に縮小');
assert(/\.enemy-art\[data-pixel-art="1"\] \.enemy-art-img\{image-rendering:pixelated/.test(cssText),
  '低解像度ドット絵が登録された場合だけ pixelated でピクセルを鮮明にする');
assert(fs.readFileSync(ROOT + '/js/enemyArt.js', 'utf8').includes('data-pixel-art='),
  '表示時に素材の解像度から pixelArt を判定している');
assert(/\.enemy-art\{[\s\S]*?overflow:hidden/.test(cssText),
  '画像は親コンテナ内に収まり、画面外へはみ出さない');
assert(!/scaleY\(/.test(cssText.match(/@keyframes art-[\s\S]{0,4000}/)?.[0] || ''),
  'モーションでも縦だけを引き伸ばす変形は無い');

/* =========================================================
   3. 全 67 体 × 全戦闘形式の描画（純粋レンダリング）
   ========================================================= */
console.log('== 3. 全 67 体 × 全戦闘形式で ID に対応する画像が出る ==');
// 実ゲームの戦闘形式は CPU / ダンジョン / ストーリー / 隠しボスの 4 つ。
// 「ボス戦」は形式ではなく「ボス敵が登場する戦闘」なので、67 体すべてを
// 全形式で描画することでボス・隠しボスも網羅する。
const modes = ['cpu','dungeon','story','hidden'];
let rendered = 0, badHtml = [];
for (const en of D.ENEMIES) {
  for (const mode of modes) {
    const b = new Battle({ state:st, char:c, enemy:en, mode,
      onChange:()=>{}, onFx:()=>{}, onEnd:()=>{} });
    Object.assign(app, { screen:'battle', battle:b });
    const h = U.renderScreen(app, st);
    const m = h.match(/<img class="enemy-art-img" src="([^"]*)" data-art-src="([^"]*)"[\s\S]*?loading="([^"]*)"/);
    const want = ENEMY_KIND[en.artId].variants[0];
    if (!m || m[1] !== want || m[2] !== want || m[3] !== 'eager')
      badHtml.push(`${en.id}/${mode} -> ${m ? m[1] : '(img なし)'}`);
    if (!h.includes(`data-enemy-art="${ENEMY_KIND[en.artId].id}"`))
      badHtml.push(`${en.id}/${mode} -> data-enemy-art 不一致`);
    if (!h.includes('data-pixel-art="0"'))
      badHtml.push(`${en.id}/${mode} -> 高解像度素材が pixelated 扱い`);
    rendered++;
  }
}
assert(!badHtml.length,
  `${rendered} 通りの戦闘描画すべてで固有 ID に対応する PNG / eager 読み込み（不整合 ${badHtml.length}: ${badHtml.slice(0,3)}）`);
assert(rendered === D.ENEMIES.length * modes.length, `${rendered} 通りを検証`);

/* =========================================================
   4. 実際のダンジョン→遭遇→表示（ユーザー 1〜4）
   ========================================================= */
console.log('== 4. 実際にダンジョンへ入り、遭遇した敵の画像を確認 ==');
await O.navigate('facility', { facility:'guild', tab:'1' });
assert(qa('.band-row').length === 5, 'ダンジョン画面（5 つの帯）を開く');
await O.handleAction('dungeonStart', { hard:'0' });
await wait(20);
assert(app.screen === 'battle' && app.battle?.mode === 'dungeon', 'ダンジョン戦闘が開始（敵と遭遇）');
const dImg = q('.combat-sprite .enemy-art-img');
assert(!!dImg, '戦闘画面に敵の <img> が実際に描画されている');
const dSrc = dImg.getAttribute('src');
assert(dSrc === ENEMY_KIND[app.battle.enemyDef.artId].variants[0],
  `敵の種類 ${app.battle.enemyDef.artId} と画像 ${dSrc} が一致`);
assert(dSrc.startsWith('assets/enemies/') && dSrc.endsWith('.png') && fs.existsSync(ROOT + '/' + dSrc),
  '参照先の PNG がディスク上に実在する');
assert(dImg.getAttribute('loading') === 'eager', '戦闘中は遅延読み込みを禁止');
assert(!dImg.closest('.combat-sprite').classList.contains('hidden') &&
  q('#arena-enemy')?.querySelector('.enemy-art'), '敵側コンテナ (#arena-enemy) に画像ホストがある');
assert(EA.enemyArtReport().hosts >= 1, 'syncEnemyArt() が戦闘ホストを配線済み');

/* =========================================================
   5. 複数敵・ボス・色違い・全形式の実画面
   ========================================================= */
console.log('== 5. 複数敵 / ボス / 色違い / 全戦闘形式 ==');
// 図鑑の台帳タブ: 同時に多数の敵画像が並ぶ
await O.navigate('codex', { codexTab:7 });
assert(qa('.asset-kind').length === 36, '素材タブに 36 種の敵');
assert(qa('.asset-file-img').length > 0, '複数ファイルのサムネが同時に並ぶ');
assert(qa('.asset-file-img').every(img => img.getAttribute('src')?.endsWith('.png')),
  '並んだサムネは全て PNG を参照');
assert(qa('.asset-preview .enemy-art-img').length === 1, '選択中の敵の代表画像も表示');
await O.handleAction('assetEnemy', { id:'goblin_king' });
assert(q('.asset-preview .enemy-art-img')?.getAttribute('src') === ENEMY_KIND.goblin_king.variants[0],
  'ゴブリンキングを選ぶと専用画像へ切り替わる');
await O.handleAction('enemyVariant', { variant:'2' });
assert(EA.enemyArtReport().entries.length >= 1, '色違い切替後も画像ホストが残る');
await O.navigate('codex', { codexTab:7 });
const vSrc = q('.asset-preview .enemy-art-img')?.getAttribute('src');
assert(vSrc === ENEMY_KIND.goblin_king.variants[2],
  `色違い 3 枚目は goblin_king 自身の別ファイル（${vSrc}）`);
assert(ENEMY_KIND.goblin_king.variants.every(p => p.includes('goblin_king') || (FILES_BY_ENEMY.goblin_king || []).some(f=>f.src===p)),
  '色違いに別のキャラクターの画像を流用しない');
await O.handleAction('enemyVariant', { variant:'0' });

// ボス戦（スクリーンショットのヴァルガス）を実画面で開始。
// 解放条件 (6 勝 / ランク1 以上) はテスト用 state だけで満たす。ゲームデータは不変。
st.stats.wins = 6;
st.rankPoints = D.RANKS[1].min;
await O.handleAction('battleStart', { enemy:valgas.id, mode:'cpu', floor:'0' });
await wait(20);
assert(app.screen === 'battle' && app.battle.enemyDef.boss, 'ボス戦が開始');
assert(q('.combat-sprite .enemy-art-img')?.getAttribute('src') === ENEMY_KIND[valgas.artId].variants[0],
  `ボス「${valgas.name}」に専用画像 ${ENEMY_KIND[valgas.artId].variants[0]} を表示`);
assert(q('.combat-sprite .enemy-art-img')?.getAttribute('src') !== ENEMY_KIND.goblin_club.variants[0],
  'ボスに雑魚の画像を流用しない');

// 残りの形式を実画面で確認（隠しボス戦 / CPU 戦）
for (const [en, mode] of [
  [D.ENEMIES.find(x=>x.hidden), 'hidden'],
  [D.ENEMIES.find(x=>!x.boss && !x.hidden), 'cpu'],
]) {
  await O.handleAction('battleStart', { enemy:en.id, mode, floor:'0' });
  await wait(15);
  assert(app.screen === 'battle' && !!q('.combat-sprite .enemy-art-img'),
    `${mode} 形式でも敵画像が表示される`);
  const actualId = app.battle.enemyDef.artId;
  assert(actualId === en.artId && q('.combat-sprite .enemy-art-img').getAttribute('src') === ENEMY_KIND[actualId].variants[0],
    `${mode} 形式でも敵 ID ${actualId} と画像が一致`);
}
// ストーリー戦の敵は章・ステージから動的に生成されるため、
// 実際の章導線 (storyOpen → storyNext → storyStage) から開始して確認する。
await O.handleAction('storyOpen', { id:'ch1' });
for (let i = 0; i < 3; i++) await O.handleAction('storyNext', { id:'ch1' });
await O.handleAction('storyStage', { id:'ch1', stage:'0' });
await wait(20);
assert(app.screen === 'battle' && app.battle.mode === 'story', 'ストーリー戦闘が開始');
const storyId = app.battle.enemyDef.artId;
assert(storyId && ENEMY_KIND[storyId], `ストーリー敵も固有 ID ${storyId} で台帳に紐付く`);
assert(q('.combat-sprite .enemy-art-img')?.getAttribute('src') === ENEMY_KIND[storyId].variants[0],
  'ストーリー戦闘でも敵の種類と画像が一致');

// 複数ホストが同時に存在しても、全件へ配線される
await O.navigate('codex', { codexTab:7 });
const before = qa('.enemy-art-img, .asset-file-img').length;
const bound = EA.syncEnemyArt();
assert(before > 1 && bound === before,
  `同時に ${before} 枚の敵画像があっても syncEnemyArt() が全件を配線`);
assert(qa('.enemy-art-img, .asset-file-img').every(img => img.dataset.artBound === '1'),
  '全画像に読み込み成否の監視が付く');

/* =========================================================
   6. アニメーション（静止素材を正直に扱う）
   ========================================================= */
console.log('== 6. モーションの維持と、静止素材の正直な扱い ==');
const rep = EA.enemyArtReport();
assert(rep.models3d === 0 && rep.animationClips === 0 && rep.unreadable === 0,
  '素材は静止 PNG のみ / 3D・アニメ・動画 0 件と正直に報告');
assert(rep.files === 180 && rep.enemyKinds === 36, 'レポートが台帳 180 件・36 種を反映');
assert(new Set(ENEMY_KINDS.map(k => k.move?.id)).size === 36,
  '専用技モーション ID は敵ごとに固有（他キャラの動きを流用しない）');
const motionKinds = new Set(ENEMY_KINDS.map(k => k.move?.motion));
assert(motionKinds.size >= 8 && [...motionKinds].every(m => typeof m === 'string' && m.length),
  `素材ごとのモーション種別 ${motionKinds.size} 種を保持`);
await O.handleAction('battleStart', { enemy:valgas.id, mode:'cpu', floor:'0' });
await wait(15);
for (const [kind, cls] of [['move','art-enter'], ['attack','art-attack'],
                           ['damage','art-hit'], ['guard','art-guard'], ['victory','art-death']]) {
  const n = EA.playEnemyArt(kind, ENEMY_KIND[valgas.artId].move);
  assert(n >= 1 && qa('.enemy-art.' + cls).length >= 1,
    `${kind} → .${cls} の待機/攻撃/被弾/防御/撃破モーションが全ホストへ付与`);
}
assert(q('.enemy-art')?.getAttribute('data-motion') === ENEMY_KIND[valgas.artId].move.motion,
  `この敵のモーション「${ENEMY_KIND[valgas.artId].move.motion}」が設定されている`);
for (const k of ['art-float','art-enter','art-attack','art-hit','art-death','art-guard'])
  assert(cssText.includes('.' + k) || cssText.includes(k), `CSS モーション ${k} が残っている`);

/* =========================================================
   7. 読み込み失敗時は代替画像ではなく原因を出す
   ========================================================= */
console.log('== 7. 読み込み失敗のエラー情報と「代用禁止」 ==');
const battleHtml = html();
assert(!battleHtml.includes('enemy-art-fallback') && !battleHtml.includes('class="sprite"'),
  '四角形・丸・✦・代替スプライトの <img> を一切出さない');
assert(!/P\.makeEnemySprite\(/.test(fs.readFileSync(ROOT + '/js/main.js', 'utf8')),
  'app 側で生成スプライトを作っていない');
assert(battleHtml.includes('enemy-art-error'), '失敗時に使うエラー表示要素を用意');

const captured = [];
console.error = (...a) => { captured.push(a.map(String).join(' ')); };
const img = q('.combat-sprite .enemy-art-img');
const host = img.closest('.enemy-art');
// 代替候補が無い 404 を再現（代表 PNG への再試行は後段で別に検証する）
img.dataset.artSrc = 'assets/enemies/this_file_does_not_exist.png';
img.dataset.fallback = '';
img.setAttribute('src', 'assets/enemies/this_file_does_not_exist.png');
img.dispatchEvent(new w.Event('error'));
assert(host.dataset.failed === '1', 'error イベントで失敗を記録');
const errBox = host.querySelector('.enemy-art-error');
assert(errBox && errBox.hidden === false && !errBox.hasAttribute('hidden'),
  'エラー表示が画面に出る（hidden が外れる）');
const detail = host.querySelector('.art-error-detail')?.textContent || '';
assert(detail.includes(valgas.artId) && detail.includes('this_file_does_not_exist.png') && detail.includes('理由'),
  `敵 ID / 参照先 / 理由が画面に明示される（${detail.slice(0,60).replace(/\n/g,' / ')}）`);
assert(captured.some(x => x.includes('敵画像の読み込み失敗')),
  'コンソールにも原因を出力');
assert(EA.enemyArtReport().errors.some(x => x.src.includes('this_file_does_not_exist.png')),
  'enemyArtReport() で後から原因を確認できる');
assert(!host.querySelector('.enemy-art-fallback') && !host.querySelector('img.sprite'),
  '失敗しても代替画像は一切挿入されない');
// src が空（ID 紐付け漏れ）も error イベントに頼らず検出する
await O.handleAction('battleStart', { enemy:valgas.id, mode:'cpu', floor:'0' });
await wait(15);
const img2 = q('.combat-sprite .enemy-art-img');
img2.setAttribute('src', '');
img2.dataset.artBound = '';
EA.syncEnemyArt();
assert(img2.closest('.enemy-art').dataset.failed === '1',
  '参照先が空のときも「敵 ID と台帳の紐付け漏れ」を即検出');
// 原本 → 同じ敵の代表 PNG への再試行は警告を残す
await O.handleAction('battleStart', { enemy:valgas.id, mode:'cpu', floor:'0' });
await wait(15);
const img3 = q('.combat-sprite .enemy-art-img');
const host3 = img3.closest('.enemy-art');
img3.dataset.fallback = ENEMY_KIND[valgas.artId].bundled;
img3.setAttribute('src', 'assets/enemies/source/does_not_exist.png');
img3.dispatchEvent(new w.Event('error'));
assert(host3.dataset.recovered === '1' && img3.getAttribute('src') === ENEMY_KIND[valgas.artId].bundled,
  '再試行は同じ敵の代表 PNG へ 1 回だけ');
assert(host3.dataset.failed !== '1', '代表 PNG が使える場合はエラー表示へ進まない');
assert(/\.enemy-art\[data-recovered="1"\]/.test(cssText),
  'ただし警告バッジを残し、正常に見せかけない');
console.error = origError;

/* =========================================================
   8. 戦闘処理と戦闘後の進行（ユーザー 7・8）
   ========================================================= */
console.log('== 8. 攻撃・ダメージ・撃破・戦闘後の進行 ==');
// 直前の状態を基準にする（章進行・解放条件などのテスト上の正しいゲーム進行は含めない）
const snap8 = { chars:clone(st.characters), coins:st.coins, items:clone(st.inventory.items),
  equipment:clone(st.inventory.equipment), version:st.version, story:clone(st.story),
  dungeon:clone(st.dungeon), catalog:clone(st.catalog) };
await O.handleAction('battleStart', { enemy:valgas.id, mode:'cpu', floor:'0' });
await wait(20);
const b = app.battle;
assert(!!b && app.screen === 'battle' && !!q('.combat-sprite .enemy-art-img'),
  '画像が出た状態で戦闘が始まっている');
const hpBefore = b.enemy.hp;
const basic = b.actionList(b.player).find(sk => sk.id === 'basic') || b.actionList(b.player)[0];
// 命中判定の乱数を固定して、まれな回避でテストが揺れないようにする（ゲーム側は無変更）
const origRandom = Math.random;
Math.random = () => 0.01;
try { await b.resolveAction(b.player, b.enemy, basic); }
finally { Math.random = origRandom; }
assert(b.enemy.hp < hpBefore, `攻撃が通り敵 HP が減る（${hpBefore} → ${b.enemy.hp}）`);
assert(b.logs.some(l => /ダメージ|与えた/.test(l.text)), 'ダメージがバトルログに残る');
assert(!!q('.combat-sprite .enemy-art-img'), '戦闘中も敵画像が消えない');
await b.finish(true);
await wait(40);
assert(app.screen === 'result' && app.result?.won === true, '撃破でリザルト画面へ進む');
assert(!!q('.result-enemy-art .enemy-art-img'), 'リザルト画面にも同じ敵の専用画像を表示');
await O.navigate('town');
assert(app.screen === 'town' && !!q('.town-page'), '戦闘終了後も街へ戻ってゲームが進行する');
// 既存データ保護
assert(st.characters.length === snap8.chars.length &&
  st.characters.every((x,i) => x.id === snap8.chars[i].id && x.name === snap8.chars[i].name &&
    eq(x.skills, snap8.chars[i].skills) && eq(x.equipment, snap8.chars[i].equipment)),
  '既存キャラ・技・装備は不変');
assert(st.version === snap8.version && eq(st.story, snap8.story) && eq(st.dungeon, snap8.dungeon),
  'セーブ VERSION / ストーリー / ダンジョン進行は不変');
assert(st.coins >= snap8.coins && Object.entries(snap8.items).every(([k,v]) =>
  (Number(st.inventory.items[k]) || 0) >= v), '通貨・所持品が初期化・減少していない');
assert(snap8.equipment.every(x => st.inventory.equipment.some(y => y.uid === x.uid)),
  '所持装備を 1 つも失わない');

assert(errors.length === 0,
  `意図的なエラー以外の console.error / unhandledRejection は 0 件（実際 ${errors.length}: ${errors.slice(0,2)}）`);
console.log('\nENEMY ART CHECK OK — 180 ファイル / 36 種 / 67 体の ID 紐付け、全形式の戦闘描画、幅 0px の根本修正、複数敵・ボス・色違い、静止素材のモーション維持、失敗時の原因表示と代用禁止、攻撃〜戦闘後進行・既存データ保護 すべて合格');
