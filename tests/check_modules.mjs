/* 全 ES モジュールの import 解決を検証する。
   `node --check` だけでは「存在しない export を import している」事故を見逃すため、
   jsdom 環境で実際に 1 つずつ動的 import する。 */
import fs from 'node:fs';
import { setup, assert, fileURL, ROOT } from './_harness.mjs';

setup();
const files = fs.readdirSync(ROOT + '/js').filter(f => f.endsWith('.js')).sort();
assert(files.length >= 15, `js/ の全 ${files.length} モジュールを対象にする`);
for (const f of files) {
  let m;
  try { m = await import(fileURL('js/' + f) + '?modcheck=1'); }
  catch (e) { throw new Error(`import 失敗 js/${f}: ${e?.message || e}`); }
  assert(m && typeof m === 'object', `js/${f} の import と export が解決`);
}
console.log(`ALL MODULE IMPORTS OK ${files.length}`);
