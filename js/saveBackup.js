/* ===========================================================
   セーブデータのバックアップ / 復元（更新前の自動退避を含む）
   -----------------------------------------------------------
   - 既存プレイヤーのセーブデータを一切削除・上書きしない。
   - 読み込めなかったセーブは「原本のバイト列」を隔離保存し、
     書き込みを停止する（上書き防止）。復元は明示的な操作でだけ行う。
   - 保存先は IndexedDB（未対応環境は localStorage にフォールバック）。
   =========================================================== */
import { validateState } from './dataGuard.js?v=2';

const BK_DB = 'original_character_fighters_backups';
const BK_STORE = 'backups';
const BK_LS = 'ocf_backups_v8';
const MAX_BACKUPS = 12;
let bkPromise = null;

/** バックアップの世代。after = 最後に「保存成功を確認できた」状態だけを
 *  自動復元の候補にする（古い手動バックアップで最新データを戻さない）。 */
export const BACKUP_PHASES = Object.freeze({
  BEFORE:'before', AFTER:'after', MIGRATION:'migration',
  MANUAL:'manual', RESTORE:'restore', QUARANTINE:'quarantine',
});

function openBackupDB() {
  if (bkPromise) return bkPromise;
  bkPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(BK_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BK_STORE)) db.createObjectStore(BK_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(e => { bkPromise = null; throw e; });
  return bkPromise;
}

function lsRead() {
  try { return JSON.parse(globalThis.localStorage?.getItem(BK_LS) || '[]'); }
  catch (e) { return []; }
}
function lsWrite(arr) {
  try { globalThis.localStorage?.setItem(BK_LS, JSON.stringify(arr.slice(0, MAX_BACKUPS))); return true; }
  catch (e) { return false; }
}
function fingerprint(text) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
    h2 = (h2 + text.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

export function backupId() {
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 原本テキストをそのまま退避する。同一内容・同一理由の重複は作らない。
    localStorage は容量が小さいため、IDB が使える環境では本文を IDB だけに置き、
    LS には一覧用メタデータのみを残す（多重コピーで quota を潰さない）。 */
export async function createBackup(rawText, reason = '手動バックアップ', meta = {}) {
  const text = String(rawText ?? '');
  const rec = {
    id: backupId(), at: new Date().toISOString(), reason,
    version: meta.version ?? null, schema: meta.schema ?? null,
    phase: meta.phase ?? BACKUP_PHASES.MANUAL,
    validated: meta.validated ?? null, ids: meta.ids ?? null,
    chars: meta.chars ?? null, bytes: text.length, hash: fingerprint(text),
    format: meta.format || 'state', rawText: text,
  };
  let list = lsRead();
  // 同じバイト列 + 同じ理由のバックアップは 1 つで十分
  const dup = list.find(b => b && b.hash === rec.hash && b.reason === rec.reason);
  if (dup) return { ...dup, duplicate: true };
  let idbOk = false;
  try {
    const db = await openBackupDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(BK_STORE, 'readwrite');
      tx.objectStore(BK_STORE).put(rec, rec.id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    idbOk = true;
  } catch (e) { /* localStorage フォールバック */ }
  // IDB が使えたら LS はメタデータだけ。使えない場合だけ本文を保持する
  const mirror = idbOk ? { ...rec, rawText: '' } : rec;
  list = [mirror, ...list].slice(0, MAX_BACKUPS);
  if (!lsWrite(list)) {
    list = list.map((b, i) => i === 0 ? b : { ...b, rawText: '' });
    lsWrite(list);
  }
  return rec;
}

/** 一覧（新しい順）。容量を抑えるため rawText は含めない */
export async function listBackups() {
  let list = [];
  try {
    const db = await openBackupDB();
    list = await new Promise((res, rej) => {
      const tx = db.transaction(BK_STORE, 'readonly');
      const r = tx.objectStore(BK_STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { /* LS */ }
  if (!list.length) list = lsRead();
  const seen = new Set();
  return list
    .filter(b => b && b.id)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .filter(b => { const k = b.id || (b.hash + b.reason); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, MAX_BACKUPS)
    .map(({ rawText, ...m }) => m);
}

export async function readBackup(id) {
  try {
    const db = await openBackupDB();
    const rec = await new Promise((res, rej) => {
      const tx = db.transaction(BK_STORE, 'readonly');
      const r = tx.objectStore(BK_STORE).get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (typeof rec?.rawText === 'string' && rec.rawText.length) return rec;
  } catch (e) { /* LS */ }
  return lsRead().find(b => b.id === id && typeof b.rawText === 'string' && b.rawText.length) || null;
}

/** 破損セーブを隔離する（パースしない。原本バイト列を保持） */
export async function quarantineUnreadable(rawText, reason, format = 'state') {
  // 原本をパースせず、そのままのバイト列（テキスト）を隔離する
  return createBackup(rawText, `読込失敗セーブの隔離: ${reason}`,
    { format: format || 'raw', schema: null, phase:BACKUP_PHASES.QUARANTINE });
}

export function backupSummary(list) {
  return { count: list.length, newest: list[0]?.at || null,
    reasons: [...new Set(list.map(b => b.reason))],
    after: list.filter(b => b.phase === BACKUP_PHASES.AFTER).length,
    before: list.filter(b => b.phase === BACKUP_PHASES.BEFORE).length };
}

/** 自動復元の候補を探す。新しい順に「本文を実際に読み → JSON パース →
 *  validateState → 保存時ハッシュと照合」まで行い、全部通った最初の 1 件だけを返す。
 *  壊れたバックアップや隔離原本は絶対に復元候補にしない。 */
export async function findLatestValidBackup(phases = [BACKUP_PHASES.AFTER]) {
  const want = new Set(phases);
  const list = await listBackups();
  const checked = [];
  for (const meta of list) {
    if (!want.has(meta.phase)) continue;
    const rec = await readBackup(meta.id);
    if (!rec || typeof rec.rawText !== 'string' || !rec.rawText.length) {
      checked.push({ id:meta.id, ok:false, reason:'本文なし' }); continue;
    }
    if (meta.hash && fingerprint(rec.rawText) !== meta.hash) {
      checked.push({ id:meta.id, ok:false, reason:'ハッシュ不一致' }); continue;
    }
    let data;
    try { data = JSON.parse(rec.rawText); }
    catch (err) { checked.push({ id:meta.id, ok:false, reason:'JSON 不良' }); continue; }
    const v = validateState(data);
    if (!v.ok) { checked.push({ id:meta.id, ok:false, reason:v.reason }); continue; }
    return { rec, data, validation:v, meta, checked };
  }
  return { rec:null, data:null, validation:null, meta:null, checked };
}
