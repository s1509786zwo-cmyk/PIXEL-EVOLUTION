/* 新規キャラクター作成画面の初期化と、保存済みキャラクターの完全分離の検証。
   実行: node tests/check_new_char.mjs

   ユーザー指定の動作確認 1〜8 を、本物のアプリ（jsdom）を起動して実際にクリックして確認する。
   ・既存キャラが複数いる状態 → 「新規作成」→ 完全に空 → 過去キャラが出ない
   ・新しいキャラを作成・保存 → 一覧に追加・新しい ID → 過去キャラは全部そのまま
   ・再起動しても全員保存
   さらに「開くたびにリセット」「キャンセル無影響」「古い一時データが混ざらない」
   「ID を再利用しない」「明示的な下書き保存／読込は維持」も検証する。
*/
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LS = 'ocf_save_v3';

const { w, document, localStorage } = setup();
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
process.on('unhandledRejection', e => errors.push('rejection ' + (e?.stack || e)));

await import(fileURL('js/main.js') + '?newchar=1');
await wait(200);
const O = w.__OCF;
const { app, S, D } = O;
assert(!!O && !!S && !!D, 'アプリが起動');
const q = s => document.querySelector(s);
const qa = s => [...document.querySelectorAll(s)];
const click = sel => {
  const el = typeof sel === 'string' ? q(sel) : sel;
  assert(!!el, `クリック対象が存在: ${typeof sel === 'string' ? sel : el?.dataset?.action}`);
  el.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true }));
};
const html = () => document.getElementById('app').innerHTML;
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/* =========================================================
   1. 過去に作成したキャラクターが複数いる状態を用意
   ========================================================= */
console.log('== 1. 既存キャラ 3 人と「旧バージョンの残留下書き」を用意 ==');
const st = O.state;
st.settings.sfx = false;
st.home.started = true; st.home.lastVisit = new Date().toISOString();
const names = ['先代アオイ', '二番手ベニ', '三番手シロ'];
const jobIds = ['warrior', 'mage', 'archer'];
const ranks = ['SR', 'SSR', 'UR'];
const oldChars = [];
for (let i = 0; i < 3; i++) {
  const ch = S.createCharacter(st, {
    name:names[i], jobId:jobIds[i], weaponType:undefined, styleId:'balanced',
    original:`data:image/png;base64,OLD${i}`,
  });
  ch.level = 20 + i * 7;
  ch.exp = 300 + i * 50;
  ch.alloc = { hp:i + 1, atk:i + 2, def:i + 3, mp:i + 4 };
  ch.statPoints = 5 + i;
  ch.rarity = ranks[i];
  ch.awakening = i;
  ch.rebirth = i % 2;
  ch.frame = ['gold','blue','violet'][i];
  ch.record.wins = 3 + i; ch.record.losses = i;
  ch.evolutionBonus = { ...ch.evolutionBonus, hp: 7 + i, atk: 3 + i, def: 2, mp: 1,
    effects: { crit:1 + i, critDamage:0, ultimatePower:0 } };
  oldChars.push(ch);
}
assert(st.characters.length === 3, '過去に作成したキャラクターが 3 人いる');
assert(new Set(st.characters.map(c => c.id)).size === 3, '既存 3 人の ID はすべて異なる');
assert(st.characters.every(c => c.skills.length > 0 && c.equipment.weapon),
  '既存キャラは初期技・初期装備を持つ');

// 旧バージョンは createFinish / saveLook のたびに「保存済みキャラの情報」を
// state.draftSave へ書き込んでいた。その残留データが新規作成に混ざる不具合を再現する。
st.draftSave = {
  name:names[2], original:`data:image/png;base64,OLD2`, sprite:`data:image/png;base64,OLD2`,
  imageSettings:{ ...S.defaultImageSettings(), scale:2.1, offsetX:22 },
  transparentData:'', jobId:'archer', weaponType:'弓', styleId:'defensive',
  frame:'prism', width:800, height:900,
};
const charSnap = clone(st.characters);
const saveSnap = {
  coins:st.coins, bp:st.bp, rankPoints:st.rankPoints,
  items:clone(st.inventory.items),
  equipment:clone(st.inventory.equipment.map(x => ({ uid:x.uid, defId:x.defId, enhance:x.enhance, rank:x.rank }))),
  pity:clone(st.pity), story:clone(st.story), dungeon:clone(st.dungeon),
  hints:clone(st.hints), catalog:clone(st.catalog), titles:clone(st.titles),
  pulls:st.stats.pulls, wins:st.stats.wins, version:st.version,
};
await S.saveState(st, true);

const assertOldCharsIntact = label => {
  assert(st.characters.length >= 3, `${label}：既存 3 人が消えていない`);
  st.characters.slice(0, 3).forEach((c, i) => {
    const b = charSnap[i];
    assert(c.id === b.id && c.name === b.name && c.original === b.original && c.sprite === b.sprite,
      `${label}：No.${i + 1} の ID・名前・画像を維持`);
    assert(c.jobId === b.jobId && c.rarity === b.rarity && c.level === b.level &&
      c.exp === b.exp && eq(c.alloc, b.alloc) && c.statPoints === b.statPoints,
      `${label}：No.${i + 1} の職業・ランク・ステータス・育成を維持`);
    assert(eq(c.skills, b.skills) && eq(c.equippedSkills, b.equippedSkills) &&
      eq(c.equipment, b.equipment) && eq(c.evolutionBonus, b.evolutionBonus) &&
      eq(c.record, b.record) && c.awakening === b.awakening && c.rebirth === b.rebirth,
      `${label}：No.${i + 1} の技・装備・進化ボーナス・戦績・覚醒・転生を維持`);
  });
  // 新キャラ作成時の実績報酬・図鑑登録・初期装備の付与は既存挙動なので、
  // 「増える」のは許容し、「減る / 消える / 初期化される」ことを厳密に禁止する。
  assert(st.coins >= saveSnap.coins && st.bp >= saveSnap.bp &&
    st.rankPoints >= saveSnap.rankPoints &&
    Object.entries(saveSnap.items).every(([k, v]) => (Number(st.inventory.items[k]) || 0) >= v),
    `${label}：通貨・アイテム・素材が初期化・減少・消失していない`);
  assert(saveSnap.equipment.every(x => st.inventory.equipment.some(y =>
    y.uid === x.uid && y.defId === x.defId && y.enhance === x.enhance && y.rank === x.rank)),
    `${label}：既存の装備個体を 1 つも失わない`);
  assert(eq(st.pity, saveSnap.pity) && eq(st.story, saveSnap.story) &&
    eq(st.dungeon, saveSnap.dungeon),
    `${label}：ガチャ天井・ストーリー・ダンジョンを維持`);
  assert(saveSnap.titles.every(t => st.titles.includes(t)) &&
    Object.keys(saveSnap.catalog).every(k => Array.isArray(st.catalog[k]) &&
      saveSnap.catalog[k].every(x => st.catalog[k].includes(x))) &&
    Object.entries(saveSnap.hints).every(([k]) => k in st.hints),
    `${label}：称号・図鑑・ヒントの既存記録を 1 つも消さない`);
  assert(st.version === saveSnap.version, `${label}：セーブ VERSION を維持`);
};

/* =========================================================
   2. 「新規作成」を押す → 3. 完全に空の作成画面 → 4. 過去キャラが出ない
   ========================================================= */
console.log('== 2〜4. 「新規作成」→ 完全に空 / 過去キャラは一切表示されない ==');
await O.navigate('town');
assert(!!q('.town-page'), '街ホームにいる');
const newCharBtn = qa('[data-action="newChar"]').find(x => txt(x).includes('新規作成'));
assert(!!newCharBtn, '街に「新規作成」ボタンがある');
click(newCharBtn);
await wait(30);
assert(app.screen === 'create' && !!q('.create-page'), '「新規作成」で作成画面が開く');

const d0 = app.draft;
assert(!!d0 && typeof d0.sessionId === 'string' && d0.sessionId.startsWith('draft_'),
  '新規作成セッション固有の ID を発行（保存済みキャラとは無関係）');
assert(d0.original === '' && d0.sprite === '' && d0.image === null && d0.meta === null &&
  d0.width === 0 && d0.height === 0 && d0.transparentData === '',
  'キャラクター画像：未設定（元画像・プレビュー・透過データ・サイズすべて空）');
assert(d0.name === '' && q('[data-draft="name"]')?.value === '',
  'キャラクター名：空欄');
assert(d0.jobId === 'warrior' && d0.weaponType === '剣' && d0.styleId === 'balanced' &&
  d0.frame === 'gold', '職業・初期武器・スタイル・フレーム：初期状態');
assert(q('select[data-draft="weaponType"]')?.value === '剣' &&
  q('select[data-draft="styleId"]')?.value === 'balanced' &&
  q('.job-pick-card.selected[data-job="warrior"]'),
  '画面上の職業・武器・スタイル選択も初期状態');
assert(eq(d0.settings, S.defaultImageSettings()), '表示設定：新規作成用の初期状態');
assert(d0.step === 1 && app.compare === false && app.charName === '',
  'その他の入力項目（ステップ・比較・改名入力）もすべて初期状態');
assert(!!q('.editor-empty') && !q('.editor-stage img') &&
  txt(q('.editor-preview-head')).includes('画像未選択'),
  'プレビューは「画像を選んでください」の空状態');
assert(q('.create-page') && !html().includes('data:image/png;base64,OLD'),
  '前回選択した画像・旧下書き画像を引き継がない');
assert(st.draftSave === null,
  '旧バージョンが残した「保存済みキャラ由来の一時データ」を破棄（キャラ自体は無変更）');
assertOldCharsIntact('新規作成を開いた直後');

const pageText = txt(q('#app'));
for (const n of names) assert(!pageText.includes(n),
  `過去のキャラクター名「${n}」は新しい作成画面に勝手に表示されない`);
assert(!q('.topbar-char'), '作成画面の上部ナビにも過去キャラの名前・画像を出さない');
for (const r of ranks) assert(!txt(q('.create-page')).includes(r),
  `過去キャラのランク ${r} も作成画面に混ざらない`);
assert(!html().includes('undefined') && !html().includes('NaN') && !html().includes('[object Object]'),
  '作成画面に undefined / NaN / [object Object] なし');

/* =========================================================
   5. 開くたびにリセット / キャンセル無影響 / 下書きは自動復元しない
   ========================================================= */
console.log('== 5. 開くたびのリセット・キャンセル・一時データの分離 ==');
click('[data-action="createSample"]');
await wait(40);
assert(app.draft.original === 'assets/sample_hero.jpg', '途中で画像を読み込む');
const nameInput = q('[data-draft="name"]');
nameInput.value = '途中入力テスト';
nameInput.dispatchEvent(new w.Event('input', { bubbles:true }));
app.draft.jobId = 'mage'; app.draft.settings.scale = 1.9; app.draft.transparentData = 'TEMP';
assert(app.draft.name === '途中入力テスト' && app.draft.jobId === 'mage',
  '作成途中の入力状態を持つ');
click('[data-action="createSave"]');
await wait(20);
assert(st.draftSave?.kind === 'draft' && st.draftSave.name === '途中入力テスト',
  '明示的な「💾 保存」は純粋な下書きとして残る（既存機能を維持）');
const session1 = app.draft.sessionId;

// キャンセル（街へ戻る）：一時入力だけ捨て、保存済みキャラには一切触れない
click('[data-action="nav"][data-to="town"]');
await wait(20);
assert(app.screen === 'town' && app.draft === null,
  'キャンセルで編集中の入力データを破棄');
assertOldCharsIntact('キャンセル後');
assert(st.characters.length === 3, 'キャンセルではキャラクターを 1 人も増減させない');

// もう一度「新規作成」：下書きが残っていても完全に空から始まる
click(qa('[data-action="newChar"]').find(x => txt(x).includes('新規作成')));
await wait(30);
assert(app.draft.sessionId !== session1, '開くたびに新しい作成セッション（入力状態をリセット）');
assert(app.draft.original === '' && app.draft.name === '' && app.draft.jobId === 'warrior' &&
  app.draft.transparentData === '' && eq(app.draft.settings, S.defaultImageSettings()),
  '保存済み下書きがあっても自動復元せず、画像・名前・職業・設定は初期状態');
assert(q('[data-draft="name"]')?.value === '' && !!q('.editor-empty'),
  '画面上も空欄・画像未選択');
assertOldCharsIntact('2 回目の新規作成');

// 明示的な「下書きを読み込む」だけは従来どおり動く（自動復元とは別）
click('[data-action="loadDraft"]');
await wait(40);
assert(app.draft.original === 'assets/sample_hero.jpg' && app.draft.name === '途中入力テスト',
  '「下書きを読み込む」を明示的に押したときだけ下書きを反映');
click(qa('[data-action="nav"][data-to="town"]')[0]);
await wait(20);
click(qa('[data-action="newChar"]').find(x => txt(x).includes('新規作成')));
await wait(30);
assert(app.draft.original === '' && app.draft.name === '',
  '下書き読込後でも、新規作成を開き直せば再び完全に空');

/* =========================================================
   6. 新しいキャラクターを作成して保存
   ========================================================= */
console.log('== 6. 新しいキャラクターを作成・保存 ==');
click('[data-action="createSample"]');
await wait(40);
const name2 = q('[data-draft="name"]');
name2.value = '新ヒーロー';
name2.dispatchEvent(new w.Event('input', { bubbles:true }));
click('[data-action="createFinish"]');
await wait(60);
assert(app.screen === 'town' && !!q('.town-page'), '作成完了で街へ戻る');

/* =========================================================
   7. 一覧に追加・新しい ID・過去キャラはすべて残る
   ========================================================= */
console.log('== 7. 一覧に追加 / 新しい ID / 過去キャラ完全維持 ==');
assert(st.characters.length === 4, `キャラクター一覧が 3 → 4 人に増えた（実際 ${st.characters.length}）`);
const fresh = st.characters[3];
assert(!!fresh && fresh.name === '新ヒーロー' && fresh.original === 'assets/sample_hero.jpg',
  '新しいキャラクターが新しいデータとして保存された');
assert(!charSnap.some(c => c.id === fresh.id),
  `新しい ID ${fresh.id} は過去 3 人のどの ID とも重複しない`);
assert(new Set(st.characters.map(c => c.id)).size === 4, '全 4 人の ID が一意');
assert(fresh.level === 1 && fresh.rarity === 'R' && fresh.exp === 0 &&
  fresh.statPoints === 3 && fresh.awakening === 0 && fresh.rebirth === 0,
  '新しいキャラの能力・ステータスは新規作成用の初期状態');
assert(fresh.skills.length > 0 && !!fresh.equipment.weapon,
  '新しいキャラにも初期技・初期装備が付与される');
assertOldCharsIntact('新規キャラ作成後');
assert(st.draftSave === null,
  '作成完了後に保存済みキャラの画像・名前を一時データへ書き戻さない');
assert(st.activeId === fresh.id, '新しく作ったキャラが選択状態になる');

// 見た目の保存も下書きを汚さない（過去キャラの画像・名前が混ざる経路を断つ）
await O.navigate('appearance');
await wait(30);
click('[data-action="saveLook"]');
await wait(30);
assert(st.draftSave === null, '「見た目を保存」しても下書きに既存キャラ情報が混ざらない');
assertOldCharsIntact('見た目保存後');

/* =========================================================
   8. ゲームを再起動しても全キャラクターが正常に保存されている
   ========================================================= */
console.log('== 8. 再起動後も全キャラクターが保存されている ==');
await S.saveState(st, true);
const raw = localStorage.getItem(LS);
assert(!!raw, 'セーブが localStorage に書き出されている');
const saved = JSON.parse(raw);
assert(saved.version === D.VERSION && saved.characters.length === 4,
  '保存データに 4 人全員が含まれる');
assert(saved.characters.slice(0, 3).every((c, i) =>
  c.id === charSnap[i].id && c.name === charSnap[i].name &&
  c.original === charSnap[i].original && c.rarity === charSnap[i].rarity),
  '保存データ上でも過去 3 人の ID・名前・画像・ランクが不変');

const second = setup();               // 別ウィンドウ＝ブラウザ再起動を模す
second.localStorage.setItem(LS, raw);
second.localStorage.setItem('ocf_has_save', '1');
await import(fileURL('js/main.js') + '?newchar=2');
await wait(260);
const O2 = second.w.__OCF;
const st2 = O2.state;
assert(!!O2 && !!st2, '再起動後もアプリが起動');
assert(!O2.app.loadIssue?.unreadable, '破損セーブとして隔離されない');
assert(O2.app.loadIssue?.migrated === false, '更新扱いにされず既存セーブとして読込');
assert(O2.app.screen === 'town', 'セーブありなので街から再開（新規ゲームにならない）');
assert(st2.characters.length === 4, '再起動後も 4 人全員が復元される');
assert(new Set(st2.characters.map(c => c.id)).size === 4, '再起動後も ID は一意');
st2.characters.forEach((c, i) => {
  const b = i < 3 ? charSnap[i] : fresh;
  assert(c.id === b.id && c.name === b.name && c.original === b.original &&
    c.jobId === b.jobId && c.rarity === b.rarity && c.level === b.level &&
    eq(c.skills, b.skills) && eq(c.equipment, b.equipment) && eq(c.alloc, b.alloc),
    `再起動後 No.${i + 1} の ID・名前・画像・職業・ランク・能力・技・装備を維持`);
});
assert(st2.coins >= saveSnap.coins &&
  Object.entries(saveSnap.items).every(([k, v]) => (Number(st2.inventory.items[k]) || 0) >= v),
  '再起動後も通貨・素材が初期化・減少していない');
assert(st2.draftSave === null || st2.draftSave?.kind === 'draft',
  '再起動後も保存済みキャラ由来の一時データは残らない');
// 再起動直後に新規作成を開いても空（古いキャッシュが混ざらない）
await O2.navigate('create');
await wait(20);
assert(O2.app.draft && O2.app.draft.original === '' && O2.app.draft.name === '',
  '再起動直後の新規作成画面も完全に空');
assert(!second.document.getElementById('app').innerHTML.includes('先代アオイ'),
  '再起動後の作成画面にも過去キャラの名前が出ない');

assert(errors.length === 0,
  `console.error / unhandledRejection 0 件（実際 ${errors.length}: ${errors.slice(0,2)}）`);
console.log('\nNEW CHARACTER CHECK OK — 完全な空状態・開くたびリセット・キャンセル無影響・新ID発行・既存キャラ/装備/技/育成/セーブ完全維持・再起動後も全員保存 すべて合格');
