/* ============================================================
   製作者専用ツール（隠し機能） / CREATOR TOOLS
   ------------------------------------------------------------
   - 通常プレイの画面・セーブ・進行には一切手を加えない。
     #app の外側に単一のオーバーレイを 1 つだけ作り、C キーで開閉する。
   - パスワード認証は「決定」ボタン（または入力欄の Enter）でのみ実行。
   - 「一括進化」はキャラカードごとの小さいボタン。押したカードの
     キャラクター 1 体だけを進化させ、他のキャラは一切変更しない。
   - 進化は同期処理 → 1 回の保存 → 完了メッセージ、の順で確定する。
   ============================================================ */
import { e, charImage, rankBadge } from './ui.js?v=2';
import { JOB } from './data.js?v=2';
import { creatorEvolveOne } from './state.js?v=2';

const PASSWORD = 'kiyo';                 // 半角小文字のみ。大文字・空白・余分な文字は不可
const DONE_SUFFIX = 'のLR進化が完了しました！';

let host = null;                         // 唯一のオーバーレイ要素
let ctx = null;                          // { app, getState, save, refresh }
let busy = false;                        // 進化処理中は画面を閉じない
let err = '';
let doneMsg = '';
let lastResult = null;
let lastCharId = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'creator-layer';
  host.className = 'creator-layer creator-hidden';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  host.addEventListener('click', onHostClick);
  host.addEventListener('keydown', onHostKeyDown);
  return host;
}

/* ---------------- 描画 ---------------- */
function passwordHTML() {
  return `
  <div class="creator-backdrop"></div>
  <div class="creator-password-card" role="dialog" aria-modal="true" aria-labelledby="creator-pw-title">
    <div class="creator-kicker">PRIVATE CONSOLE ・ AUTHOR ONLY</div>
    <h2 id="creator-pw-title">パスワードを入力してください</h2>
    <div class="creator-searchbar">
      <span class="creator-lock" aria-hidden="true">🔒</span>
      <input id="creator-password" class="creator-password-input" type="password"
        placeholder="パスワード" aria-label="パスワード"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
      <button type="button" class="creator-decide" data-creator-action="decide">決定</button>
    </div>
    ${err ? `<p class="creator-error" role="alert">${e(err)}</p>` : ''}
    <p class="creator-footnote">C キーで閉じて通常のゲームへ戻ります</p>
  </div>`;
}

function charCard(c, i) {
  const rank = c.rarity || 'R';
  const job = JOB[c.jobId]?.name || c.jobId || '—';
  const lv = Number(c.level) || 1;
  return `<article class="creator-char" data-creator-done="${rank === 'LR' ? '1' : '0'}" data-creator-id="${e(c.id || String(i))}">
    <div class="creator-portrait">${charImage(c, 'creator-art')}</div>
    <div class="creator-char-meta">
      <div class="creator-char-name">${e(c.name || '名無し')}</div>
      <div class="creator-char-row">${rankBadge(rank)}<span class="creator-char-lv">Lv.${lv}</span></div>
      <div class="creator-char-job">${e(String(job))}</div>
    </div>
    <button type="button" class="creator-evolve-one" data-creator-action="evolveOne"
      data-creator-id="${e(c.id || String(i))}" ${busy ? 'disabled' : ''}
      title="このキャラクター 1 体だけを LR 理論値へ進化（消費ゼロ）">⚡ 一括進化</button>
  </article>`;
}

function toolsHTML() {
  const st = ctx.getState();
  const chars = Array.isArray(st?.characters) ? st.characters : [];
  const cards = chars.map(charCard).join('');
  return `
  <div class="creator-backdrop"></div>
  <div class="creator-shell" role="dialog" aria-modal="true" aria-label="CREATOR TOOLS / 製作者ツール">
    <header class="creator-head">
      <div>
        <div class="creator-kicker">AUTHOR-ONLY ・ PRIVATE BUILD ・ NOT PART OF NORMAL PLAY</div>
        <h1>CREATOR TOOLS <span>/ 製作者ツール</span></h1>
        <p class="creator-sub">製作者専用の管理画面です。通常プレイには表示されません。</p>
      </div>
      <button type="button" class="creator-x" data-creator-action="close" aria-label="閉じる">×</button>
    </header>

    <div class="creator-note">
      <b>⚡ 一括進化</b> は各キャラクターのカードにある小さいボタンから実行します。
      押した <strong>そのキャラクター 1 体だけ</strong> が LR の理論値へ進化し、他のキャラクターには影響しません。
      育成素材・コイン・アイテムの消費はゼロ。名前・画像・職業・装備・既存の技・セーブデータは保持されます。
    </div>

    ${busy ? '<p class="creator-busy" role="status">進化処理中です… 保存が終わるまで画面を閉じません。</p>' : ''}
    ${doneMsg ? `<p class="creator-done-msg" role="status">✅ ${e(doneMsg)}</p>` : ''}

    <section class="creator-list">
      <div class="creator-list-head">
        <h3>自作キャラクター一覧</h3>
        <span class="creator-count">${chars.length} 人 ・ 全員表示（上限なし / スクロール可）</span>
      </div>
      <div class="creator-scroll">${cards || '<p class="creator-empty">まだ自作キャラクターが作成されていません。</p>'}</div>
    </section>

    <footer class="creator-footer">
      <span class="creator-footer-note">C キーでもこの画面を閉じて通常のゲームへ戻れます。</span>
      <button type="button" class="creator-done-btn" data-creator-action="done" ${busy ? 'disabled' : ''}>完了</button>
    </footer>
  </div>`;
}

function draw() {
  if (!host || !ctx) return;
  const cr = ctx.app.creator || (ctx.app.creator = { open:false, mode:'closed' });
  if (!cr.open) {
    host.className = 'creator-layer creator-hidden';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
    return;
  }
  host.className = 'creator-layer';
  host.setAttribute('aria-hidden', 'false');
  host.innerHTML = cr.mode === 'password' ? passwordHTML() : toolsHTML();
  if (cr.mode === 'password') {
    const inp = host.querySelector('#creator-password');
    if (inp) setTimeout(() => { try { inp.focus(); } catch (_) {} }, 0);
  }
}

/* ---------------- 入力 ---------------- */
function onHostClick(ev) {
  const el = ev.target?.closest?.('[data-creator-action]');
  if (!el || !host.contains(el) || el.disabled) return;
  ev.preventDefault();
  const act = el.dataset.creatorAction;
  if (act === 'decide') {
    const inp = host.querySelector('#creator-password');
    authenticateCreator(inp ? inp.value : '');
  } else if (act === 'close' || act === 'done') {
    closeCreator();
  } else if (act === 'evolveOne') {
    evolveOneCreator(el.dataset.creatorId);
  }
}
function onHostKeyDown(ev) {
  if (ev.key === 'Enter' && ev.target?.id === 'creator-password') {
    ev.preventDefault();
    authenticateCreator(ev.target.value);
  }
}

/* ---------------- 公開 API ---------------- */
export function initCreatorTools(options) {
  ctx = options;
  if (!ctx.app.creator) ctx.app.creator = { open:false, mode:'closed' };
  // ページ再読込／テストの再起動で document が差し替わったら、古い DOM を捨てて
  // 新しい document に 1 つだけ作り直す（オーバーレイの重複を絶対に起こさない）。
  if (host && host.ownerDocument !== document) {
    host = null; busy = false; err = ''; doneMsg = ''; lastResult = null; lastCharId = null;
  }
  ensureHost();
  draw();
  return host;
}

/** C キー 1 回で開く／もう 1 回で閉じる。単一要素なので重複表示は起きない */
export function toggleCreator() {
  if (!ctx || busy) return false;
  return ctx.app.creator.open ? closeCreator() : openCreator();
}
export function openCreator() {
  if (!ctx || busy) return false;
  const cr = ctx.app.creator;
  cr.open = true; cr.mode = 'password';
  err = ''; doneMsg = ''; lastResult = null; lastCharId = null;
  draw();
  return true;
}
export function closeCreator() {
  if (!ctx || busy) return false;               // 処理中は閉じない＝データ破損防止
  const cr = ctx.app.creator;
  if (!cr.open) return false;
  cr.open = false; cr.mode = 'closed';
  err = '';
  draw();
  ctx.refresh();                               // 通常ゲーム側も最新状態へ再描画
  return true;
}

/** 認証は「決定」押下（または Enter）のときだけ。入力しただけでは開かない */
export function authenticateCreator(value) {
  if (!ctx || busy) return false;
  const cr = ctx.app.creator;
  if (!cr.open || cr.mode !== 'password') return false;
  if (typeof value !== 'string' || value !== PASSWORD) {
    err = 'パスワードが間違っています';
    draw();
    return false;
  }
  err = ''; doneMsg = ''; lastResult = null; lastCharId = null;
  cr.mode = 'tools';
  draw();
  return true;
}

/** カード 1 枚の「一括進化」：そのキャラ 1 体だけを同期適用 → 1 回だけ保存 */
export async function evolveOneCreator(charId) {
  if (!ctx || busy) return { ok:false, msg:'処理中です' };
  const cr = ctx.app.creator;
  if (!cr.open || cr.mode !== 'tools') return { ok:false, msg:'ツールが開いていません' };
  if (!charId) return { ok:false, msg:'キャラクターが指定されていません' };
  busy = true; doneMsg = '';
  draw();                                      // 全ボタンを無効化して二重実行を防ぐ
  let result = null;
  try {
    result = creatorEvolveOne(ctx.getState(), charId);   // await なし＝原子的に 1 件だけ確定
    if (!result.ok) throw new Error(result.msg || '進化できませんでした');
    await ctx.save(true);                               // 1 回の即時保存で永続化
    lastResult = result;
    lastCharId = charId;
    doneMsg = result.msg || `「${result.characters[0]?.name || ''}」${DONE_SUFFIX}`;
  } catch (ex) {
    doneMsg = `進化処理に失敗しました：${ex?.message || ex}`;
  } finally {
    busy = false;
    draw();
  }
  return { ok:!!result?.ok, result, msg:doneMsg };
}

/** 通常ゲームの render() から呼ぶ。ツール表示中に新キャラが増えても自動で一覧へ入る */
export function syncCreatorTools() {
  if (!ctx || busy) return;
  const cr = ctx.app.creator;
  if (cr?.open && cr.mode === 'tools') draw();
}

/** テスト・デバッグ用の状態レポート（ゲーム進行には影響しない） */
export function creatorReport() {
  const cr = ctx?.app?.creator || { open:false, mode:'closed' };
  const st = ctx?.getState?.() || null;
  const chars = Array.isArray(st?.characters) ? st.characters : [];
  return {
    open: !!cr.open, mode: cr.mode, busy, error: err, message: doneMsg,
    total: chars.length,
    ranks: chars.map(c => c.rarity),
    names: chars.map(c => c.name),
    layers: document.querySelectorAll('#creator-layer').length,
    completed: !!st?.creatorTool?.completed,
    lastCharId, lastResult,
  };
}

export { DONE_SUFFIX };
