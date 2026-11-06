/* ===========================================================
   IndexedDB 実環境パスの保護テスト
   tests/_harness.mjs は indexedDB=undefined（localStorage フォールバック）なので、
   ここでは最小の IDB 実装を差し込んで「本来の保存先」を検証する。
   ・IDB への書き込み直後の読み直し照合（保存成功確認）
   ・バックアップ本文が IDB に置かれ、LS はメタデータだけになること
   ・IDB が壊れても古い LS 本文を読まず、新規データで上書きしないこと
   ・検証済み after バックアップからの自動復元
   =========================================================== */
import { setup, assert, fileURL } from './_harness.mjs';

const clone = o => JSON.parse(JSON.stringify(o));
const LS = 'ocf_save_v3';

function makeTx(store) {
  const tx = { oncomplete:null, onerror:null, error:null };
  tx.objectStore = () => ({
    put(v, k) {
      queueMicrotask(() => { store.set(k, clone(v)); tx.oncomplete && tx.oncomplete(); });
      return {};
    },
    get(k) {
      const r = {};
      queueMicrotask(() => { r.result = store.get(k); r.onsuccess && r.onsuccess(); });
      return r;
    },
    getAll() {
      const r = {};
      queueMicrotask(() => { r.result = [...store.values()]; r.onsuccess && r.onsuccess(); });
      return r;
    },
    delete(k) {
      queueMicrotask(() => { store.delete(k); tx.oncomplete && tx.oncomplete(); });
      return {};
    },
    clear() {
      queueMicrotask(() => { store.clear(); tx.oncomplete && tx.oncomplete(); });
      return {};
    },
  });
  return tx;
}
class FakeIDB {
  constructor() { this.dbs = new Map(); }
  open(name) {
    const req = { result:null, onupgradeneeded:null, onsuccess:null, onerror:null, error:null };
    if (!this.dbs.has(name)) {
      const stores = new Map();
      const db = {
        objectStoreNames:{ contains:n => stores.has(n) },
        createObjectStore:n => { stores.set(n, new Map()); return stores.get(n); },
        transaction:n => { if (!stores.has(n)) stores.set(n, new Map()); return makeTx(stores.get(n)); },
      };
      this.dbs.set(name, db);
      req.result = db;
      queueMicrotask(() => { req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); });
    } else {
      req.result = this.dbs.get(name);
      queueMicrotask(() => req.onsuccess && req.onsuccess());
    }
    return req;
  }
}
class BrokenIDB {
  open() {
    const req = { result:null, onupgradeneeded:null, onsuccess:null, onerror:null, error:null };
    queueMicrotask(() => { req.error = new Error('IDB 読み取り破損'); req.onerror && req.onerror(); });
    return req;
  }
}
const setIDB = impl => Object.defineProperty(globalThis, 'indexedDB',
  { value:impl, configurable:true, writable:true });

const { localStorage } = setup();
localStorage.clear();
setIDB(new FakeIDB());
const S = await import(fileURL('js/state.js') + '?idb_main=1');
const B = await import(fileURL('js/saveBackup.js') + '?v=2');   // state.js と同じインスタンス

console.log('== 1. IDB への保存前／保存後バックアップと成功確認 ==');
const st = S.newState();
st.home.started = true;
for (let i = 0; i < 3; i++)
  S.createCharacter(st, { name:`IDB-${i}`, jobId:'warrior', original:`idb-img-${i}` });
st.coins = 123456;
const ok1 = await S.saveState(st, true);
const r1 = S.saveReport();
assert(ok1 === true && r1.ok === true && r1.verified === true && r1.source === 'idb',
  'IDB に書き込み、読み直し照合まで成功確認できた');
assert(!!r1.afterBackup, '保存成功後バックアップを作成');
assert(localStorage.getItem(LS) === null,
  'IDB が健全なときは古い LS 本文を残さない（障害時に古いデータを読ませない）');
assert(JSON.parse(localStorage.getItem('ocf_save_meta_v1')).chars === 3,
  '存在証拠・世代・キャラ数をメタとして残す');
const savedCoins = st.coins + 1;
const ok2 = await S.saveState({ ...st, coins:savedCoins }, true);
const r2 = S.saveReport();
assert(ok2 === true && !!r2.beforeBackup && !!r2.afterBackup &&
  r2.beforeBackup !== r2.afterBackup && r2.source === 'idb',
  '2 回目の保存で before / after の二重バックアップ');

console.log('== 2. バックアップ本文は IDB、LS はメタだけ ==');
const list = await B.listBackups();
const after = list.find(b => b.phase === B.BACKUP_PHASES.AFTER);
assert(!!after, 'after 世代が一覧に出る');
const rec = await B.readBackup(after.id);
assert(!!rec && typeof rec.rawText === 'string' && rec.rawText.length > 100,
  'IDB からバックアップ本文を読める');
assert(JSON.parse(rec.rawText).characters.length === 3,
  'IDB の本文は完全なセーブ（3 人分）');
assert(JSON.parse(localStorage.getItem('ocf_backups_v8'))[0].rawText === '',
  'LS のバックアップ一覧はメタデータのみ（本文は IDB）');
const found = await B.findLatestValidBackup([B.BACKUP_PHASES.AFTER]);
assert(!!found?.data && found.validation.ok && found.validation.chars === 3,
  '自動復元候補を IDB 本文から取り出して検証できた');

console.log('== 3. IDB から再起動しても既存データが残る ==');
const reloaded = await S.loadState();
assert(!!reloaded && reloaded.characters.length === 3 &&
  JSON.stringify(reloaded.characters.map(c => c.id)) === JSON.stringify(st.characters.map(c => c.id)),
  'IDB からの再読み込みで 3 人全員・全 ID が残る');
assert(reloaded.coins === savedCoins && !S.saveBlocked(),
  '通貨も維持され、正常セーブが保護停止扱いにならない');

console.log('== 4. IDB が壊れても空データで上書きせず、検証済みバックアップから復元 ==');
// 新しい state.js インスタンス（= ゲーム再起動）だけ IDB を壊す。
// saveBackup.js?v=2 は確立済みなのでバックアップ本文は読める。
setIDB(new BrokenIDB());
const S2 = await import(fileURL('js/state.js') + '?idb_broken=1');
const broken = await S2.loadState();
assert(broken === null, 'IDB 読取失敗で空の新規データを返さない');
const lr = S2.loadReport();
assert(lr.unreadable && lr.protectedExisting && lr.retryCount === 3 &&
  !!lr.errorDetail && S2.saveBlocked(),
  '「読めない」を「存在しない」と混同せず、保護 → 原因 → 再試行 → 停止');
assert(localStorage.getItem(LS) === null,
  '古い LS 本文が無いので、IDB 障害時に古いデータを誤読しない');
assert((await S2.saveState(S2.newState(), true)) === false,
  '復旧前は一切書き込まない');
const auto = await S2.loadState({ autoRecover:true });
assert(!!auto && S2.loadReport().autoRecovered && auto.characters.length === 3 &&
  JSON.stringify(auto.characters.map(c => c.id)) === JSON.stringify(st.characters.map(c => c.id)),
  '検証済み after バックアップから 3 人全員・全 ID を自動復元');
assert(!S2.saveBlocked(), '自動復元後は保存を再開');

console.log('\nIDB PROTECTION CHECK OK — 本来の保存先での二重バックアップ・成功確認・破損時の保護と自動復元 すべて合格');
