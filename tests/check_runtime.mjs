/* jsdom による実アプリの起動・全画面描画・UI アクション・戦闘・演出の検証。
   実行: node tests/check_runtime.mjs */
import fs from 'node:fs';
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const { w, document, localStorage } = setup();
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
process.on('unhandledRejection', e => errors.push('rejection ' + (e?.stack || e)));

await import(fileURL('js/main.js'));
await wait(180);
const O = w.__OCF;
const { app, S, D, P, EA, STORY, ASSETS } = O;
const q = s => document.querySelector(s);
const qa = s => [...document.querySelectorAll(s)];
const U = await import(fileURL('js/ui.js'));
const { Battle } = await import(fileURL('js/battle.js'));

console.log('== 1. 起動とデータ整合性 ==');
assert(!!O && app.screen === 'title', 'アプリが起動してタイトル画面');
assert(D.VERSION === 8 && D.ENEMIES.length === 67, `VERSION 8 / CPU 67 体（実際 ${D.VERSION}/${D.ENEMIES.length}）`);
assert(D.ENEMIES.every(en => en.artId && !en.model3d), '全 CPU が Drive 素材を参照し 3D 登録は 0 件');
assert(ASSETS.files.length === 180 && ASSETS.kinds.length === 36 && ASSETS.unreadable.length === 0,
  'Drive 全 180 ファイル / 36 敵 / 読込失敗 0 件');
assert(STORY.chapters.length === 5 && STORY.integrity().rewardCoversFullEvolution,
  '5 章とランクアップ報酬の整合性');
assert(Array.isArray(app.backups) && !!app.loadIssue, '起動時にバックアップ一覧と読込レポートを保持');
assert(!!O.CREATOR && O.CREATOR.report().open === false,
  '製作者ツールは起動時点では非表示（通常プレイに影響しない）');
assert(document.querySelectorAll('#creator-layer').length === 1 &&
  document.getElementById('creator-layer').classList.contains('creator-hidden'),
  '製作者ツールのオーバーレイは #app 外に 1 つだけ・非表示');
O.state.settings.sfx = false;
O.state.settings.animSpeed = 3;

console.log('== 2. 全画面の描画（undefined / NaN なし） ==');
const st = O.state;
st.coins = 999999;
const c = S.createCharacter(st, {
  name:'アオイ', jobId:'warrior', weaponType:'剣', styleId:'balanced',
  original:'data:image/png;base64,AAAA',
});
for (const m of ['evo_stone_R','awaken_crystal_R','weapon_ore_R','mana_crystal_SR']) S.addItem(st, m, 3);
const draft = { settings:S.defaultImageSettings(), original:'data:image/png;base64,AAAA',
  sprite:'data:image/png;base64,AAAA', name:'アオイ', jobId:'warrior', weaponType:'剣',
  styleId:'balanced', frame:'gold' };
const look = { charId:c.id, settings:S.defaultImageSettings(),
  original:'data:image/png;base64,AAAA', sprite:'data:image/png;base64,AAAA' };
const battle = new Battle({ state:st, char:c, enemy:S.storyStageEnemy('ch1',0), mode:'story',
  onChange:()=>{}, onFx:()=>{}, onEnd:()=>{} });
battle.ultimateGauge = 100;
const result = { won:true, turns:3, damage:1200, taken:200, mode:'story', floor:0,
  enemy:S.storyStageEnemy('ch1',0), rewards:{ coins:100, exp:100, levels:0, bp:10, rp:10, streak:1, materials:[] },
  storyProgress:{ ok:true, msg:'通常戦 突破（1/4）' } };
const screens = [];
for (const f of D.FACILITIES) for (let t = 0; t < f.tabs.length; t++) {
  screens.push(['facility', { params:{ facility:f.id }, tabs:{ [f.id]:t } }]);
}
for (let t = 0; t <= 7; t++) screens.push(['codex', { codexTab:t }]);
for (const scr of ['town','story','gather','help','hints','character','skillCheck','endgame','settings']) screens.push([scr, {}]);
screens.push(['story', { storyChapter:'ch1' }], ['story', { storyChapter:'ch3' }]);
screens.push(['create', { draft }], ['appearance', { look }]);
screens.push(['battle', { battle }], ['result', { result }]);
let bad = 0, allActions = new Set();
for (const [scr, extra] of screens) {
  Object.assign(app, { screen:scr, ...extra });
  const html = U.renderScreen(app, st);
  for (const tok of ['undefined','NaN','[object Object]']) {
    if (html.includes(tok)) { origError('BAD', scr, JSON.stringify(extra.codexTab ?? extra.tabs ?? ''), tok); bad++; }
  }
  for (const m of html.matchAll(/data-action="([A-Za-z0-9_]+)"/g)) allActions.add(m[1]);
}
assert(bad === 0, `${screens.length} 画面に undefined / NaN / [object Object] なし`);
const mainSrc = fs.readFileSync(ROOT + '/js/main.js', 'utf8');
const cases = new Set([...mainSrc.matchAll(/case '([A-Za-z0-9_]+)':/g)].map(m => m[1]));
const missing = [...allActions].filter(a => !cases.has(a));
assert(missing.length === 0, `描画された ${allActions.size} アクションすべてにハンドラ（欠落 ${JSON.stringify(missing)}）`);
const skillHtml = U.renderScreen({ ...app, screen:'skillCheck', skillDetail:'sk_fire_slash' }, st);
assert(skillHtml.includes('攻撃力：') && skillHtml.includes('MP：') &&
  skillHtml.includes('skill-detail-modal') && skillHtml.includes('AUTO 戦闘で使用する技'),
  '技確認画面・詳細モーダルが共通の攻撃力 / MP を描画');

console.log('== 3. Drive PNG の表示ホストと正直なレポート ==');
Object.assign(app, { screen:'facility', params:{ facility:'guild' }, tabs:{ guild:0 }, battle:null, result:null, storyChapter:null });
await O.navigate('facility', { facility:'guild', tab:0 });
assert(qa('.enemy-art').length > 0 && qa('.enemy-art-img').length > 0, 'ギルド一覧に Drive PNG ホスト');
EA.syncEnemyArt();
const rep = EA.enemyArtReport();
assert(rep.kind.includes('静止2D') && rep.models3d === 0 && rep.animationClips === 0,
  `3D/アニメを装わないレポート: ${JSON.stringify({kind:rep.kind,models3d:rep.models3d,clips:rep.animationClips})}`);
assert(rep.hosts > 0 && rep.loaded > 0 && rep.failed === 0,
  `実画像ホスト ${rep.hosts} / 読込成功 ${rep.loaded} / 失敗 ${rep.failed}`);
EA.playEnemyArt('attack', ASSETS.kinds[0].move);
assert(qa('.enemy-move-fx').length > 0, '専用技の CSS エフェクトが #fx-layer に生成される');
EA.playEnemyArt('damage');
assert(qa('.enemy-art.art-hit').length > 0, '被弾モーションのクラスが付与される');

console.log('== 4. タイトル → 街 → 5 章ストーリー ==');
Object.assign(app, { screen:'title', params:{}, tabs:{}, battle:null, result:null, storyChapter:null });
await O.handleAction('titleStart');
assert(app.screen === 'town', 'ゲームスタートで街ホームへ');
await O.navigate('story');
assert(qa('.story-chapter').length === 5, '5 章の一覧が表示される');
await O.handleAction('storyOpen', { id:'ch1' });
assert(app.storyChapter === 'ch1' && q('.story-detail'), '第1章を開く');
assert(qa('.story-scene').length === 1, 'プロローグの導入シーン');
for (let i = 0; i < 3; i++) await O.handleAction('storyNext', { id:'ch1' });
assert(O.state.story.arc.phase === 'stages' && qa('.stage-card').length === 4,
  '導入 → 4 ステージ構成へ（章固有の構成）');
await O.handleAction('storyStage', { id:'ch1', stage:'0' });
assert(app.screen === 'battle' && !!app.battle, 'ステージから戦闘開始');
assert(!!app.battle.enemyMoveSkill && app.battle.enemyMoveSkill.name.length > 0,
  '敵ごとの専用技が戦闘に登録される');
assert(qa('.combat-sprite .enemy-art').length > 0, '戦闘画面にも Drive PNG');
await app.battle.finish(true);
await wait(30);
assert(app.screen === 'result' && app.result?.storyProgress?.ok, '勝利で章ステージが 1 つ進む');
assert(O.state.story.arc.stage === 1, 'ステージ進行がセーブ対象の state に反映');
await O.navigate('story');
assert(qa('.stage-card.done').length === 1, '突破済みステージが表示される');
// 残りステージとエピローグを進めて章を確定
const ch1 = STORY.chapters[0];
let guard = 0;
while (O.state.story.arc.phase !== 'done' && guard++ < 40) {
  const arc = O.state.story.arc;
  if (['prologue','twist','epilogue'].includes(arc.phase)) await O.handleAction('storyNext', { id:'ch1' });
  else if (arc.phase === 'stages') S.completeStoryStage(O.state, 'ch1', arc.stage, true);
}
assert(O.state.story.arc.cleared.includes('ch1') && O.state.story.arc.phase === 'done', '第1章クリアが保存される');
const beforeCoins = O.state.coins;
await O.handleAction('storyClaim', { id:'ch1' });
assert(O.state.story.arc.claimed.includes('ch1'), '報酬受取が保存される');
assert(O.state.coins - beforeCoins === 2500, '進化コインが 1 回分だけ付与');
const r2 = S.claimStoryReward(O.state, 'ch1');
assert(!r2.ok, '同じ章の報酬は二度受け取れない');

console.log('== 5. 専用技の実発動とエフェクト ==');
const fxEvents = [];
const fxState = S.newState();
const fxChar = S.createCharacter(fxState, { name:'FX', jobId:'warrior', weaponType:'剣', original:'data:image/png;base64,AAAA' });
fxState.settings.animSpeed = 3;
const fxBattle = new Battle({ state:fxState, char:fxChar, enemy:S.storyStageEnemy('ch1',0), mode:'cpu',
  onChange:()=>{}, onFx:o=>fxEvents.push(o), onEnd:()=>{} });
// 命中判定の乱数を固定して、まれな回避でテストが揺れないようにする（ゲーム側は無変更）
const origRandom = Math.random;
Math.random = () => 0.01;
try {
  await fxBattle.resolveAction(fxBattle.enemy, fxBattle.player, fxBattle.enemyMoveSkill);
} finally { Math.random = origRandom; }
assert(fxEvents.some(o => o.type === 'skill' && o.move && o.move.id), '専用技の発動で move 情報が FX に渡る');
assert(fxBattle.logs.some(l => l.text.includes('専用技発動')), '専用技がバトルログに記録される');
assert(fxBattle.player.hp < fxBattle.player.maxHp, '専用技が実際にダメージを与える');

console.log('== 6. バックアップ UI / 復元 / ダンジョン ==');
await O.navigate('settings');
assert(qa('.backup-list').length === 1, '設定画面にバックアップ一覧');
await O.handleAction('backupCreate');
assert(app.backups.length >= 1, '手動バックアップが一覧に反映');
assert(qa('.backup-row').length >= 1, 'バックアップ行が描画される');
const bkId = app.backups[0].id;
await O.handleAction('backupRestore', { id:bkId });
assert(app.screen === 'town' && app.loadIssue.restoredFrom === bkId, 'UI からバックアップを復元');
await O.handleAction('nav', { to:'facility', facility:'guild', tab:'1' });
assert(qa('.band-row').length === 5, 'ダンジョンに 5 つの特徴・強さの帯を表示');
await O.handleAction('dungeonStart', { hard:'0' });
assert(app.screen === 'battle' && app.battle.mode === 'dungeon', 'ダンジョン戦が開始する');
assert(!!ASSETS.kinds.find(k => k.id === app.battle.enemyDef.artId), 'ダンジョンの敵も Drive 登録済み');

console.log('== 7. アセット台帳 UI ==');
await O.navigate('codex', { codexTab:7 });
assert(qa('.asset-kind').length === 36 && qa('.asset-file').length > 0, '36 敵と割り当てファイルを閲覧可能');
await O.handleAction('assetEnemy', { id:'greater_both' });
assert(app.assetEnemy === 'greater_both' && qa('.asset-preview .enemy-art').length === 1, '敵を切り替えて代表画像を表示');
await O.handleAction('enemyVariant', { variant:'1' });
assert(app.enemyVariant === 1, '色違いバリエーションを切り替え');

assert(errors.length === 0, `console.error / unhandledRejection 0 件（実際 ${errors.length}: ${errors.slice(0,2).join(' | ')}）`);
console.log('\nRUNTIME CHECK OK — 起動・全画面・5章・戦闘・演出・バックアップ・台帳すべて合格');
