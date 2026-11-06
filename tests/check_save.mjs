/* セーブ保護・形式移行・バックアップ復元・章報酬の二重防止を検証する。
   実行: node tests/check_save.mjs */
import { setup, assert, fileURL, wait } from './_harness.mjs';

const { localStorage } = setup();
const S = await import(fileURL('js/state.js'));
const T = await import(fileURL('js/story.js'));
const A = await import(fileURL('js/enemyAssets.js'));

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LS = 'ocf_save_v3';

console.log('== 1. 新規ゲーム初期化と既存プレイヤー更新の分離 ==');
const fresh = S.newState();
assert(fresh.version === 8 && fresh.characters.length === 0, 'newState() は VERSION 8 の空状態');
assert(fresh.story.arc.chapter === 1 && fresh.story.arc.phase === 'prologue', '新規は 5 章の初期 arc を持つ');
assert(fresh.dungeon.planVersion === 8, '新規はダンジョン出現計画の版を持つ');
const c = S.createCharacter(fresh, { name:'テスト', jobId:'warrior', weaponType:'剣', original:'data:image/png;base64,AAAA' });
fresh.coins = 54321; fresh.stats.evolutions = 3; fresh.stats.bossKills = 7;
fresh.pity.weapon.history = ['N','R','L']; fresh.pity.weapon.total = 3;
fresh.inventory.items.legend_mat_UR = 2;
fresh.catalog.enemies.push('m3d_angel');        // 旧 3D 登録の図鑑記録 = プレイヤーデータ
fresh.story.seen = [1,2,3]; fresh.story.cleared = [1,2]; fresh.story.chapter = 4;
fresh.hints.rewardClaimed = true;
fresh.tutorial = { rewardClaimed:true, rewardCoins:9000 };
fresh.customLegacyField = 'keep me';
c.level = 42; c.rarity = 'SSR';

const old = JSON.parse(JSON.stringify(fresh));
old.version = 7; delete old.story.arc; delete old.dungeon.planVersion;
// updateExistingSave は渡したオブジェクトを直接補完するため、原本テキストを先に退避
const oldRaw = JSON.stringify(old);
const up = S.updateExistingSave(old);
assert(up.version === 8, '既存セーブを VERSION 8 へ更新');
assert(up.coins === 54321 && up.characters.length === 1 && up.characters[0].level === 42,
  'コイン・キャラクター・レベルを保持');
assert(up.stats.evolutions === 3 && up.stats.bossKills === 7, '育成統計を保持');
assert(eq(up.pity.weapon.history, ['N','R','L']), 'ガチャ履歴を保持');
assert(up.inventory.items.legend_mat_UR === 2, '素材を保持');
assert(up.catalog.enemies.includes('m3d_angel'), '旧敵の図鑑記録（セーブデータ）を削除しない');
assert(eq(up.story.seen, [1,2,3]) && eq(up.story.cleared, [1,2]) && up.story.chapter === 4,
  '旧ストーリー進行を上書き・削除しない');
assert(up.hints.rewardClaimed === true && up.tutorial.rewardCoins === 9000,
  'ヒント報酬と旧チュートリアル欄を保持');
assert(up.customLegacyField === 'keep me', '未知の旧フィールドも保持');
assert(up.story.arc && up.story.arc.chapter === 1 && up.dungeon.planVersion === 8,
  '足りない項目（5章 arc / 出現計画の版）だけ補完');
assert(up.characters[0].statVersion === 2, 'statVersion=2 を二重換算しない');
assert(!S.updateExistingSave.toString().includes('newState('),
  'updateExistingSave() は newState() を呼ばない');

console.log('== 2. 更新前の自動バックアップと移行レポート ==');
localStorage.clear();
localStorage.setItem(LS, oldRaw);
const loaded = await S.loadState();
assert(loaded && loaded.version === 8 && loaded.coins === 54321, '既存セーブを移行して読み込み');
const rep = S.loadReport();
assert(rep.loaded && rep.migrated && rep.fromVersion === 7 && rep.toVersion === 8,
  `移行レポート: ${JSON.stringify(rep)}`);
assert(rep.backupCreated && rep.backupId, '移行前に自動バックアップを作成');
assert(!rep.unreadable && !S.saveBlocked(), '正常セーブでは書き込み禁止にならない');
let bks = await S.listBackups();
const auto = bks.find(b => b.reason === 'アップデート前の自動バックアップ');
assert(!!auto && auto.chars === 1, `自動バックアップを一覧で確認（${bks.length} 件）`);
const manual = await S.backupCurrent(loaded, '手動バックアップ');
assert(!!manual.id, '手動バックアップを作成');
bks = await S.listBackups();
assert(bks.length >= 2, '自動 + 手動の 2 件以上が残る');
const dup = await S.backupCurrent(loaded, '手動バックアップ');
assert(dup.duplicate === true, '同一内容・同一理由のバックアップは重複作成しない');

console.log('== 3. バックアップからの復元 ==');
const restored = await S.restoreBackup(auto.id);
assert(restored.coins === 54321 && restored.characters.length === 1, '復元でプレイヤーデータが戻る');
assert(restored.customLegacyField === 'keep me', '復元でも旧フィールドが残る');
assert(!S.saveBlocked(), '復元後は保存を再開');
const savedRaw = localStorage.getItem(LS);
assert(savedRaw && JSON.parse(savedRaw).version === 8, '復元結果が保存される');

console.log('== 4. 読めないセーブは隔離して上書きしない ==');
localStorage.removeItem(LS);   // バックアップ一覧は残したまま、セーブ本体だけ壊す
localStorage.setItem(LS, '{ this is not json');
const bad = await S.loadState();
assert(bad === null, '壊れたセーブは null（新規状態で上書きしない）');
const badRep = S.loadReport();
assert(badRep.unreadable && badRep.quarantined && badRep.backupCreated,
  `隔離レポート: ${JSON.stringify(badRep)}`);
assert(S.saveBlocked(), '自動保存を停止');
const before = localStorage.getItem(LS);
const wrote = await S.saveState(S.newState(), true);
assert(wrote === false && localStorage.getItem(LS) === before,
  '保護中は書き込まず、壊れた原本がそのまま残る');
const bks2 = await S.listBackups();
const quarantined = bks2.find(b => b.reason.startsWith('読込失敗セーブの隔離'));
assert(!!quarantined, '原本バイト列を隔離バックアップとして保持');
let rejected = false;
try { await S.restoreBackup(quarantined.id); } catch (e) { rejected = /JSON/.test(e.message); }
assert(rejected, '隔離された壊れた原本はパースせず復元を拒否');
const goodId = bks.find(b => b.reason === 'アップデート前の自動バックアップ').id;
const recovered = await S.restoreBackup(goodId);
assert(recovered.coins === 54321 && !S.saveBlocked(), '正常なバックアップから復元して保護解除');

console.log('== 5. ファイル読み込みは「既存更新」経路だけ ==');
const imported = S.importSave(oldRaw);
assert(imported.version === 8 && imported.coins === 54321 && imported.story.chapter === 4,
  'importSave() も既存データを保持したまま補完');
assert(!S.saveBlocked(), '正常な読み込みで保護解除');

console.log('== 6. 5 章クリア報酬の確定付与と二重防止 ==');
const st = S.newState();
const clearChapter = (ch) => {
  S.storySelectChapter(st, ch.id);
  let guard = 0;
  while (st.story.arc.phase !== 'done' && guard++ < 120) {
    const arc = st.story.arc;
    if (['prologue','twist','epilogue'].includes(arc.phase)) S.storyNextScene(st, ch.id);
    else if (arc.phase === 'stages') S.completeStoryStage(st, ch.id, arc.stage, true);
    else break;
  }
  return st.story.arc.phase === 'done';
};
for (const ch of T.STORY_CHAPTERS) {
  const unlocked = S.storyChapterUnlocked(st, ch.id);
  assert(unlocked, `${ch.rank}章が解放されている（前章クリア）`);
  assert(clearChapter(ch), `${ch.rank}章「${ch.title}」をプロローグ→全ステージ→転→エピローグ→クリア`);
  assert(st.story.arc.cleared.includes(ch.id), `${ch.rank}章クリアが保存される`);
  const beforeCoins = st.coins;
  const beforeItems = JSON.parse(JSON.stringify(st.inventory.items));
  const r1 = S.claimStoryReward(st, ch.id);
  const r2 = S.claimStoryReward(st, ch.id);
  assert(r1.ok && !r2.ok, `${ch.rank}章の報酬は 1 回だけ（2 回目: ${r2.msg}）`);
  assert(st.coins - beforeCoins === T.storyRewardCoins(ch), `${ch.rank}章の進化コインが過不足なく 1 回分`);
  const expected = T.storyRewardMaterials(ch);
  assert(expected.every(m => (st.inventory.items[m.id] || 0) - (beforeItems[m.id] || 0) === m.n),
    `${ch.rank}章の素材が必要数だけ 1 回付与`);
  assert(st.story.arc.claimed.filter(x => x === ch.id).length === 1, '受取 ID は 1 つだけ保存');
  assert(eq(r1.mats, expected), '付与内訳が必要素材リストと完全一致');
}
const integ = T.storyIntegrity();
assert(integ.chapters === 5 && integ.rewardCoversFullEvolution && integ.exactPerChapter,
  '全章の報酬で R→LR の進化素材が確実に揃う');
assert(Object.entries(integ.rewardCounts).every(([id, n]) => (st.inventory.items[id] || 0) >= n),
  '実際の所持数が必要数以上（1 キャラ分以上）');
assert(S.storyChapterUnlocked(st, 'ch5') && st.story.arc.cleared.length === 5,
  '5 章すべてクリア済みとして保存');

console.log('== 7. 特徴・強さ別ダンジョンと敵の専用技 ==');
let bossCount = 0;
for (let f = 1; f <= 30; f++) {
  const en = S.dungeonEnemy(st, f, false);
  assert(!!A.ENEMY_KIND[en.artId] && !!A.ENEMY_KIND[en.artId].move, `${f} 階の敵が Drive 登録済みで専用技を持つ`);
  if (f % 5 === 0) { assert(en.boss === true, `${f} 階は階層ボス`); bossCount++; }
}
assert(bossCount === 6, '30 階中 6 回の階層ボス');
assert(S.dungeonBandInfo(1).tier === 0 && S.dungeonBandInfo(25).tier === 4,
  '第1帯→第5帯で特徴・強さの段階が上がる');
assert(S.dungeonEnemy(st, 10, true).mul > S.dungeonEnemy(st, 10, false).mul,
  '高難易度ほど敵が強い');
assert(S.storyStageEnemy('ch1', 0).artId === 'goblin_club', '章ステージの敵も Drive 素材');

console.log('\nSAVE / STORY / DUNGEON CHECK OK — 保護・移行・復元・二重防止・出現設計すべて合格');
