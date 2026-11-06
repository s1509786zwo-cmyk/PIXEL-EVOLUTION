/* 技情報（技名 / 攻撃力 / 消費MP / 詳細）の全画面・全データ検証。
   実行: node tests/check_skill_info.mjs

   検証項目：
   ・js/skillInfo.js が SKILLS 全 161 件の威力・MP を parts / sk.mp から正しく導出
   ・top-level sk.power が 0 の特殊技・奥義でも戦闘で使う parts.power と一致
   ・実際の Battle.resolveAction() が使う part.power と消費 MP が表示値と一致
   ・回復技は「回復量」、補助技は「効果」、MP 0 の技は「MP：0」
   ・予測ダメージは技固有の威力と区別され、攻撃力・防御力に連動する
   ・全技選択 / 確認画面（習得済み・新規習得・覚醒・練習・詳細・図鑑・交換・
     進化・戦闘前・CPU カード・ストーリー・戦闘中・技詳細・AUTO・通常攻撃）
     で同じ共通バッジが出ること
   ・ⓘ クリック／タップで詳細モーダルが開き、効果・対象・追加効果が読めること
   ・既存の技威力・MP・習得条件・戦闘計算・セーブを一切変更していないこと
*/
import fs from 'node:fs';
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const { w, document, localStorage } = setup();
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
process.on('unhandledRejection', e => errors.push('rejection ' + (e?.stack || e)));

await import(fileURL('js/main.js') + '?skillinfo=1');
await wait(180);
const O = w.__OCF;
const { app, S, D } = O;
const SI = await import(fileURL('js/skillInfo.js'));
const { Battle } = await import(fileURL('js/battle.js'));
await import(fileURL('js/ui.js'));

const qa = s => [...document.querySelectorAll(s)];
const q = s => document.querySelector(s);
const html = () => document.getElementById('app').innerHTML;
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const badgeOf = sk => SI.skillBadge(sk).replace(/<[^>]*>/g, '');
const fmt = n => Math.round(n).toLocaleString('ja-JP');

/* =========================================================
   1. 全技データの導出が実際のゲームデータと一致するか
   ========================================================= */
console.log('== 1. 全 161 技の威力・MP を parts / sk.mp から導出 ==');
assert(D.SKILLS.length === 161 && D.VERSION === 8, 'SKILLS 161 件 / VERSION 8（データ据え置き）');

const damagePower = sk => {
  const parts = (sk.parts && sk.parts.length) ? sk.parts
    : [{ op:'damage', power:Number(sk.power) || 100, hits:1 }];
  return parts.filter(p => p.op === 'damage' || p.op === 'summon')
    .reduce((a, p) => a + (Number(p.power) || (p.op === 'summon' ? 120 : 100))
      * Math.max(1, Number(p.hits) || 1), 0);
};
const healPower = sk => {
  const parts = (sk.parts && sk.parts.length) ? sk.parts : [];
  return parts.filter(p => p.op === 'heal').reduce((a, p) => a + (Number(p.power) || 100), 0);
};
const badPower = [], badMp = [], badLabel = [];
for (const sk of D.SKILLS) {
  const i = SI.skillInfo(sk);
  if (i.power !== damagePower(sk)) badPower.push(`${sk.id}:${i.power}/${damagePower(sk)}`);
  if (i.heal !== healPower(sk)) badPower.push(`${sk.id}:heal${i.heal}/${healPower(sk)}`);
  if (i.mp !== (Number(sk.mp) || 0)) badMp.push(`${sk.id}:${i.mp}/${sk.mp}`);
  const b = badgeOf(sk);
  if (!b.includes(`MP：${fmt(sk.mp || 0)}`)) badLabel.push(`${sk.id}:MP`);
  if (i.kind === 'attack' && !b.includes(`攻撃力：${fmt(i.power)}`)) badLabel.push(`${sk.id}:pow`);
  if (i.kind === 'heal' && !b.includes(`回復量：${fmt(i.heal)}`)) badLabel.push(`${sk.id}:heal`);
  if (i.kind === 'support' && (!b.includes('効果：') || b.includes('攻撃力：')))
    badLabel.push(`${sk.id}:support`);
}
assert(badPower.length === 0, `全技の攻撃力 / 回復量 = parts.power × hits（不一致 ${badPower.slice(0,3)}）`);
assert(badMp.length === 0, `全技の消費MP = sk.mp（不一致 ${badMp.slice(0,3)}）`);
assert(badLabel.length === 0, `全技のバッジ書式が正しい（不一致 ${badLabel.slice(0,3)}）`);

const zeroTop = D.SKILLS.filter(sk => !sk.power && damagePower(sk) > 0);
assert(zeroTop.length > 0, `top-level power:0 の特殊技・奥義が ${zeroTop.length} 件ある`);
assert(zeroTop.every(sk => SI.skillInfo(sk).power === damagePower(sk) && SI.skillInfo(sk).power > 0),
  'sk.power が 0 でも parts から戦闘実際値を表示（ダミー 0 を出さない）');
const zeroMp = D.SKILLS.filter(sk => !sk.mp);
assert(zeroMp.every(sk => badgeOf(sk).includes('MP：0')),
  `消費 MP 0 の技 ${zeroMp.length} 件すべて「MP：0」と明示`);
const healSkills = D.SKILLS.filter(sk => healPower(sk) > 0 && damagePower(sk) === 0);
assert(healSkills.length > 0 && healSkills.every(sk => {
  const b = badgeOf(sk); return b.includes('回復量：') && !b.includes('攻撃力：');
}), `回復技 ${healSkills.length} 件は「回復量」を使い「攻撃力」は出さない`);
const supportSkills = D.SKILLS.filter(sk => !SI.skillInfo(sk).power && !SI.skillInfo(sk).heal);
assert(supportSkills.length > 0 && supportSkills.every(sk => {
  const b = badgeOf(sk); return b.includes('効果：') && !b.includes('攻撃力：');
}), `補助技 ${supportSkills.length} 件は攻撃力の代わりに効果量を表示`);
const multi = SI.skillInfo(D.SKILL.sk_double);
assert(multi.hits === 2 && multi.power === 124 && multi.targetText.includes('2連撃'),
  '連撃技は合計威力・連撃数・対象を区別して表示');
assert(SI.skillInfo(D.SKILL.sk_heal).targetText === '自分' &&
  SI.skillInfo(D.SKILL.sk_fire_slash).targetText === '敵単体' &&
  SI.skillInfo(D.SKILL.sk_secret).targetText.includes('敵単体・自分'),
  '単体 / 自分 / 複合の攻撃対象を正しく判定');
const areaSkill = D.SKILLS.find(sk => sk.cat === '範囲攻撃');
assert(SI.skillInfo(areaSkill).targetText.includes('敵単体') &&
  SI.skillInfo(areaSkill).targetText.includes('範囲攻撃') &&
  SI.skillInfo(areaSkill).effects.some(x => x.includes('敵 1 体')),
  '「範囲攻撃」種別も対象は 敵単体（戦闘計算どおり）と正直に表示');
assert(badgeOf(D.SKILL.sk_mpcharge).includes('攻撃力：40') &&
  badgeOf(D.SKILL.sk_mpcharge).includes('MP：0'),
  '攻撃技でも消費 MP 0 なら「MP：0」');
assert(SI.skillInfo(D.SKILL.sk_ultimate).hits === 5 &&
  badgeOf(D.SKILL.sk_ultimate).includes('攻撃力：390'),
  '奥義の 5 連撃も parts の合計威力 390 を表示（top-level power 0 ではない）');
const basic = SI.skillInfo(SI.BASIC_ATTACK);
assert(basic.power === 100 && basic.mp === 0 && badgeOf(SI.BASIC_ATTACK).includes('MP：0'),
  '通常攻撃は battle.js の basicAttack() と同じ 攻撃力100 / MP：0');
const mv = SI.resolveSkill('mv_imp');
assert(!!mv && SI.skillInfo(mv).power === 192 && SI.skillInfo(mv).mp === 0,
  '敵の専用技も buildEnemyMoveSkill() と同じ威力・MP を表示');

/* =========================================================
   2. 実際の戦闘計算が使う威力・消費MP と一致するか
   ========================================================= */
console.log('== 2. 実戦闘の part.power / MP 消費と表示値の一致 ==');
const st = S.newState();
st.settings.sfx = false;
const c = S.createCharacter(st, { name:'技確認', jobId:D.JOBS[0].id,
  original:'data:image/png;base64,AAAA' });
c.level = 30;
const sample = ['sk_fire_slash','sk_double','sk_heal','sk_charge','sk_secret','sk_awaken1',
  'sk_ultimate','sk_summon_ph','sk_mpcharge','sk_focus'];
const origRandom = Math.random;
Math.random = () => 0.01;                 // 命中・状態異常の乱数を固定
try {
  for (const id of [...sample]) {
    const sk = id === '__attack' ? SI.BASIC_ATTACK : D.SKILL[id];
    const b = new Battle({ state:st, char:c, enemy:S.storyStageEnemy('ch1', 0), mode:'cpu',
      onChange:()=>{}, onFx:()=>{}, onEnd:()=>{} });
    b.delay = async () => {};
    b.changed = () => {};
    b.player.mp = 9999; b.player.maxMp = 9999;
    const used = [];
    b.dealDamage = (at, de, part) => { used.push(Number(part.power) || 100); return 0; };
    const before = b.player.mp;
    await b.resolveAction(b.player, b.enemy, sk);
    const realPower = used.reduce((a, x) => a + x, 0);
    const i = SI.skillInfo(sk);
    assert(i.power === realPower, `「${sk.name}」表示 攻撃力 ${i.power} = 戦闘が使う part.power 合計 ${realPower}`);
    assert(before - b.player.mp === i.mp && i.mp === (sk.mp || 0),
      `「${sk.name}」表示 MP ${i.mp} = 実際に消費された MP ${before - b.player.mp}`);
  }
} finally { Math.random = origRandom; }
// 敵の専用技も同じく
{
  const b = new Battle({ state:st, char:c, enemy:S.storyStageEnemy('ch1', 0), mode:'cpu',
    onChange:()=>{}, onFx:()=>{}, onEnd:()=>{} });
  b.delay = async () => {}; b.changed = () => {};
  const used = [];
  b.dealDamage = (at, de, part) => { used.push(Number(part.power) || 100); return 0; };
  await b.resolveAction(b.enemy, b.player, b.enemyMoveSkill);
  assert(used.length > 0 && SI.skillInfo(b.enemyMoveSkill).power ===
    used.reduce((a, x) => a + x, 0),
    '敵専用技の表示攻撃力も実戦闘の威力と一致');
  assert(SI.skillInfo(b.enemyMoveSkill).mp === 0, '敵専用技は MP：0');
}

/* =========================================================
   3. 予測ダメージは技固有の威力と別で、攻撃力・防御力に連動
   ========================================================= */
console.log('== 3. 予測ダメージと技固有の威力の区別 ==');
const fire = D.SKILL.sk_fire_slash;
const p1 = SI.predictDamage(fire, { atk:100, def:0 });
const p2 = SI.predictDamage(fire, { atk:200, def:0 });
const p3 = SI.predictDamage(fire, { atk:200, def:200 });
const p4 = SI.predictDamage(fire, { atk:200, def:0, mastery:10 });
assert(p2 === p1 * 2 && p3 < p2 && p4 > p2,
  `予測ダメージは攻撃力↑で増加・防御力↑で減少・熟練度↑で増加（${p1}/${p2}/${p3}/${p4}）`);
assert(SI.skillInfo(fire).power === damagePower(fire) &&
  badgeOf(fire).includes(`攻撃力：${fmt(damagePower(fire))}`),
  '技固有の威力は戦闘状態に関係なく一定（予測ダメージと別に表示）');
assert(SI.predictDamage(D.SKILL.sk_heal, { atk:100, def:0 }) === null,
  '回復技に攻撃ダメージの予測は出さない');
assert(SI.skillForecastHTML(fire, { atk:120, def:40, label:'テスト相手' }).includes('予測ダメージ'),
  '予測ダメージの表示行が生成される');

/* =========================================================
   4. アプリのセーブに技を登録して全画面を描画
   ========================================================= */
console.log('== 4. 全技選択 / 確認画面の共通バッジ ==');
const state = O.state;
state.settings.sfx = false;
state.home.started = true;
const hero = S.createCharacter(state, { name:'技テスト', jobId:D.JOBS[0].id,
  original:'data:image/png;base64,HERO' });
hero.level = 40;
const owned = ['sk_fire_slash','sk_double','sk_heal','sk_charge','sk_awaken1','sk_secret','sk_focus'];
hero.skills = owned.map(id => ({ id, mastery:0, learnedAt:'2020-01-01T00:00:00.000Z' }));
hero.equippedSkills = owned.slice(0, 8);
const ultId = D.JOB_ULTIMATE.warrior;
hero.ultimateSkills = [ultId];
hero.skills.push({ id:ultId, mastery:0, learnedAt:'2020-01-01T00:00:00.000Z' });
state.catalog.skills = D.SKILLS.map(sk => sk.id);
state.activeId = hero.id;

const go = async (screen, params = {}) => { await O.navigate(screen, params); await wait(2); };
const checkBadge = (label, scope, sk) => {
  const root = q(scope);
  assert(!!root, `${label}：${scope} が描画されている`);
  const t = txt(root);
  const i = SI.skillInfo(sk);
  assert(t.includes(sk.name), `${label}：技名「${sk.name}」`);
  assert(t.includes(`MP：${fmt(i.mp)}`), `${label}：消費MP「MP：${fmt(i.mp)}」`);
  if (i.power > 0) assert(t.includes(`攻撃力：${fmt(i.power)}`),
    `${label}：攻撃力「攻撃力：${fmt(i.power)}」`);
  if (i.heal > 0) assert(t.includes(`回復量：${fmt(i.heal)}`),
    `${label}：回復量「回復量：${fmt(i.heal)}」`);
  if (i.power === 0 && i.heal === 0) assert(t.includes('効果：'), `${label}：補助技の効果`);
};

// 4-1. キャラ詳細の習得技チップ
await go('character');
assert(qa('.chip.skill-chip').length === hero.skills.length,
  `キャラ詳細の ${hero.skills.length} 個の技チップが全部クリック可能`);
const fireChip = qa('.chip.skill-chip').find(x => txt(x).includes('フレイムスラッシュ'));
assert(!!fireChip && txt(fireChip).includes('フレイムスラッシュ') &&
  txt(fireChip).includes('攻撃力：72') && txt(fireChip).includes('MP：3'),
  'キャラ詳細：技名のすぐ横に「攻撃力：72 / MP：3」');
const healChip = qa('.chip.skill-chip').find(x => txt(x).includes('ヒール'));
assert(txt(healChip).includes('回復量：95') && txt(healChip).includes('MP：8') &&
  !txt(healChip).includes('攻撃力：'), 'キャラ詳細の回復技は回復量 / MP');
const zeroChip = qa('.chip.skill-chip').find(x => txt(x).includes('チャージ'));
assert(txt(zeroChip).includes('MP：0') && txt(zeroChip).includes('効果：'),
  'キャラ詳細の MP 0 補助技は「効果 / MP：0」');

// 4-2. 技図鑑（未習得は ??? のまま・習得済みだけ数値）
await go('codex', { codexTab:1 });
const codexFire = qa('.codex-skill').find(x => txt(x).includes('フレイムスラッシュ'));
assert(!!codexFire && txt(codexFire).includes('攻撃力：72') && txt(codexFire).includes('MP：3'),
  '技図鑑も同じ書式（攻撃力 / MP）');
assert(qa('.codex-skill .skill-metrics').length === D.SKILLS.length,
  `技図鑑の全 ${qa('.codex-skill .skill-metrics').length} 技が共通バッジ（未習得は名前のみ ??? のまま）`);
assert(qa('.codex-skill.unknown .skill-metrics').length > 0,
  '未習得の技にも実際の技データ由来の攻撃力 / MP を表示');

// 4-3. 育成の間 → 技（習得済み一覧・新規習得一覧・習得完了の確認）
await go('facility', { facility:'nurture', tab:2 });
const lines2 = qa('.skill-line');
assert(lines2.length > 5 && lines2.filter(x => x.querySelector('.skill-metrics')).length === lines2.length,
  `育成「技」の ${lines2.length} 行すべてに技名の横のバッジ`);
checkBadge('習得済みの技', '.skill-list', D.SKILL.sk_fire_slash);
assert(txt(q('.skill-list')).includes('MP：0'), '習得済み一覧にも MP 0 の技を明示');
assert(!txt(q('.skill-list')).includes('威力72') && !txt(q('.skill-list')).includes('威力0'),
  '画面側の旧「威力」直書きは撤去され「攻撃力」に統一');
assert(qa('[data-action="skillInfo"]').length > 0,
  '習得済み・新規習得の各行に ⓘ 詳細ボタン');

// 4-4. 覚醒で解放される技
await go('facility', { facility:'nurture', tab:3 });
checkBadge('覚醒で解放される技', '.skill-list', D.SKILL.sk_awaken1);
assert(qa('.skill-line .skill-metrics').length >= 6,
  '覚醒技 6 種すべてに攻撃力 / MP');

// 4-5. 修行場 → 技の練習
await go('facility', { facility:'training', tab:1 });
checkBadge('技の練習', '.skill-list.wide', D.SKILL.sk_fire_slash);
assert(qa('.skill-line .skill-metrics').length === hero.skills.length,
  '練習画面の全技に攻撃力 / MP');

// 4-6. 育成の間 → 進化（解放技・進化結果）
await go('facility', { facility:'nurture', tab:4 });
assert(txt(q('.evo-screen')).includes('攻撃力：') && txt(q('.evo-screen')).includes('MP：'),
  '進化条件の「解放技」にも攻撃力 / MP');
const evoSkill = D.EVOLUTION_RULES[0].skill;
assert(txt(q('.evo-screen')).includes(`MP：${fmt(D.SKILL[evoSkill].mp || 0)}`),
  '進化で解放される技の MP が実際の技データと一致');

// 4-7. 交換所の覚醒技
await go('facility', { facility:'guild', tab:3 });
const exLine = qa('.ex-line').find(x => txt(x).includes('覚醒技・光翼裂斬'));
assert(!!exLine && txt(exLine).includes('攻撃力：210') && txt(exLine).includes('MP：30'),
  '技の習得・交換所にも同じ書式（攻撃力：210 / MP：30）');

// 4-8. 戦闘前の CPU カード（専用技・所持技）
await go('facility', { facility:'guild', tab:0 });
assert(txt(q('.enemy-move')).includes('攻撃力：') && txt(q('.enemy-move')).includes('MP：0'),
  'CPU カードの専用技（戦闘前の技確認）にも攻撃力 / MP：0');
assert(qa('.enemy-skill-chip').length > 0 &&
  qa('.enemy-skill-chip').every(x => txt(x).includes('MP：')),
  'CPU カードの所持技チップにも攻撃力 / MP');

// 4-9. ストーリーのステージ（戦闘前）
state.story.arc = { chapter:1, scene:0, stage:0, phase:'stages', twistSeen:false,
  cleared:[], claimed:[], seen:[], lastReward:null, lastStage:null };
app.storyChapter = 'ch1';
await go('story');
assert(qa('.stage-card').length > 0 &&
  qa('.stage-card').every(x => txt(x).includes('攻撃力：') && txt(x).includes('MP：0')),
  'ストーリー各ステージの専用技にも攻撃力 / MP：0');

// 4-10. 戦闘前の技確認 / AUTO 使用技の専用画面
await go('skillCheck');
assert(q('.skill-check-page'), '技確認の専用画面が描画される');
assert(qa('.skill-info-line').length >= hero.equippedSkills.length + 1,
  '通常攻撃＋装備中の技すべてを戦闘前に一覧表示');
checkBadge('戦闘前の技確認', '.skill-check-page', D.SKILL.sk_fire_slash);
assert(txt(q('.skill-check-page')).includes('AUTO 戦闘で使用する技') &&
  txt(q('.skill-check-page')).includes('予測ダメージ'),
  'AUTO が使用する技の確認と予測ダメージを表示');
assert(!!q('select[data-change="skillCheckEnemy"]'), '比較相手を選べる（防御力が予測に反映）');
const defSelect = q('select[data-change="skillCheckEnemy"]');
const otherEnemy = D.ENEMIES.find(en => en.id !== defSelect.value && (en.mul || 1) > 1.5) || D.ENEMIES[D.ENEMIES.length - 1];
const forecastBefore = txt(qa('.sk-forecast')[0]);
defSelect.value = otherEnemy.id;
defSelect.dispatchEvent(new w.Event('change', { bubbles:true }));
await wait(5);
assert(q('select[data-change="skillCheckEnemy"]').value === otherEnemy.id,
  '相手を切り替えると app.skillCheckEnemy が更新される');
assert(txt(qa('.sk-forecast')[0]) !== forecastBefore ||
  qa('.sk-forecast')[0].textContent.includes('約'),
  '相手の防御力の変化が予測ダメージに反映される（技威力は不変）');
assert(txt(q('.skill-check-page')).includes(`攻撃力：${fmt(damagePower(fire))}`),
  '技固有の攻撃力は相手を変えても一切変わらない');

/* =========================================================
   5. 戦闘中：技を選ぶ前・奥義・AUTO・通常攻撃
   ========================================================= */
console.log('== 5. 戦闘中 / 技詳細 / AUTO / 詳細モーダル ==');
const enemy = S.storyStageEnemy('ch1', 0);
const battle = new Battle({ state, char:hero, enemy, mode:'cpu',
  onChange:()=>{}, onFx:()=>{}, onEnd:()=>{} });
battle.ultimateGauge = 100;
app.battle = battle; app.battleTab = 'skill';
await go('battle');
assert(q('.battle-screen'), '戦闘画面が描画される');
const actionBtns = qa('.action-grid .action-btn');
assert(actionBtns.length >= hero.equippedSkills.length,
  `技選択ボタン ${actionBtns.length} 個が並ぶ`);
assert(actionBtns.every(x => txt(x).includes('攻撃力：') || txt(x).includes('回復量：') ||
  txt(x).includes('効果：')), '戦闘中の全技ボタンに威力または効果');
assert(actionBtns.every(x => txt(x).includes('MP：')),
  '技を選択する前に全ボタンで消費 MP を確認できる');
const fireBtn = actionBtns.find(x => txt(x).includes('フレイムスラッシュ'));
assert(txt(fireBtn).includes('攻撃力：72') && txt(fireBtn).includes('MP：3'),
  '戦闘中も実際の技データどおり「攻撃力：72 / MP：3」');
assert(txt(fireBtn).includes('予測ダメージ'), '戦闘中は予測ダメージも併記');
const basicBtn = actionBtns.find(x => txt(x).includes('通常攻撃'));
assert(txt(basicBtn).includes('攻撃力：100') && txt(basicBtn).includes('MP：0'),
  '通常攻撃も「攻撃力：100 / MP：0」');
const ultBtns = qa('.ultimate-btn');
assert(ultBtns.length >= 1 && ultBtns.every(x => txt(x).includes('攻撃力：') && txt(x).includes('MP：')),
  `奥義 ${ultBtns.length} 件も parts 由来の攻撃力 / MP を表示`);
assert(txt(q('.combat-move')).includes('MP：0') && txt(q('.combat-move')).includes('攻撃力：'),
  '戦闘中の相手の専用技にも攻撃力 / MP：0');

// 戦闘中の「技詳細」タブ＝選ぶ前の確認 / AUTO の確認
app.battleTab = 'details';
await go('battle');
assert(q('.battle-skill-details') && qa('.battle-skill-details .skill-info-line').length >= hero.equippedSkills.length,
  '戦闘中「技詳細」タブに全技の情報を一覧表示');
assert(txt(q('.battle-skill-details')).includes('AUTO が使用する技') &&
  txt(q('.battle-skill-details')).includes('MP：') && txt(q('.battle-skill-details')).includes('対象'),
  '技詳細タブに AUTO 確認・MP・攻撃対象・追加効果への導線');
checkBadge('戦闘中 技詳細', '.battle-skill-details', D.SKILL.sk_fire_slash);

// 基本タブの通常攻撃
app.battleTab = 'basic';
await go('battle');
const basicTab = qa('.item-actions .action-btn').find(x => txt(x).includes('通常攻撃'));
assert(txt(basicTab).includes('攻撃力：100') && txt(basicTab).includes('MP：0'),
  '基本タブの通常攻撃も攻撃力 / MP：0');

// ⓘ クリック → 詳細モーダル（効果・対象・追加効果・予測ダメージ）
app.battleTab = 'details';
await go('battle');
const infoBtn = qa('.battle-skill-details .sk-info-btn')
  .find(x => x.dataset.skill === 'sk_fire_slash');
assert(!!infoBtn, '技詳細タブに ⓘ ボタンがある');
infoBtn.dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true }));
await wait(5);
assert(app.skillDetail === 'sk_fire_slash', 'ⓘ クリックで詳細モーダルが開く');
const modal = q('.skill-detail-modal');
assert(!!modal, '詳細モーダルが #app 内に描画される');
const mt = txt(modal);
for (const word of ['技の名前','フレイムスラッシュ','攻撃力','攻撃力：72','MP：3',
  '対象','敵単体','技の効果','追加効果','予測ダメージ']) {
  assert(mt.includes(word), `詳細モーダルに「${word}」`);
}
assert(mt.includes('技に固有の威力') && mt.includes('実際に出るダメージ'),
  '技固有の威力と実際のダメージの違いを初心者向けに説明');
assert(q('.skill-detail-modal .modal-close'), 'タップで閉じるボタンがある');
// 回復技の詳細は「回復量」であって「攻撃力」ではない
app.skillDetail = 'sk_heal';
await go('battle');
const healModal = txt(q('.skill-detail-modal'));
assert(healModal.includes('ヒール') && healModal.includes('回復量：95') &&
  healModal.includes('MP：8') && healModal.includes('自分'),
  '回復技の詳細は「回復量 / MP / 対象：自分」');
assert(!healModal.includes('攻撃力：'), '回復技の詳細に「攻撃力：」は出さない');
app.skillDetail = 'sk_fire_slash';   // 閉じる操作の確認用に戻す
await go('battle');

const css = fs.readFileSync(ROOT + '/css/style.css', 'utf8');
assert(css.includes('.skill-metrics{display:inline-flex;flex-wrap:wrap') &&
  css.includes('.sk-metric{display:inline-flex') && css.includes('white-space:nowrap') &&
  css.includes('overflow-wrap:anywhere') && css.includes('@media (max-width:640px)'),
  '折り返し・はみ出し防止・スマホ幅の CSS が揃っている');
assert(css.includes('.sk-power{color:') && css.includes('.sk-mp{color:') &&
  css.includes('.sk-heal{color:') && css.includes('.sk-effect{color:'),
  '攻撃 / MP / 回復 / 補助を色とアイコンで区別');
q('[data-action="skillInfoClose"]').dispatchEvent(new w.MouseEvent('click', { bubbles:true, cancelable:true }));
await wait(5);
assert(app.skillDetail === null && !q('.skill-detail-modal'), '詳細モーダルを閉じられる');

// 表示の改善がセーブ・バランスに触れていないこと
assert(D.SKILLS.length === 161 && D.VERSION === 8 &&
  D.SKILL.sk_fire_slash.mp === 3 && D.SKILL.sk_fire_slash.parts[0].power === 72,
  '技威力・MP・習得条件・バージョンは一切変更していない');
assert(state.characters.some(x => x.id === hero.id && x.skills.length === hero.skills.length),
  '既存キャラ・習得済み技・装備・セーブデータを保持');
for (const scr of ['character','codex','skillCheck','battle','town']) {
  await go(scr, scr === 'codex' ? { codexTab:1 } : {});
  assert(!html().includes('undefined') && !html().includes('NaN') && !html().includes('[object Object]'),
    `${scr} 画面に undefined / NaN / [object Object] なし`);
}

assert(errors.length === 0, `console.error / unhandledRejection 0 件（実際 ${errors.length}: ${errors.slice(0,2)}）`);
console.log('\nSKILL INFO CHECK OK — 全161技の威力/MP・実戦闘との一致・全技選択/確認画面・詳細・AUTO・表示専用すべて合格');
