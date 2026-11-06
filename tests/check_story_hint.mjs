/* ギルドの「ストーリー」小タブと、育成素材→ストーリーのヒントを実アプリで検証。
   実行: node tests/check_story_hint.mjs */
import fs from 'node:fs';
import { setup, assert, fileURL, wait, ROOT } from './_harness.mjs';

const { w, document } = setup();
await import(fileURL('js/main.js') + '?storytab=1');
await wait(180);
const O = w.__OCF;
const { app, S, D } = O;
const U = await import(fileURL('js/ui.js'));
const q = sel => document.querySelector(sel);
const qa = sel => [...document.querySelectorAll(sel)];
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };

console.log('== 1. ギルドの小さいタブに「ストーリー」が並ぶ ==');
S.createCharacter(O.state, { name:'タブ確認', jobId:'warrior', weaponType:'剣',
  original:'data:image/png;base64,AAAA' });
await O.navigate('facility', { facility:'guild', tab:1 });       // ダンジョンを表示中
const tabs = qa('.facility-tabs .ftab');
assert(tabs.length === 5, `ギルドのタブは既存 4 + ストーリー 1 = 5（実際 ${tabs.length}）`);
assert(tabs[1].textContent.includes('ダンジョン') && tabs[2].textContent.includes('ストーリー'),
  '「ダンジョン」の右隣に「ストーリー」');
assert(tabs[2].classList.contains('ftab-story-link') && tabs[2].dataset.to === 'story',
  'ストーリーボタンは data-to="story" の専用導線');
assert(tabs[3].textContent.includes('クエスト') && tabs[3].dataset.i === '2',
  'クエストの data-i=2 は据え置き（添字ズレなし）');
assert(tabs[4].textContent.includes('戦績・交換') && tabs[4].dataset.i === '3',
  '戦績・交換の data-i=3 も据え置き');
assert(D.FACILITIES.find(x => x.id === 'guild').tabs.length === 4,
  'FACILITIES の既存タブ配列自体は変更しない');
const style = fs.readFileSync(ROOT + '/css/style.css', 'utf8');
assert(style.includes('.ftab.ftab-story-link'), 'ストーリーボタン専用の見た目が CSS にある');

console.log('== 2. ボタンから実際にストーリー画面へ遷移する ==');
tabs[2].click();
await wait(20);
assert(app.screen === 'story', `ストーリーボタンで story 画面へ（実際 ${app.screen}）`);
assert(q('.story-page') || document.getElementById('app').textContent.includes('ストーリー'),
  'ストーリー画面が描画されている');
await O.navigate('facility', { facility:'guild', tab:1 });
q('.facility-tabs .ftab[data-i="2"]').click();
await wait(20);
assert(app.screen === 'facility' && app.tabs.guild === 2,
  'クエストの小タブは今までどおりクエスト一覧（インデックス回帰なし）');
await O.navigate('facility', { facility:'guild', tab:1 });
q('.facility-tabs .ftab[data-i="3"]').click();
await wait(20);
assert(app.tabs.guild === 3, '戦績・交換の小タブも今までどおり');

console.log('== 3. 「育成素材を得たいならストーリーを進めよう」ヒント ==');
const H = S.hintState(O.state);
const phrase = '育成素材を得たいならストーリーを進めよう';
const sm = H.categories.find(x => x.id === 'storyMaterials');
assert(!!sm && sm.text.includes(phrase), 'ヒント分類「育成素材とストーリー」に案内文');
assert(H.categories.find(x => x.id === 'materials').goal.includes(phrase),
  '「素材集め」カテゴリの具体的な目標にも案内文');
assert(H.categories.find(x => x.id === 'materials').conditions.some(c => c.label.includes(phrase)),
  '素材集めの達成条件行にストーリーへの導線');
assert(H.categories.find(x => x.id === 'materials').actions.some(a => a.to === 'story'),
  '素材集めのアクションにストーリーへ直行するボタン');
assert(H.categories.find(x => x.id === 'evolution').actions.some(a => a.to === 'story'),
  'ランク進化ヒントにもストーリーへの導線');
const goal = (await import(fileURL('js/state.js'))).hintState(O.state);
assert(!!goal && !!H.next, 'hintState() は従来どおり次の目標を返す');
// 新規ゴールが実際に goals へ入っていることをレンダリングから確認
Object.assign(app, { screen:'hints', hintCategory:'storyMaterials' });
const html = U.renderScreen(app, O.state);
assert(html.includes(phrase) && html.includes('育成素材とストーリー'),
  'ヒント画面に新しいヒントが表示される');
assert(html.includes('📜 ストーリーへ'), 'ヒントからストーリーへ飛べる');
assert(!['undefined','NaN','[object Object]'].some(t => html.includes(t)),
  'ヒント画面に undefined / NaN / [object Object] なし');
Object.assign(app, { screen:'hints', hintCategory:'next' });
const htmlNext = U.renderScreen(app, O.state);
assert(!['undefined','NaN','[object Object]'].some(t => htmlNext.includes(t)),
  '「次にやるべきこと」画面も健全');
const cases = new Set([...fs.readFileSync(ROOT + '/js/main.js', 'utf8')
  .matchAll(/case '([A-Za-z0-9_]+)':/g)].map(m => m[1]));
const acts = new Set([...html.matchAll(/data-action="([A-Za-z0-9_]+)"/g)].map(m => m[1]));
assert([...acts].every(a => cases.has(a)), `ヒント画面の ${acts.size} アクションすべてにハンドラ`);

assert(errors.length === 0, `console.error 0 件（実際 ${errors.length}）`);
console.log('\nSTORY TAB / HINT CHECK OK — 小タブ追加・添字非回帰・遷移・ヒント表示すべて合格');
