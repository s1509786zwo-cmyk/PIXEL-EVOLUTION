/* ===========================================================
   データ保護の唯一の定義（他モジュールに依存しない純粋関数）
   -----------------------------------------------------------
   このファイルは「今後どんな機能が追加されても、過去のキャラクターと
   セーブデータを消さない」ための恒久的な判定器です。

   ・ホワイトリスト方式を採らない：before に存在するキーは、名前を
     知らなくても（将来追加された機能のデータでも）すべて保護対象。
   ・追加は許可、削除・初期化・上書きを検出する（additive のみ許す）。
   ・検証するのはデータだけで、保存先 (IndexedDB / localStorage) や
     UI には依存しない。新機能の不具合がここを通って既存データを
     壊さないよう、副作用を一切持たない。
   =========================================================== */

/** ゲーム進行で値が変わることが「正しい」キーだけを除外する。
 *  ここに載っていないキーは、たとえ将来追加された未知の項目でも保護対象。 */
export const MUTABLE_KEYS = new Set([
  'version',        // 形式移行で上がる
  'savedAt',        // 保存時刻
  'lastDaily',      // 日付
  'questsDate',     // 日付
  'quests',         // デイリークエスト（日付変更で再生成）
  'trainingQuests', // 同上
  'log',            // 追記されるログ
]);

/** 旧セーブの 8 ステータス → 4 ステータス移行で「意図的に消える」キー */
export const LEGACY_STAT_KEYS = [
  'str', 'vit', 'int', 'dex', 'agi', 'luk', 'spd', 'mag', 'res', 'mnd',
];

export function stableClone(o) {
  return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
}

/** 軽量フィンガープリント（FNV-1a 由来・表示・比較用） */
export function hashString(text) {
  const s = String(text ?? '');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
    h2 = (h2 + s.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return `${h1.toString(16)}-${h2.toString(16)}`;
}

/** 保存してよい状態かを検証する（破損検知）。
 *  ここで落とすのは「構造が壊れている」場合だけ。値が足りないだけは
 *  updateExistingSave() が補完するので、破損扱いにしてデータを捨てない。 */
export function validateState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { ok:false, reason:'セーブ本体がオブジェクトではありません', chars:0, ids:[] };
  if (!Array.isArray(data.characters))
    return { ok:false, reason:'characters 配列がありません', chars:0, ids:[] };
  const ids = [];
  const seen = new Set();
  for (let i = 0; i < data.characters.length; i++) {
    const c = data.characters[i];
    if (!c || typeof c !== 'object' || Array.isArray(c))
      return { ok:false, reason:`characters[${i}] が壊れています`, chars:data.characters.length, ids };
    if (typeof c.id !== 'string' || !c.id)
      return { ok:false, reason:`characters[${i}] に固有 ID がありません`, chars:data.characters.length, ids };
    if (seen.has(c.id))
      return { ok:false, reason:`キャラクター ID が重複しています: ${c.id}`, chars:data.characters.length, ids };
    seen.add(c.id); ids.push(c.id);
    for (const key of ['skills', 'equippedSkills', 'ultimateSkills']) {
      if (c[key] !== undefined && !Array.isArray(c[key]))
        return { ok:false, reason:`${c.id} の ${key} が配列ではありません`, chars:data.characters.length, ids };
    }
    if (c.equipment !== undefined && (!c.equipment || typeof c.equipment !== 'object'))
      return { ok:false, reason:`${c.id} の装備が壊れています`, chars:data.characters.length, ids };
  }
  if (data.inventory !== undefined && (!data.inventory || typeof data.inventory !== 'object'))
    return { ok:false, reason:'inventory が壊れています', chars:data.characters.length, ids };
  return { ok:true, reason:null, chars:data.characters.length, ids, idSet:seen };
}

/** 「before にあるものが after にもあり、同じ値か」を再帰的に調べる。
 *  after にキー／配列要素が増えるのは許可（＝新機能の追加方式）。
 *  before のキーが消える・値が変わる・配列が縮むと issue を返す。 */
export function diffPreserved(before, after, opts = {}) {
  const ignore = opts.ignore instanceof Set ? opts.ignore : new Set(opts.ignore || []);
  const path = opts.path || '$';
  const issues = [];
  const skip = k => MUTABLE_KEYS.has(k) || ignore.has(k);

  if (before === null || before === undefined || typeof before !== 'object') {
    if (before !== after) issues.push(`${path}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    return issues;
  }
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) { issues.push(`${path}: 配列が消えました`); return issues; }
    if (after.length < before.length)
      issues.push(`${path}: 要素数が ${before.length} → ${after.length} に減りました`);
    for (let i = 0; i < before.length; i++)
      issues.push(...diffPreserved(before[i], after[i], { ignore, path:`${path}[${i}]` }));
    return issues;
  }
  if (!after || typeof after !== 'object' || Array.isArray(after)) {
    issues.push(`${path}: オブジェクトが消えました`);
    return issues;
  }
  for (const [k, v] of Object.entries(before)) {
    if (skip(k)) continue;
    if (!(k in after)) { issues.push(`${path}.${k}: キーが消えました`); continue; }
    issues.push(...diffPreserved(v, after[k], { ignore, path:`${path}.${k}` }));
  }
  return issues;
}

/** 形式移行・復元など「値を変えずに補完だけする」処理の前後比較に使う。
 *  旧 stat 移行だけは意図的な削除なので opts.allowLegacyMigration で許可。 */
export function assertPreserved(before, after, opts = {}) {
  const ignore = new Set(opts.ignore || []);
  if (opts.allowLegacyMigration) for (const k of LEGACY_STAT_KEYS) ignore.add(k);
  const issues = diffPreserved(before, after, { ignore });
  return { ok:issues.length === 0, issues };
}

/** 保存時に使う軽量版：ゲーム進行による値の変化は許可し、
 *  「キャラクター / 保護項目が消える」ことだけを検出する。 */
export function assertNoLoss(before, after) {
  const issues = [];
  if (!before || !Array.isArray(before.characters)) return { ok:true, issues, skipped:true };
  const bIds = before.characters.map(c => c?.id).filter(Boolean);
  const aIds = (after?.characters || []).map(c => c?.id).filter(Boolean);
  const aSet = new Set(aIds);
  for (const id of bIds) if (!aSet.has(id)) issues.push(`キャラクター ID ${id} が消えました`);
  if ((after?.characters || []).length < before.characters.length)
    issues.push(`キャラクター数が ${before.characters.length} → ${after.characters.length} に減りました`);
  if (new Set(aIds).size !== aIds.length) issues.push('キャラクター ID が重複しています');
  // 将来追加される未知のトップレベル項目も含め、既存キーの消失を禁止
  for (const [k, v] of Object.entries(before)) {
    if (MUTABLE_KEYS.has(k)) continue;
    if (!(k in (after || {}))) { issues.push(`保存項目 ${k} が消えました`); continue; }
    if (Array.isArray(v) && Array.isArray(after[k]) && after[k].length < v.length && k !== 'log')
      issues.push(`保存項目 ${k} の記録が ${v.length} → ${after[k].length} に減りました`);
  }
  const v = validateState(after);
  if (!v.ok) issues.push(`保存内容が破損: ${v.reason}`);
  return { ok:issues.length === 0, issues };
}

/** 保護対象の指紋。変更前後の確認・保存レポート・テストで使う。
 *  MUTABLE_KEYS 以外のトップレベル項目をすべて含むので、将来の機能追加も自動対象。 */
export function protectedFingerprint(state) {
  const s = state && typeof state === 'object' ? state : {};
  const stable = {};
  for (const [k, v] of Object.entries(s)) if (!MUTABLE_KEYS.has(k)) stable[k] = v;
  const ids = Array.isArray(s.characters) ? s.characters.map(c => c?.id) : [];
  return {
    chars: ids.length,
    ids,
    topKeys: Object.keys(s).sort(),
    charHash: hashString(JSON.stringify(s.characters || [])),
    dataHash: hashString(JSON.stringify(stable)),
  };
}

/** 既定値を「足りないキーだけ」再帰的に補う（既存値は絶対に触らない）。
 *  新機能の初期値は必ずこの関数経由で追加する。 */
export function mergeAdditive(target, defaults) {
  if (!target || typeof target !== 'object') return target;
  for (const [k, v] of Object.entries(defaults)) {
    if (target[k] === undefined) target[k] = stableClone(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)
      && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      mergeAdditive(target[k], v);
    }
  }
  return target;
}
