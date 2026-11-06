/* ===========================================================
   敵キャラクターの表示レイヤ（Google Drive「敵キャラ」の静止 PNG）
   -----------------------------------------------------------
   - 元ファイルは一切変換しない。形状・テクスチャ・色・材質・装飾は不変。
   - ゲーム側で変えるのは CSS による「表示サイズ / 向き / 接地位置 /
     攻撃モーション / エフェクト」だけ。
   - 敵の画像は「名前」ではなく固有 ID (artId / ENEMY_KIND.id) で引く。
   - このフォルダには 3D モデル・アニメーション・動画が存在しないため、
     3D 読み込みやアニメーション再生を装わない（正直なレポートを返す）。
     静止素材に別キャラクターのモーションを流用することもしない。
   - 読み込みに失敗したときは ✦ や仮スプライトで「正常に見せかけ」ず、
     敵 ID / 参照先 / 代替候補 / 理由を画面とコンソールに明示する。
   =========================================================== */
import { enemyArt, ENEMY_KIND, ASSET_FILES, FILES_BY_ENEMY, UNREADABLE_FILES } from './enemyAssets.js?v=2';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/** 直近の読み込み失敗。開発・検証用に保持し、enemyArtReport() から参照する */
const ART_ERRORS = [];
export function enemyArtErrors() { return ART_ERRORS.slice(); }

/** 敵の 2D 画像ホスト。オリジナル PNG をそのまま <img> で表示する。
 *  sprite 引数は旧 API 互換のために残すが、代替画像としては一切使わない。 */
export function enemyArtHost(en, cls = '', sprite = '', aura = 'none', battle = false, variant = 0) {
  void sprite;   // 仮スプライトでの代用は禁止（エラー表示に置き換えた）
  const a = enemyArt(en, variant);
  const d = a.display || { scale:1, ground:0.99, flip:true, float:false, wide:false };
  const move = a.move || { motion:'slash', color:'#ffd77a' };
  const style = [
    `--art-scale:${Number(d.scale) || 1}`,
    `--art-ground:${Number(d.ground) || 0.99}`,
    `--art-flip:${d.flip === false ? 1 : -1}`,
    `--art-color:${esc(move.color)}`,
  ].join(';');
  const classes = [
    'enemy-art', cls,
    d.float ? 'art-float' : '',
    d.wide ? 'art-wide' : '',
    battle ? 'art-battle' : '',
  ].filter(Boolean).join(' ');
  const id = esc(a.id || en?.id || '');
  // 鮮明さの扱い：組み込み素材は最小 650×1089 の高解像度イラストなので、
  // pixelated を掛けると縮小時にジャギが出て元のデザインを損なう。
  // 高解像度素材はブラウザの補間 (auto) で元画を忠実に縮小し、
  // 低解像度のドット絵 (幅 256px 以下) が登録された場合だけ pixelated に切り替える。
  const primary = (FILES_BY_ENEMY[a.id] || []).find(r => r.role === 'primary' && r.readable);
  const pixelArt = Number(primary?.w || 0) > 0 && Number(primary.w) <= 256;
  // 戦闘中は遅延読み込みを禁止する（lazy だと 0px コンテナやスクロール位置で
  // 画像がいつまでも読まれず、敵だけ空白になる）。一覧画面は lazy のまま。
  return `<div class="${classes}" data-enemy-art="${id}" data-pixel-art="${pixelArt ? '1' : '0'}"
      data-motion="${esc(move.motion)}" style="${style}">
    <div class="enemy-art-ground"></div>
    <img class="enemy-art-img" src="${esc(a.src)}" data-art-src="${esc(a.src)}"
      data-fallback="${esc(a.fallback)}" alt="${esc(ENEMY_KIND[a.id]?.name || en?.name || '敵')}"
      draggable="false" loading="${battle ? 'eager' : 'lazy'}">
    <div class="enemy-art-aura" style="--aura:${esc(aura === 'void' ? '#ff6fae' : '#ffd77a')}"></div>
    <div class="enemy-art-fx"></div>
    <div class="enemy-art-error" role="alert" hidden>
      <b>⚠ 敵画像を読み込めませんでした</b>
      <small>敵 ID・参照先・理由を確認してください</small>
      <code class="art-error-detail"></code>
    </div>
  </div>`;
}

/** 読み込み失敗を「見せかけ」ずに記録・表示する */
function failEnemyArt(host, img, reason) {
  if (!host || host.dataset.failed === '1') return;
  host.dataset.loaded = '0';
  host.dataset.failed = '1';
  const id = host.dataset.enemyArt || '(ID不明)';
  const src = img.dataset.artSrc || img.getAttribute('src') || '(パス不明)';
  const fallback = img.dataset.fallback || '';
  const tried = fallback && fallback !== src ? fallback : '(なし)';
  const detail = `敵ID: ${id}\n参照先: ${src}\n代替候補: ${tried}\n理由: ${reason}`;
  const box = host?.querySelector('.enemy-art-error, .asset-file-error');
  if (box) {
    const code = box.querySelector('.art-error-detail') ||
      (box.classList.contains('asset-file-error') ? box : null);
    if (code) code.textContent = detail;
    box.hidden = false;
  }
  ART_ERRORS.push({ id, src, fallback:tried, reason, at:new Date().toISOString() });
  if (ART_ERRORS.length > 100) ART_ERRORS.shift();
  console.error('[敵画像の読み込み失敗] ' + detail.replace(/\n/g, ' / '));
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent && window.CustomEvent)
      window.dispatchEvent(new window.CustomEvent('enemy-art-error',
        { detail:{ id, src, fallback:tried, reason } }));
  } catch (err) { /* イベント通知自体は表示の必須条件ではない */ }
}

/** 画像 1 枚へ読み込み成否の配線を付ける（戦闘ホスト / 台帳一覧どちらでも使う） */
function bindArtImage(img, host) {
  if (img.dataset.artBound) return false;
  img.dataset.artBound = '1';
  if (!host) return true;
  const bind = () => {
    if (img.complete && img.naturalWidth > 0) {
      host.dataset.loaded = '1';
      host.dataset.failed = '0';
      const box = host.querySelector('.enemy-art-error, .asset-file-error');
      if (box) box.hidden = true;
    }
  };
  // src が空 = 敵 ID と台帳の紐付け漏れ。error イベントが飛ばない環境でも必ず検出する。
  if (!img.getAttribute('src')) {
    failEnemyArt(host, img, '画像の参照先が空です（敵 ID と ASSET_FILES の紐付けを確認）');
    return true;
  }
  bind();
  img.addEventListener('load', bind);
  img.addEventListener('error', () => {
    // 再試行は「同じ敵の代表 PNG」へ 1 回だけ。別キャラの画像や生成スプライトは使わない。
    const fb = img.dataset.fallback;
    const cur = img.getAttribute('src');
    if (fb && fb !== cur && !img.dataset.fallbackUsed) {
      img.dataset.fallbackUsed = '1';
      host.dataset.recovered = '1';   // 成功しても警告を残し、正常に見せかけない
      img.src = fb;
      return;
    }
    failEnemyArt(host, img, fb && fb !== img.dataset.artSrc
      ? '原本と代表 PNG の両方を読み込めません（404 / 破損 / パス不一致）'
      : '画像ファイルが見つかりません（404 / 破損 / パス不一致）');
  });
  return true;
}

/** render() のあとに呼ぶ。複数敵・戦闘・結果・図鑑・台帳一覧の全画像へ配線する */
export function syncEnemyArt() {
  if (typeof document === 'undefined') return 0;
  let n = 0;
  const imgs = document.querySelectorAll('.enemy-art-img, .asset-file-img');
  for (const img of imgs) {
    const host = img.closest('.enemy-art') || img.closest('.asset-file');
    if (bindArtImage(img, host)) n++;
  }
  return imgs.length;
}

/** 攻撃・被弾・撃破・登場の CSS モーション（静止 PNG への表示演出のみ） */
export function playEnemyArt(kind, move = null) {
  if (typeof document === 'undefined') return 0;
  const hosts = document.querySelectorAll('.enemy-art');
  let n = 0;
  for (const h of hosts) {
    h.classList.remove('art-attack', 'art-hit', 'art-death', 'art-enter', 'art-guard');
    // 再付与のため 1 フレーム空ける
    void h.offsetWidth;
    const cls = ({ attack:'art-attack', damage:'art-hit', victory:'art-death', defeat:'art-attack',
                   move:'art-enter', guard:'art-guard' })[kind];
    if (cls) h.classList.add(cls);
    if (move?.motion) h.dataset.motion = move.motion;
    if (move?.color) h.style.setProperty('--art-color', move.color);
    n++;
  }
  if (move) spawnEnemyEffect(move);
  return n;
}

/** 専用技のエフェクトを #fx-layer に生成する（画像そのものは変更しない） */
export function spawnEnemyEffect(move) {
  if (typeof document === 'undefined') return;
  const layer = document.getElementById('fx-layer');
  if (!layer) return;
  const glyph = {
    slash:'╱', bash:'◆', thrust:'➤', shot:'➶', cast:'✧', gaze:'◉', breath:'✹',
    charge:'»', multi:'✳', aura:'◌', bite:'✖',
  }[move.motion] || '✦';
  const el = document.createElement('div');
  el.className = `enemy-move-fx fx-${esc(move.motion || 'slash')}`;
  el.style.setProperty('--mc', move.color || '#ffb45a');
  el.innerHTML = `<span class="emf-ring"></span><span class="emf-glyph">${glyph}</span>
    <span class="emf-name">${esc(move.name || '')}</span>`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/** 表示中のバリエーションを切り替える（色違いの別ファイルを、その敵の範囲で差し替える） */
export function setEnemyArtVariant(variant) {
  if (typeof document === 'undefined') return 0;
  const hosts = document.querySelectorAll('.enemy-art');
  let n = 0;
  for (const h of hosts) {
    const id = h.dataset.enemyArt;
    const k = ENEMY_KIND[id];
    if (!k || !k.variants?.length) continue;
    const img = h.querySelector('.enemy-art-img');
    if (!img) continue;
    const v = ((variant % k.variants.length) + k.variants.length) % k.variants.length;
    img.dataset.fallbackUsed = '';
    img.dataset.artSrc = k.variants[v];
    img.src = k.variants[v];
    h.dataset.variant = String(v);
    n++;
  }
  return n;
}

/** 開発・検証用の正直なレポート（3D/アニメの「読み込み成功」は報告しない） */
export function enemyArtReport() {
  const hosts = typeof document === 'undefined' ? [] : [...document.querySelectorAll('.enemy-art')];
  return {
    kind: '静止2Dイラスト（PNG）',
    source: 'Google Drive / 敵キャラ',
    files: ASSET_FILES.length,
    readable: ASSET_FILES.filter(r => r.readable).length,
    unreadable: UNREADABLE_FILES.length,
    enemyKinds: Object.keys(ENEMY_KIND).length,
    models3d: 0, animationClips: 0,          // このフォルダには存在しない
    displayOnly: ['表示サイズ', '向き', '接地', '攻撃モーション(CSS)', 'エフェクト(CSS)'],
    hosts: hosts.length,
    loaded: hosts.filter(h => h.dataset.loaded === '1').length,
    failed: hosts.filter(h => h.dataset.failed === '1').length,
    recovered: hosts.filter(h => h.dataset.recovered === '1').length,
    errors: enemyArtErrors(),
    entries: hosts.map(h => ({ id:h.dataset.enemyArt, loaded:h.dataset.loaded === '1',
      src:h.querySelector('.enemy-art-img')?.getAttribute('src') || '' })),
  };
}

export function initEnemyArt() { return syncEnemyArt(); }
