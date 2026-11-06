/* ===========================================================
   敵キャラクターの表示レイヤ（Google Drive「敵キャラ」の静止 PNG）
   -----------------------------------------------------------
   - 元ファイルは一切変換しない。形状・テクスチャ・色・材質・装飾は不変。
   - ゲーム側で変えるのは CSS による「表示サイズ / 向き / 接地位置 /
     攻撃モーション / エフェクト」だけ。
   - このフォルダには 3D モデル・アニメーション・動画が存在しないため、
     3D 読み込みやアニメーション再生を装わない（正直なレポートを返す）。
   =========================================================== */
import { enemyArt, ENEMY_KIND, ASSET_FILES, UNREADABLE_FILES } from './enemyAssets.js?v=2';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/** 敵の 2D 画像ホスト。オリジナル PNG をそのまま <img> で表示する */
export function enemyArtHost(en, cls = '', sprite = '', aura = 'none', battle = false, variant = 0) {
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
  return `<div class="${classes}" data-enemy-art="${esc(a.id || en?.id || '')}"
      data-motion="${esc(move.motion)}" style="${style}">
    <div class="enemy-art-ground"></div>
    <img class="enemy-art-img" src="${esc(a.src)}" data-fallback="${esc(a.fallback)}"
      alt="${esc(ENEMY_KIND[a.id]?.name || en?.name || '敵')}" draggable="false" loading="lazy">
    <div class="enemy-art-aura" style="--aura:${esc(aura === 'void' ? '#ff6fae' : '#ffd77a')}"></div>
    <div class="enemy-art-fx"></div>
    <div class="enemy-art-fallback">${sprite ? `<img class="sprite" src="${esc(sprite)}" alt="代替表示">` : '✦'}</div>
  </div>`;
}

/** render() のあとに呼ぶ。実画像の読み込み成否だけを記録する（読み込んだふりをしない） */
export function syncEnemyArt() {
  if (typeof document === 'undefined') return 0;
  const imgs = document.querySelectorAll('.enemy-art-img');
  for (const img of imgs) {
    if (img.dataset.artBound) continue;
    img.dataset.artBound = '1';
    const host = img.closest('.enemy-art');
    const bind = () => {
      if (img.complete && img.naturalWidth > 0) {
        host.dataset.loaded = '1';
        host.dataset.failed = '0';
      }
    };
    bind();
    img.addEventListener('load', bind);
    img.addEventListener('error', () => {
      if (img.dataset.fallbackUsed) { host.dataset.loaded = '0'; host.dataset.failed = '1'; return; }
      const fb = img.dataset.fallback;
      if (fb) { img.dataset.fallbackUsed = '1'; img.src = fb; }
      else { host.dataset.loaded = '0'; host.dataset.failed = '1'; }
    });
  }
  return imgs.length;
}

/** 攻撃・被弾・撃破・登場の CSS モーションとエフェクト（静止画に対する表示演出のみ） */
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

/** 表示中のバリエーションを切り替える（色違いの別ファイルをそのまま差し替える） */
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
    entries: hosts.map(h => ({ id:h.dataset.enemyArt, loaded:h.dataset.loaded === '1',
      src:h.querySelector('.enemy-art-img')?.getAttribute('src') || '' })),
  };
}

export function initEnemyArt() { return syncEnemyArt(); }
