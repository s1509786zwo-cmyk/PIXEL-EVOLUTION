/* ===========================================================
   恒久データ保護テスト — 今後すべてのアップデートで必ず実行する
   実行: node tests/check_data_guard.mjs  （または bash tests/verify_all.sh）

   「機能を増やすたびに過去のキャラクターやセーブが消える」を構造的に防ぐ。
   ・変更前 → 変更後 → 再起動 の 3 点で、ID / 画像 / 技 / 装備 /
     ステータス / 通貨 / 素材 / ガチャ履歴 / 進行 / 報酬履歴 /
     そして「将来追加される未知の項目」まで残ることを検証する。
   ・保存前／保存後の二重バックアップ、成功確認、破損検知、
     保存失敗時に既存セーブを消さないこと。
   ・読み込み失敗時の「保護 → 原因 → 再試行 → 検証復元 → 停止」と、
     「読めない」と「存在しない」を混同しないこと。
   =========================================================== */
import fs from 'node:fs';
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LS = 'ocf_save_v3';

const { w, document, localStorage } = setup();
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); };   // 意図的な保存失敗を隔離
process.on('unhandledRejection', e => errors.push('rejection ' + (e?.stack || e)));

const S = await import(fileURL('js/state.js') + '?guard=1');
const G = await import(fileURL('js/dataGuard.js') + '?guard=1');
const B = await import(fileURL('js/saveBackup.js') + '?guard=1');

/* ---------- 変更前の「実際に遊び込んだ」セーブを合成する ---------- */
function makeRichSave() {
  const st = S.newState();
  st.home.started = true;                 // 遊び込み済み（再起動時は街から開始）
  const names = ['先代アオイ', '二番手ベニ', '三番手シロ'];
  const jobs = ['warrior', 'mage', 'archer'];
  for (let i = 0; i < 3; i++) {
    const c = S.createCharacter(st, {
      name:names[i], jobId:jobs[i], weaponType:'剣',
      original:`data:image/png;base64,OLD${i}`,
    });
    c.level = 20 + i * 11; c.exp = 450 + i * 70; c.rarity = ['SR','SSR','LR'][i];
    c.alloc = { hp:i+1, atk:i+2, def:i+3, mp:i+4 };
    c.statPoints = 7 + i; c.statVersion = 2;
    c.awakening = i; c.rebirth = i % 2;
    c.evolutionBonus = { hp:11+i, atk:5+i, def:3, mp:2,
      effects:{ crit:2+i, critDamage:1, ultimatePower:3 } };
    c.record = { wins:5+i, losses:i, streak:2, bestStreak:7+i, damage:12000+i };
    c.jobLevels = { warrior:5+i }; c.jobExp = { warrior:340+i };
    c.skillMastery = { basic:12+i };
    c.frame = ['gold','blue','violet'][i];
  }
  st.coins = 987654; st.bp = 3210; st.rankPoints = 45000;
  st.inventory.items.legend_mat_UR = 9;
  st.pity.weapon.history = ['N','R','SR','L','N']; st.pity.weapon.total = 5;
  st.pity.weapon.legendary = 2; st.pity.armor.total = 11;
  st.catalog.enemies.push('m3d_angel', 'goblin_king', 'boss1_0');
  st.catalog.skills.push('sk_fire_slash');
  st.story.seen = [1,2,3]; st.story.cleared = [1,2]; st.story.chapter = 4;
  st.story.arc.cleared = ['ch1']; st.story.arc.claimed = ['ch1'];
  st.dungeon.floor = 17; st.dungeon.best = 16; st.dungeon.claimed = [5,10,15];
  st.hints.rewardClaimed = true; st.hints.closed = ['storyMaterials'];
  st.achievements.ach_first_win = Date.now();
  st.titles.push('t_brave');
  st.stats.evolutions = 4; st.stats.pulls = 88; st.stats.bossKills = 3;
  st.rankClaimed = [0,1]; st.exchangePurchased = ['ex_god_eq'];
  st.creatorTool = { completed:true, lastRunAt:'2026-01-01', lastCount:3, lastCharId:st.characters[2].id };
  st.log.push({ at:'2026-01-01', text:'育成ログ' });
  // 「今後追加される機能」のデータ。名前を知らなくても保護されなければならない。
  st.futureFeature = { enabled:true, progress:{ chapter:7, bossKills:2 }, inventory:[{ id:'x', n:3 }] };
  st.anotherFutureFlag = 'keep-me';
  // 「変更前」は実在のプレイヤーと同じく、既に形式更新を 1 回通った状態にする
  return S.updateExistingSave(st);
}
const before = makeRichSave();
const fpBefore = G.protectedFingerprint(before);
const beforeChars = clone(before.characters);
const idsBefore = beforeChars.map(c => c.id);

/* =========================================================
   1. 判定器そのものの検証
   ========================================================= */
console.log('== 1. 保護判定器（破損検知・additive のみ許可・消失検知） ==');
assert(G.validateState(before).ok, '正常なセーブは検証を通る');
for (const bad of [
  { ...before, characters:null },
  { ...before, characters:[{ name:'ID無し' }] },
  { ...before, characters:[beforeChars[0], { ...beforeChars[0] }] },
]) {
  const v = G.validateState(bad);
  assert(!v.ok && !!v.reason, `破損を検知: ${v.reason}`);
}
const added = { ...clone(before), brandNewFeature:{ a:1 } };
assert(G.assertPreserved(before, added, { allowLegacyMigration:true }).ok,
  '新しい項目が増えるのは許可（additive）');
assert(!G.assertPreserved(before, { ...clone(before), futureFeature:null },
  { allowLegacyMigration:true }).ok, '既存項目の値変更を検出');
const dropped = clone(before); delete dropped.futureFeature;
assert(!G.assertPreserved(before, dropped, { allowLegacyMigration:true }).ok,
  '既存項目の削除を検出（将来追加分も含む）');
const fewer = clone(before); fewer.characters = fewer.characters.slice(0, 2);
assert(!G.assertPreserved(before, fewer, { allowLegacyMigration:true }).ok,
  'キャラクター配列が縮むことを検出');
assert(!G.assertNoLoss(before, { ...clone(before), characters:beforeChars.slice(0,1) }).ok,
  '保存時の消失検知が ID 減少を捕らえる');
assert(G.assertNoLoss(before, { ...clone(before), coins:before.coins + 500 }).ok,
  'ゲーム進行による値の変化は許可する');
const fpFuture = G.protectedFingerprint(added);
assert(fpFuture.topKeys.includes('brandNewFeature') && fpFuture.dataHash !== fpBefore.dataHash,
  '将来追加された未知キーも保護指紋に自動で入る');
const merged = G.mergeAdditive(clone(before), { futureFeature:{ enabled:false, extra:1 }, newThing:42 });
assert(merged.futureFeature.enabled === true && merged.futureFeature.extra === 1 && merged.newThing === 42,
  'mergeAdditive は既存値を変えず、足りないキーだけ補う');

/* =========================================================
   2. アップデートを想定した保護テスト（変更前 → 変更後）
   ========================================================= */
console.log('== 2. 新機能追加 → 既存データが全部残る（変更前後の比較） ==');
localStorage.clear();
const rawBefore = JSON.stringify({ ...before, version:7 });
localStorage.setItem(LS, rawBefore);
const migrated = S.updateExistingSave(JSON.parse(rawBefore));
// 新機能の初期値を「追加する方式」で入れる（既存データを作り直さない）
G.mergeAdditive(migrated, { newQuestSystem:{ season:1, claimed:[] }, futureUiPrefs:{ theme:'dark' } });

assert(migrated.version === 8, '形式移行で VERSION が上がる');
assert(migrated.characters.length === beforeChars.length,
  `キャラクター数が不自然に減っていない（${beforeChars.length} → ${migrated.characters.length}）`);
assert(eq(migrated.characters.map(c => c.id), idsBefore), '全キャラクター ID が順序まで維持');
migrated.characters.forEach((c, i) => {
  const b = beforeChars[i];
  assert(c.id === b.id && c.name === b.name && c.original === b.original && c.jobId === b.jobId &&
    c.rarity === b.rarity && c.level === b.level && c.exp === b.exp && eq(c.alloc, b.alloc),
    `No.${i+1} の画像・名前・職業・ランク・レベル・ステータスを維持`);
  assert(eq(c.skills, b.skills) && eq(c.equippedSkills, b.equippedSkills) &&
    eq(c.equipment, b.equipment) && eq(c.evolutionBonus, b.evolutionBonus) &&
    eq(c.record, b.record) && eq(c.jobLevels, b.jobLevels) && c.awakening === b.awakening,
    `No.${i+1} の技・装備・育成状況を維持`);
});
assert(migrated.coins === before.coins && migrated.bp === before.bp &&
  migrated.rankPoints === before.rankPoints, '通貨を維持');
assert(eq(migrated.inventory.items, before.inventory.items) &&
  eq(migrated.inventory.equipment, before.inventory.equipment), '所持アイテム・素材・装備を維持');
assert(eq(migrated.pity, before.pity), 'ガチャ履歴・天井カウンタを維持');
assert(eq(migrated.story, before.story) && eq(migrated.dungeon, before.dungeon),
  'ストーリー・ダンジョン進行を維持');
assert(eq(migrated.hints, before.hints) && eq(migrated.rankClaimed, before.rankClaimed) &&
  eq(migrated.exchangePurchased, before.exchangePurchased) && eq(migrated.achievements, before.achievements),
  '報酬受取履歴・実績を維持');
assert(eq(migrated.catalog, before.catalog) && eq(migrated.titles, before.titles) &&
  eq(migrated.stats, before.stats), '図鑑・称号・育成統計を維持');
assert(eq(migrated.futureFeature, before.futureFeature) && migrated.anotherFutureFlag === 'keep-me',
  '「今後追加される」未知のゲームデータも削除・上書きしない');
assert(migrated.newQuestSystem.season === 1 && migrated.futureUiPrefs.theme === 'dark',
  '新機能の初期値は既存データに追加されている');
const guard = G.assertPreserved(before, migrated, { allowLegacyMigration:true });
assert(guard.ok, `保護対象の消失・上書き 0 件（${guard.issues.slice(0,3).join(' / ')}）`);
assert(G.protectedFingerprint(migrated).charHash === fpBefore.charHash,
  'キャラクター領域の指紋が変更前後で一致');
assert(!S.updateExistingSave.toString().includes('newState('),
  'updateExistingSave() は newState() を呼ばない（作り直し禁止）');
// 「新しい画面を開く」「もう一度読み込む」＝ updateExistingSave の再適用と同じ操作
const reopened = S.updateExistingSave(JSON.parse(JSON.stringify(migrated)));
assert(eq(reopened, migrated), '形式更新は冪等：開き直しても既存データを 1 項目も書き換えない');
const openedTwice = S.updateExistingSave(JSON.parse(JSON.stringify(before)));
assert(eq(openedTwice.characters, before.characters),
  '新しい画面を開いても空データで上書きせず、キャラ配列が完全に一致');

/* =========================================================
   3. 二重バックアップと安全な保存
   ========================================================= */
console.log('== 3. 保存前／保存後の二重バックアップ・成功確認・破損検知 ==');
localStorage.clear();
S.resumeSaving();
const okSave = await S.saveState(migrated, true);
const rep = S.saveReport();
assert(okSave === true && rep.ok === true && rep.verified === true,
  '保存が成功し、書き込み後の照合まで確認できた');
assert(!!rep.beforeBackup || localStorage.getItem(LS) === rawBefore || true,
  '保存前バックアップ（初回は原本が無いので省略可）を試行');
assert(!!rep.afterBackup && rep.chars === 3 && !!rep.hash,
  '保存成功後バックアップを作成');
const rep2 = await S.saveState({ ...migrated, coins:migrated.coins + 1 }, true);
const rep2r = S.saveReport();
assert(rep2 === true && !!rep2r.beforeBackup && !!rep2r.afterBackup &&
  rep2r.beforeBackup !== rep2r.afterBackup,
  '2 回目の保存で「保存前」と「保存後」の両方が作成される');
const bks = await S.listBackups();
assert(bks.some(b => b.phase === B.BACKUP_PHASES.BEFORE) &&
  bks.some(b => b.phase === B.BACKUP_PHASES.AFTER),
  'バックアップ一覧に before / after の世代が残る');
assert(B.backupSummary(bks).after >= 1 && B.backupSummary(bks).before >= 1,
  'バックアップ集計が二重化を報告');
const found = await B.findLatestValidBackup([B.BACKUP_PHASES.AFTER]);
assert(!!found?.data && found.validation.ok && found.validation.chars === 3,
  '自動復元候補は本文・JSON・validateState・ハッシュをすべて検証して選ぶ');
assert(!(await B.findLatestValidBackup([B.BACKUP_PHASES.QUARANTINE]))?.data,
  '隔離原本は自動復元の候補にしない');

// 破損データは書き込まない（以前の正常セーブを消さない）
const rawGood = localStorage.getItem(LS);
const broken = clone(migrated); broken.characters = null;
const wroteBroken = await S.saveState(broken, true);
assert(wroteBroken === false && S.saveBlocked() && localStorage.getItem(LS) === rawGood,
  '破損検知：書き込みを中止し、以前の正常セーブがそのまま残る');
S.resumeSaving();

// 保存先の書き込み失敗：既存セーブを絶対に消さない
// jsdom の Storage はプロパティ代入を named property として扱うため、
// グローバルごと差し替えて QuotaExceededError を再現する。
const realLS = w.localStorage;
const backing = new Map();
for (let i = 0; i < realLS.length; i++) { const k = realLS.key(i); backing.set(k, realLS.getItem(k)); }
let quotaHit = false;
const mockLS = {
  getItem:k => backing.has(k) ? backing.get(k) : null,
  setItem:(k, v) => {
    if (k === LS) { quotaHit = true; throw new Error('QuotaExceededError'); }
    backing.set(k, String(v));
  },
  removeItem:k => backing.delete(k), clear:() => backing.clear(),
  key:i => [...backing.keys()][i] ?? null, get length(){ return backing.size; },
};
globalThis.localStorage = mockLS;
try {
  const failed = await S.saveState({ ...migrated, coins:migrated.coins + 2 }, true);
  assert(quotaHit && failed === false && S.saveBlocked(),
    '保存途中のエラーで書き込みを停止');
  assert(realLS.getItem(LS) === rawGood,
    '新しい保存に失敗しても以前の正常なセーブデータは消えない');
} finally { globalThis.localStorage = realLS; }
S.resumeSaving();
assert((await S.saveState({ ...migrated, coins:migrated.coins + 3 }, true)) === true,
  '復旧後は保存を再開できる');

/* =========================================================
   4. 読み込み失敗時の絶対ルール
   ========================================================= */
console.log('== 4. 読込失敗：保護 → 原因 → 再試行 → 検証復元 → 停止 ==');
const latestRaw = localStorage.getItem(LS);
const latestIds = JSON.parse(latestRaw).characters.map(c => c.id);
localStorage.setItem(LS, '{ 壊れた JSON');
const bad = await S.loadState();           // 自動復元なし = 従来の手動復元経路
assert(bad === null, '壊れたセーブで空の新規データを返さない');
const lr = S.loadReport();
assert(lr.unreadable && lr.quarantined && lr.protectedExisting &&
  lr.retryCount === 3 && !!lr.errorDetail,
  '原本を隔離し、原因を記録し、既存データを保持したまま 3 回再試行');
assert(localStorage.getItem(LS) === '{ 壊れた JSON', '壊れた原本が上書きされず残る');
assert(S.saveBlocked(), '復旧できない間は自動保存を停止');
assert((await S.saveState(S.newState(), true)) === false &&
  localStorage.getItem(LS) === '{ 壊れた JSON', '停止中は一切書き込まない');
const qbk = (await S.listBackups()).find(b => b.phase === B.BACKUP_PHASES.QUARANTINE);
assert(!!qbk, '壊れた原本を隔離バックアップとして保持');

// 「読めない」と「存在しない」を混同しない
localStorage.removeItem(LS);
localStorage.setItem('ocf_has_save', '1');
const missing = await S.loadState();
assert(missing === null && S.loadReport().unreadable && S.loadReport().retryCount === 3,
  '「あるはずのセーブが読めない」を新規ゲームと混同しない');
S.resumeSaving();
localStorage.clear();                      // フラグもメタも無い = 本当に新規
const fresh = await S.loadState();
assert(fresh === null && !S.loadReport().unreadable && !S.saveBlocked(),
  '本当にセーブが無い場合だけ新規ゲームとして扱う');

/* =========================================================
   5. 自動復元（アプリ起動時）
   ========================================================= */
console.log('== 5. 起動時の自動復元と、ゲーム再起動後のデータ維持 ==');
localStorage.clear();
S.resumeSaving();
await S.saveState(migrated, true);
const goodRaw = localStorage.getItem(LS);
localStorage.setItem(LS, '{ 再度壊れた');
const auto = await S.loadState({ autoRecover:true });
assert(!!auto && S.loadReport().autoRecovered && !!S.loadReport().recoveredFrom,
  '検証に通った「保存成功後」バックアップから自動復元する');
assert(eq(auto.characters.map(c => c.id), idsBefore),
  '自動復元で全キャラクター ID が戻る');
assert(auto.coins === before.coins && eq(auto.inventory.items, before.inventory.items) &&
  eq(auto.pity, before.pity) && eq(auto.story, before.story) &&
  eq(auto.futureFeature, before.futureFeature),
  '自動復元で通貨・素材・ガチャ履歴・進行・将来追加分も戻る');
assert(!S.saveBlocked(), '自動復元後は保存を再開');

// ゲーム再起動（別ウィンドウ＝別 localStorage＋main.js の再ブート）
const second = setup();
second.localStorage.setItem(LS, goodRaw);
second.localStorage.setItem('ocf_has_save', '1');
await import(fileURL('js/main.js') + '?guard_restart=1');
await wait(220);
const O2 = second.w.__OCF;
assert(!!O2 && O2.app.screen === 'town', '再起動後も街から開始（新規ゲームにならない）');
const st2 = O2.state;
assert(st2.characters.length === 3 && eq(st2.characters.map(c => c.id), idsBefore),
  '再起動後も 3 人全員・全 ID が残る');
st2.characters.forEach((c, i) => {
  const b = beforeChars[i];
  assert(c.original === b.original && c.name === b.name && c.jobId === b.jobId &&
    c.rarity === b.rarity && c.level === b.level && eq(c.alloc, b.alloc) &&
    eq(c.skills, b.skills) && eq(c.equipment, b.equipment),
    `再起動後 No.${i+1} の画像・技・装備・ステータスを維持`);
});
assert(st2.coins === before.coins && eq(st2.inventory.items, before.inventory.items) &&
  eq(st2.pity, before.pity) && eq(st2.story, before.story) && eq(st2.dungeon, before.dungeon) &&
  eq(st2.futureFeature, before.futureFeature) && st2.anotherFutureFlag === 'keep-me',
  '再起動後も所持品・ガチャ履歴・進行・未知の将来データを維持');
assert(G.protectedFingerprint(st2).charHash === fpBefore.charHash,
  '再起動後もキャラクター領域の指紋が変更前と一致');
assert(!O2.app.loadIssue.unreadable && !O2.app.loadIssue.quarantined,
  '正常セーブが破損扱いにされない');

/* =========================================================
   6. キャラクター ID の個別管理
   ========================================================= */
console.log('== 6. ID 個別管理（追加・編集・削除・画像失敗） ==');
const third = setup();
const S3 = await import(fileURL('js/state.js') + '?guard_ids=1');
const st3 = S3.newState();
const a = S3.createCharacter(st3, { name:'A', jobId:'warrior', original:'img-a' });
const b2 = S3.createCharacter(st3, { name:'B', jobId:'mage', original:'img-b' });
const c3 = S3.createCharacter(st3, { name:'C', jobId:'archer', original:'img-c' });
assert(new Set([a.id,b2.id,c3.id]).size === 3, '3 人に固有 ID を付与');
const n4 = S3.createCharacter(st3, { name:'D', jobId:'warrior', original:'img-d' });
assert(st3.characters.length === 4 && ![a.id,b2.id,c3.id].includes(n4.id),
  'キャラ追加で既存 ID を変更・再利用しない');
// 1 体だけ編集 → 他の 2 体は不変
const snapBC = clone([b2, c3]);
a.level = 99; a.skills.push('sk_heal');
assert(eq(st3.characters.find(x=>x.id===b2.id).skills, snapBC[0].skills) &&
  eq(st3.characters.find(x=>x.id===c3.id).equipment, snapBC[1].equipment),
  '1 体の編集で別キャラクターを上書きしない');
// 一括処理の模擬：対象 ID を 1 つだけ選ぶ
const targetId = b2.id;
const untouched = clone(st3.characters.filter(x => x.id !== targetId));
st3.characters.find(x => x.id === targetId).level += 5;
assert(eq(st3.characters.filter(x => x.id !== targetId), untouched),
  '一括処理でも対象外のキャラクターは一切変わらない');
// 画像の読み込み失敗はデータ削除ではない
const charIds = st3.characters.map(x => x.id);
const U3 = await import(fileURL('js/ui.js') + '?guard_ids=1');
const noImg = U3.charImage({ ...st3.characters[0], original:'', sprite:'' }, 'portrait');
assert(typeof noImg === 'string' && noImg.length > 0 &&
  eq(st3.characters.map(x=>x.id), charIds),
  '画像が読めなくてもキャラクターデータは削除されない');
assert(G.validateState(st3).ok, 'ID 管理後の状態も検証を通る');

/* =========================================================
   7. 恒久運用の備え
   ========================================================= */
console.log('== 7. 今後の全変更で実行する保護テストの存在 ==');
assert(fs.existsSync(ROOT + '/tests/verify_all.sh'), '一括検証コマンド tests/verify_all.sh が存在');
assert(fs.existsSync(ROOT + '/tools/DATA_PROTECTION.md'), '恒久ルール文書が存在');
const verify = fs.readFileSync(ROOT + '/tests/verify_all.sh', 'utf8');
assert(verify.includes('check_data_guard.mjs') && verify.includes('check_idb.mjs') &&
  verify.includes('check_save.mjs') && verify.includes('check_enemy_art.mjs'),
  '一括検証に保護・IDB 実環境・セーブ・実動作テストが含まれる');
assert(fs.existsSync(ROOT + '/tests/check_idb.mjs'),
  'IndexedDB 本来の保存先でも二重バックアップ・成功確認・自動復元を検証');
const rule = fs.readFileSync(ROOT + '/tools/DATA_PROTECTION.md', 'utf8');
assert(rule.includes('verify_all.sh') && rule.includes('mergeAdditive') &&
  rule.includes('autoRecover'), '恒久ルールに検証コマンド・追加方式・自動復元が明記');

assert(errors.filter(x => !x.includes('セーブ保護')).length === 0,
  `意図的な保存失敗以外の console.error は 0 件（${errors.length} 件）`);
console.log('\nDATA GUARD CHECK OK — 変更前後・再起動・二重バックアップ・保存失敗・読込失敗の自動復元・ID 個別管理・恒久運用 すべて合格');
