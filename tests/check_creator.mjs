/* 製作者専用ツールの実動作検証（jsdom 上で本物のアプリを起動して確認）。
   実行: node tests/check_creator.mjs

   検証項目：
   ・C キーによる表示／非表示、連打・入力中・Ctrl+C の誤爆防止、オーバーレイ非重複
   ・パスワード画面の文言／入力欄／決定ボタン、決定押下でのみ認証
   ・正しい kiyo のみ通過、大小文字・空白・余分な文字・全角を拒否
   ・ツール画面の一覧（画像・名前・ランク・全件・スクロール・新規キャラ自動追加）
   ・一括進化：無消費・全ランク→LR・通常育成の LR 理論値・奥義解放・冪等性
   ・完了ボタン、再起動後のセーブ維持（更新扱い／新規ゲーム化の防止）
*/
import fs from 'node:fs';
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LS = 'ocf_save_v3';
const DONE = '全キャラクターのLR進化が完了しました！';

/* =========================================================
   0. 通常の育成システムで R→LR した場合の理論値との一致
   ========================================================= */
console.log('== 0. creatorLRTheory() が「通常進化 4 回」と完全一致するか ==');
const { w, document, localStorage } = setup();
const S = await import(fileURL('js/state.js'));
const D = await import(fileURL('js/data.js'));
const M = await import(fileURL('js/materials.js'));

const normal = S.newState();
for (const a of D.ACHIEVEMENTS) normal.achievements[a.id] = { at:'2020-01-01T00:00:00.000Z', claimed:true };
const nc = S.createCharacter(normal, { name:'理論値確認', jobId:D.JOBS[0].id,
  original:'data:image/png;base64,NORMAL' });
nc.level = 65; nc.alloc = { hp:12, atk:9, def:7, mp:11 };
normal.coins = 1000000;
const reqMats = {};
for (const r of Object.values(M.RANK_REQUIREMENTS).flat()) reqMats[r.id] = 99;
S.grantMaterials(normal, reqMats);

const theory = S.creatorLRTheory(normal, nc);       // 進化前に理論値を計算
const steps = [];
for (let i = 0; i < 4; i++) steps.push(S.evolveCharacter(normal, nc).ok);
assert(steps.every(Boolean), `通常進化 4 回すべて成功 ${JSON.stringify(steps)}`);
assert(nc.rarity === 'LR', '通常進化で LR に到達');
assert(eq(nc.evolutionBonus, theory),
  '一括進化の理論値 = 通常の R→SR→SSR→UR→LR で得られる evolutionBonus');
const normalStats = S.computeStats(nc, normal);
assert(['hp','atk','def','mp'].every(k => normalStats[k] > 0), '通常 LR のステータスが計算できる');

/* =========================================================
   1. 本物のアプリを起動してセーブデータを用意
   ========================================================= */
console.log('== 1. アプリ起動と既存セーブの用意 ==');
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
process.on('unhandledRejection', e => errors.push('rejection ' + (e?.stack || e)));

await import(fileURL('js/main.js') + '?creator=1');
await wait(200);
const O = w.__OCF;
const { app } = O;
const st = O.state;
const C = O.CREATOR;
assert(!!O && !!C, 'アプリと CREATOR API が起動');
assert(app.screen === 'title', '初回起動はタイトル画面（既存セーブを作り直さない）');
assert(C.report().open === false && C.report().mode === 'closed', 'ツールは初期状態で非表示');
assert(C.report().layers === 1, 'オーバーレイ要素は最初から 1 つだけ');
assert(document.getElementById('creator-layer').classList.contains('creator-hidden'),
  '通常プレイ中はオーバーレイが hidden');
assert(!document.getElementById('app').innerHTML.includes('CREATOR TOOLS'),
  '通常ゲーム画面 (#app) にツールは混ざらない');
assert(!document.querySelector('[data-creator-action][data-action]'),
  'ツールのボタンは data-creator-action で、通常の data-action と衝突しない');

st.settings.sfx = false;
st.settings.autosave = true;
st.home.started = true; st.home.lastVisit = new Date().toISOString();
for (const a of D.ACHIEVEMENTS) st.achievements[a.id] = { at:'2020-01-01T00:00:00.000Z', claimed:true };
st.coins = 123456; st.bp = 777; st.rankPoints = 88;
S.grantMaterials(st, { evo_stone_R:7, legend_mat_UR:4, mat_ore:2, weapon_ore_R:3 });
st.pity.weapon.history = ['N','R','SR']; st.pity.weapon.total = 3; st.pity.weapon.legendary = 1;
st.story.seen = [1,2]; st.story.cleared = [1]; st.story.chapter = 3;
st.story.arc.cleared = ['ch1']; st.story.arc.claimed = ['ch1']; st.story.arc.scene = 2;
st.dungeon.floor = 7; st.dungeon.best = 5;
st.hints.rewardClaimed = true;
st.customLegacyField = 'keep me';
st.stats.pulls = 5;

const jobIds = D.JOBS.map(j => j.id).filter(id => id !== 'god');
const RANKS = ['R','SR','SSR','UR','LR'];
const N = 12;
for (let i = 0; i < N; i++) {
  const c = S.createCharacter(st, {
    name:`自作${i + 1}`, jobId:jobIds[i % jobIds.length], styleId:'balanced',
    original:`data:image/png;base64,IMG${i}`,
  });
  c.level = 20 + i * 3;
  c.exp = 100 + i * 17;
  c.alloc = { hp:i, atk:i * 2, def:i + 1, mp:i };
  c.rarity = RANKS[i % RANKS.length];
  c.evolutionBonus = S.emptyEvolutionBonus();
  c.evolutionBonus.hp = 2 + i; c.evolutionBonus.atk = 1 + i; c.evolutionBonus.effects.crit = 1;
  if (i === N - 1) {
    // 「既に LR かつ理論値到達済み」のキャラ。ここだけは何も加算されないはず。
    c.rarity = 'LR';
    c.evolutionBonus = S.creatorLRTheory(st, c);
  }
  if (i === N - 2) {
    // 「既に LR だが理論値未達」のキャラ。不足分だけ補われるはず。
    c.rarity = 'LR';
  }
}
assert(st.characters.length === N, `${N} 人の自作キャラを用意`);
assert(new Set(st.characters.map(c => c.rarity)).size === 5,
  'R / SR / SSR / UR / LR の全ランクが混在');

/* =========================================================
   2. C キー：表示・非表示・誤爆防止・重複防止
   ========================================================= */
console.log('== 2. C キーによる表示 / 非表示と入力状態の管理 ==');
const pressC = (opts = {}) => w.dispatchEvent(new w.KeyboardEvent('keydown',
  { key:'c', bubbles:true, cancelable:true, ...opts }));
const layer = () => document.getElementById('creator-layer');
const report = () => C.report();

pressC();
assert(report().open && report().mode === 'password', 'C キーでパスワード画面を表示');
assert(document.querySelectorAll('#creator-layer').length === 1, 'オーバーレイは 1 つだけ');
assert(document.querySelectorAll('.creator-password-card').length === 1, 'パスワード画面は 1 つだけ');
assert(document.getElementById('creator-password').getAttribute('type') === 'password',
  'パスワード入力欄は type=password');
assert(layer().textContent.includes('パスワードを入力してください'), '案内文言を表示');
assert(!!document.querySelector('[data-creator-action="decide"]'), '「決定」ボタンを表示');
assert(document.querySelector('.creator-searchbar') &&
  fs.readFileSync(ROOT + '/css/style.css','utf8').includes('.creator-searchbar'),
  'Google 検索バーのような横長の入力欄と CSS');

// 連打（オートリピート）では開閉が暴れない
for (let i = 0; i < 6; i++) pressC({ repeat:true });
assert(report().open && report().mode === 'password', 'repeat 連打は無視（開いたまま）');
assert(document.querySelectorAll('.creator-password-card').length === 1, '連打で画面が重複しない');

// パスワード欄にフォーカス中（＝文字入力中）は C で閉じない
document.getElementById('creator-password').dispatchEvent(
  new w.KeyboardEvent('keydown', { key:'c', bubbles:true, cancelable:true }));
assert(report().open, '入力欄にフォーカス中の C は誤爆しない');

pressC();
assert(!report().open, 'もう一度 C でパスワード画面を閉じて通常ゲームへ');
assert(layer().innerHTML === '' && layer().classList.contains('creator-hidden'),
  '閉じた後はオーバーレイが空・非表示');

// Ctrl+C / 通常画面の入力欄 / IME 変換中は無反応
w.dispatchEvent(new w.KeyboardEvent('keydown', { key:'c', ctrlKey:true, bubbles:true }));
assert(!report().open, 'Ctrl+C（コピー）では開かない');
const tmpInput = document.createElement('input');
tmpInput.id = 'tmp-typing';
document.getElementById('app').appendChild(tmpInput);
tmpInput.dispatchEvent(new w.KeyboardEvent('keydown', { key:'c', bubbles:true, cancelable:true }));
assert(!report().open, '通常画面の入力欄で文字を打っている最中は開かない');
tmpInput.remove();
w.dispatchEvent(new w.KeyboardEvent('keydown', { key:'c', bubbles:true, isComposing:true }));
assert(!report().open, 'IME 変換中は開かない');
w.dispatchEvent(new w.KeyboardEvent('keydown', { key:'x', bubbles:true }));
assert(!report().open, 'C 以外のキーでは開かない');
assert(document.querySelectorAll('#creator-layer').length === 1,
  '何度操作してもオーバーレイ要素は常に 1 つ');

/* =========================================================
   3. パスワード認証（決定押下のみ / kiyo 完全一致）
   ========================================================= */
console.log('== 3. 正しい / 間違ったパスワードの認証 ==');
pressC();
assert(report().mode === 'password', '再度 C でパスワード画面');

const wrong = ['KIYO','Kiyo','kiyO','kiyo ',' kiyo','kiyo1','1kiyo','kiy','kiyo.',
  'きよ','kiyo\u3000','k\u0456yo',''];
for (const v of wrong) {
  const inp = document.getElementById('creator-password');
  inp.value = v;
  document.querySelector('[data-creator-action="decide"]').click();
  await wait(2);
  assert(report().mode === 'password', `誤パス ${JSON.stringify(v)} ではツールを開かない`);
  assert(!document.querySelector('.creator-shell'), `誤パス ${JSON.stringify(v)} で管理画面が出ない`);
  assert(document.querySelector('.creator-error')?.textContent.includes('パスワードが間違っています'),
    `誤パス ${JSON.stringify(v)} でエラー文言を表示`);
}

// 入力しただけでは認証されない（決定ボタンでのみ）
const inp = document.getElementById('creator-password');
inp.value = 'kiyo';
inp.dispatchEvent(new w.Event('input', { bubbles:true }));
await wait(10);
assert(report().mode === 'password', '入力しただけでは認証されない');
assert(!document.querySelector('.creator-shell'), '決定を押すまで管理画面は出ない');

document.querySelector('[data-creator-action="decide"]').click();
assert(report().mode === 'tools', '半角小文字 kiyo + 決定 でツールを開く');
assert(report().error === '', '認証成功でエラーは消える');
const shellTitle = document.querySelector('.creator-shell h1').textContent;
assert(shellTitle.includes('CREATOR TOOLS') && shellTitle.includes('製作者ツール'),
  '専用画面のタイトル CREATOR TOOLS / 製作者ツール');
assert(document.querySelector('.creator-shell').getAttribute('aria-modal') === 'true',
  '通常ゲームと明確に区別できるモーダル');
assert(!!document.querySelector('.creator-evolve-btn') &&
  document.querySelector('.creator-evolve-btn').textContent.includes('一括進化'),
  '目立つ「一括進化」ボタン');
assert(!!document.querySelector('.creator-scroll') &&
  fs.readFileSync(ROOT + '/css/style.css','utf8').includes('overflow-y:auto'),
  'スクロール可能な一覧');
assert(!!document.querySelector('[data-creator-action="done"]'), '下部に「完了」ボタン');
assert(document.querySelectorAll('#creator-layer').length === 1, 'ツール画面もオーバーレイ 1 つ');

/* =========================================================
   4. 一覧：画像・名前・ランク・全件・新規キャラ自動追加
   ========================================================= */
console.log('== 4. 自作キャラ一覧（画像 / 名前 / ランク / 上限なし） ==');
const cards = () => [...document.querySelectorAll('.creator-char')];
assert(cards().length === st.characters.length, `${st.characters.length} 人全員を一覧表示（件数上限なし）`);
st.characters.forEach((c, i) => {
  const card = cards()[i];
  const img = card.querySelector('img.char-img');
  const badge = card.querySelector('.rank-badge');
  assert(!!img && img.getAttribute('src') === c.original, `No.${i + 1} の画像をそのまま表示`);
  assert(card.textContent.includes(c.name), `No.${i + 1} の名前 ${c.name} を表示`);
  assert(!!badge && badge.textContent.trim() === c.rarity, `No.${i + 1} の現在ランク ${c.rarity}`);
});

const extra = S.createCharacter(st, { name:'あとから追加', jobId:jobIds[2],
  original:'data:image/png;base64,EXTRA' });
extra.level = 31; extra.rarity = 'SSR';
await O.navigate('town');                     // render() → syncCreatorTools()
await wait(20);
assert(cards().length === st.characters.length, '作成直後の新キャラも自動的に一覧へ追加');
assert(layer().textContent.includes('あとから追加'), '新キャラの名前が一覧に出る');
assert(document.querySelector('.town-page'), 'ツール表示中も通常ゲーム側は描画されている');

/* =========================================================
   5. 一括進化：無消費・LR 理論値・既存データ保護
   ========================================================= */
console.log('== 5. 一括進化（無消費 / LR 理論値 / 既存セーブ保護） ==');
const total = st.characters.length;
const snap = {
  coins:st.coins, bp:st.bp, rankPoints:st.rankPoints,
  items:clone(st.inventory.items), equipment:clone(st.inventory.equipment),
  pity:clone(st.pity), story:clone(st.story), dungeon:clone(st.dungeon),
  hints:clone(st.hints), quests:clone(st.quests), achievements:clone(st.achievements),
  titles:clone(st.titles), stats:clone(st.stats), legacy:st.customLegacyField,
  chars:st.characters.map(c => ({
    id:c.id, name:c.name, original:c.original, sprite:c.sprite,
    transparentData:c.transparentData, imageSettings:clone(c.imageSettings),
    jobId:c.jobId, level:c.level, exp:c.exp, alloc:clone(c.alloc),
    equipment:clone(c.equipment), skills:c.skills.map(s => s.id),
    equippedSkills:clone(c.equippedSkills), statPoints:c.statPoints,
    rarity:c.rarity, bonus:clone(c.evolutionBonus),
    stats:clone(S.computeStats(c, st)),
  })),
};

const evoBtn = document.querySelector('[data-creator-action="evolve"]');
evoBtn.click();                               // 実際のボタンから実行
assert(document.querySelector('[data-creator-action="evolve"]').disabled === true,
  '処理中は一括進化ボタンを無効化（二重実行防止）');
assert(document.querySelector('[data-creator-action="done"]').disabled === true,
  '処理中は完了ボタンも無効化（閉じてのデータ破損を防止）');
document.querySelector('[data-creator-action="evolve"]').click();   // 二重クリック
await wait(160);
assert(report().busy === false, '処理が完了');
assert(report().message === DONE, `完了メッセージ「${DONE}」`);
assert(!!report().lastResult && report().lastResult.total === total,
  `${total} 人すべてが処理対象`);
assert(report().lastResult.alreadyMax >= 1, '既に LR 理論値のキャラは「変更なし」として扱う');
assert(st.characters.every(c => c.rarity === 'LR'), 'R / SR / SSR / UR / LR の全員が LR へ');
assert(report().ranks.every(r => r === 'LR'), 'UI 側のレポートも全件 LR');

// 無消費：通貨・素材・装備・ガチャ・ストーリー等は 1 ミリも変わらない
assert(st.coins === snap.coins, `コイン不変 ${st.coins}`);
assert(st.bp === snap.bp && st.rankPoints === snap.rankPoints, 'BP / ランクポイント不変');
assert(eq(st.inventory.items, snap.items), '育成素材・アイテムを一切消費しない');
assert(eq(st.inventory.equipment, snap.equipment), '所持装備を一切消費・変更しない');
assert(eq(st.pity, snap.pity), 'ガチャ天井・履歴を維持');
assert(eq(st.story, snap.story), 'ストーリー進行を維持');
assert(eq(st.dungeon, snap.dungeon), 'ダンジョン進行を維持');
assert(eq(st.hints, snap.hints) && eq(st.quests, snap.quests), 'ヒント・クエストを維持');
assert(eq(st.achievements, snap.achievements) && eq(st.titles, snap.titles), '実績・称号を維持');
assert(st.customLegacyField === snap.legacy, '未知の旧フィールドも維持');
assert(st.stats.pulls === snap.stats.pulls && st.stats.wins === snap.stats.wins,
  '既存のガチャ / 戦績統計を維持');

const KEYS = ['hp','atk','def','mp'];
st.characters.forEach((c, i) => {
  const b = snap.chars[i];
  assert(c.id === b.id && c.name === b.name && c.original === b.original &&
    c.sprite === b.sprite && c.transparentData === b.transparentData,
    `No.${i + 1} の名前・画像データを変更しない`);
  assert(eq(c.imageSettings, b.imageSettings), `No.${i + 1} の画像表示設定を維持`);
  assert(c.jobId === b.jobId && c.level === b.level && c.exp === b.exp,
    `No.${i + 1} の職業・レベル・EXP を維持`);
  assert(eq(c.alloc, b.alloc) && eq(c.equipment, b.equipment),
    `No.${i + 1} の振り分け・装備をリセットしない`);
  assert(b.skills.every(id => c.skills.some(s => s.id === id)) &&
    b.equippedSkills.every(id => c.equippedSkills.includes(id)),
    `No.${i + 1} の習得済み技・セット済み技を消さない`);
  const rankIdx = D.CHAR_RARITY_ORDER.indexOf(b.rarity);
  assert(c.statPoints === b.statPoints + 6 * Math.max(0, 4 - rankIdx),
    `No.${i + 1} のステータスポイントは通常進化と同じ不足分だけ`);
  const th = S.creatorLRTheory(st, c);
  assert(eq(c.evolutionBonus, th),
    `No.${i + 1} の進化ボーナスが LR 理論値どおり（二重加算なし）`);
  assert(KEYS.every(k => c.evolutionBonus[k] >= th[k]), `No.${i + 1} の理論値を下回らない`);
  const now = S.computeStats(c, st);
  assert(KEYS.every(k => now[k] >= b.stats[k]), `No.${i + 1} の 4 基本ステータスが上昇`);
  for (const r of D.EVOLUTION_RULES)
    assert(c.skills.some(s => s.id === r.skill), `No.${i + 1} にランク技 ${r.skill} を解放`);
  const uidv = c.jobId === D.GOD_JOB_ID ? D.GOD_ULTIMATE_ID : D.JOB_ULTIMATE[c.jobId];
  if (uidv) {
    assert(c.skills.some(s => s.id === uidv), `No.${i + 1} に LR 職業奥義 ${uidv} を解放`);
    assert(c.ultimateSkills.includes(uidv), `No.${i + 1} の ultimateSkills にも登録`);
  }
  assert(c.hp === now.hp && c.mp === now.mp, `No.${i + 1} の HP/MP キャッシュを理論値に同期`);
});
assert(st.creatorTool.completed === true && st.creatorTool.lastCount === total,
  '進化完了・保存状態をセーブ項目として記録');

// 冪等性：もう一度実行してもステータスは一切増えない
const bonusBefore2 = st.characters.map(c => clone(c.evolutionBonus));
const rep2 = S.creatorBulkEvolve(st);
assert(rep2.evolved === 0 && rep2.alreadyMax === total,
  '2 回目は全員「変更なし」（理論値到達済みを重複加算しない）');
assert(st.characters.every((c, i) => eq(c.evolutionBonus, bonusBefore2[i])),
  '2 回目で進化ボーナスが増えない');
assert(st.characters.every(c => c.rarity === 'LR'), '2 回目も LR のまま');

/* =========================================================
   6. 完了ボタン / C キー / × ボタンで通常ゲームへ戻る
   ========================================================= */
console.log('== 6. 完了ボタンと C キーで通常ゲームへ復帰 ==');
document.querySelector('[data-creator-action="done"]').click();
await wait(20);
assert(!report().open && report().mode === 'closed', '「完了」でツールを閉じる');
assert(layer().innerHTML === '' && layer().classList.contains('creator-hidden'),
  '閉じた後オーバーレイは消える');
assert(!!document.querySelector('.town-page'), '通常の街ホーム画面に戻る');
assert(st.characters.every(c => c.rarity === 'LR'), '閉じても進化結果は保持');

pressC();
assert(report().open && report().mode === 'password', '完了後も C で再表示できる');
pressC();
assert(!report().open, 'パスワード画面をもう一度 C で閉じられる');

pressC();
document.getElementById('creator-password').value = 'kiyo';
document.getElementById('creator-password').dispatchEvent(
  new w.KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
assert(report().mode === 'tools', '入力欄の Enter でも決定と同じ認証');
pressC();
assert(!report().open, 'ツール画面も C キーで閉じて通常ゲームへ');

pressC();
document.getElementById('creator-password').value = 'kiyo';
document.querySelector('[data-creator-action="decide"]').click();
assert(report().mode === 'tools', '× ボタン確認用にツールを開く');
document.querySelector('[data-creator-action="close"]').click();
assert(!report().open, '× ボタンでも閉じられる');
assert(document.querySelectorAll('#creator-layer').length === 1,
  '全操作を通じてオーバーレイは 1 つのまま');

/* =========================================================
   7. 再起動後のデータ維持（本物の loadState を通す）
   ========================================================= */
console.log('== 7. 再起動後のセーブ維持 ==');
await S.saveState(st, true);
const raw = localStorage.getItem(LS);
assert(!!raw, '一括進化の結果が localStorage に保存されている');
const saved = JSON.parse(raw);
assert(saved.version === D.VERSION && !!saved.story?.arc, 'VERSION 8 / 既存ストーリー形式のまま');
assert(saved.characters.length === total && saved.characters.every(c => c.rarity === 'LR'),
  '保存された全キャラが LR');
assert(saved.creatorTool?.completed === true, '完了状態も保存されている');
assert(saved.coins === snap.coins && eq(saved.inventory.items, snap.items),
  '保存データの通貨・素材も不変');

const second = setup();                       // 別ウィンドウ＝ブラウザ再起動を模す
second.localStorage.setItem(LS, raw);
second.localStorage.setItem('ocf_has_save', '1');
await import(fileURL('js/main.js') + '?creator=2');
await wait(240);
const O2 = second.w.__OCF;
const st2 = O2.state;
assert(!!O2 && !!O2.CREATOR, '再起動後もアプリが起動');
assert(!O2.app.loadIssue.unreadable, '破損セーブとして隔離されない');
assert(O2.app.loadIssue.migrated === false, '更新扱いにされず既存セーブとして読込');
assert(O2.app.screen === 'town', 'セーブありなので街ホームから再開（新規ゲームにならない）');
assert(st2.characters.length === total, `${total} 人全員が復元される`);
assert(st2.characters.every(c => c.rarity === 'LR'), '再起動後も全員 LR');
assert(st2.creatorTool.completed === true, '再起動後も完了状態を維持');
assert(st2.coins === snap.coins && eq(st2.inventory.items, snap.items),
  '通貨・育成素材が復元後も不変');
assert(st2.inventory.equipment.length === snap.equipment.length &&
  st2.inventory.equipment.every((x, i) => x.uid === snap.equipment[i].uid &&
    x.defId === snap.equipment[i].defId), '所持装備の個体を 1 つも失わない');
assert(eq(st2.pity, snap.pity), 'ガチャ天井・履歴を維持');
assert(eq(st2.story.seen, snap.story.seen) && eq(st2.story.cleared, snap.story.cleared) &&
  st2.story.chapter === snap.story.chapter &&
  eq(st2.story.arc.cleared, snap.story.arc.cleared) &&
  eq(st2.story.arc.claimed, snap.story.arc.claimed), 'ストーリー進行を維持');
assert(eq(st2.dungeon, snap.dungeon), 'ダンジョン進行を維持');
assert(st2.customLegacyField === snap.legacy, '旧フィールドも維持');
st2.characters.forEach((c, i) => {
  const b = snap.chars[i];
  assert(c.name === b.name && c.original === b.original && c.jobId === b.jobId &&
    c.level === b.level && eq(c.equipment, b.equipment),
    `再起動後 No.${i + 1} の名前・画像・職業・レベル・装備を維持`);
  assert(eq(c.evolutionBonus, S.creatorLRTheory(st2, c)),
    `再起動後 No.${i + 1} も LR 理論値のまま`);
});
assert(O2.CREATOR.report().open === false && O2.CREATOR.report().mode === 'closed',
  '再起動後はツールは閉じた状態（通常プレイに影響しない）');
assert(second.document.querySelectorAll('#creator-layer').length === 1,
  '再起動後もオーバーレイは 1 つだけ（古い DOM を持ち越さない）');

assert(errors.length === 0, `console.error / unhandledRejection 0 件（実際 ${errors.length}: ${errors.slice(0,2)}）`);
console.log('\nCREATOR TOOLS CHECK OK — Cキー・認証・一覧・一括進化・LR理論値・完了・再起動維持すべて合格');
