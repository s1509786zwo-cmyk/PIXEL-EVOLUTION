/* ============================================================
   敵キャラクター用の外部 3D アセット描画レイヤ
   ------------------------------------------------------------
   - assets/models/enemies/*.glb は実際に取得した CC0 の外部アセット。
     形状・色・テクスチャ・材質・リグ・アニメーションは一切書き換えない。
     ゲーム側で決めるのは「一様な拡大縮小」「向き」「接地位置」「カメラ」だけ。
   - three.js と GLTFLoader は WebGL が使える環境でのみ動的 import する。
     WebGL の無い環境（自動テスト / 旧端末）では既存の 2D スプライトを表示し、
     3D が読み込めた「ふり」はしない。
   - 1 枚の全面 canvas に scissor + viewport で複数体を描くため、
     render() が DOM を作り直しても WebGL コンテキストは作り直さない。
   ============================================================ */

const ASSET_BASE = 'assets/models/enemies/';

/** 取得済みアセットのメタデータ（出典・許諾・読み込み検証に使う） */
export const ENEMY_MODELS = {
  demon:    { file:'big_demon.glb',           pack:'Quaternius / Ultimate Monsters',       model:'Big Demon',          license:'CC0 1.0', label:'悪魔',               yaw:-0.36, fit:1.16, hover:0.00 },
  monster:  { file:'big_alien.glb',           pack:'Quaternius / Ultimate Monsters',       model:'Big Alien',          license:'CC0 1.0', label:'怪物',               yaw:-0.30, fit:1.00, hover:0.00 },
  angel:    { file:'flying_hywirl.glb',       pack:'Quaternius / Ultimate Monsters',       model:'Hywirl',             license:'CC0 1.0', label:'天使相当（翼を持つ浮遊型）', yaw:-0.34, fit:1.02, hover:0.18 },
  dragon:   { file:'flying_dragon.glb',       pack:'Quaternius / Ultimate Monsters',       model:'Flying Dragon',      license:'CC0 1.0', label:'竜',                 yaw:-0.42, fit:1.12, hover:0.16 },
  reaper:   { file:'flying_ghost_skull.glb',  pack:'Quaternius / Ultimate Monsters',       model:'Flying Ghost Skull', license:'CC0 1.0', label:'死神',               yaw:-0.30, fit:1.06, hover:0.18 },
  guardian: { file:'flying_goleling.glb',     pack:'Quaternius / Ultimate Monsters',       model:'Goleling',           license:'CC0 1.0', label:'古代の守護者',       yaw:-0.34, fit:1.18, hover:0.12 },
  titan:    { file:'big_mushroom_king.glb',   pack:'Quaternius / Ultimate Monsters',       model:'Mushroom King',      license:'CC0 1.0', label:'巨人',               yaw:-0.28, fit:1.24, hover:0.00 },
  abyss:    { file:'cthulhu.glb',             pack:'Quaternius / Cute Animated Monsters', model:'Cthulhu',            license:'CC0 1.0', label:'深海の異形',         yaw:-0.38, fit:1.14, hover:0.12 },
  fallen:   { file:'knight.glb',              pack:'KayKit / Adventurers',                 model:'Knight',             license:'CC0 1.0', label:'堕ちた聖騎士',       yaw:-0.36, fit:1.00, hover:0.00 },
  lich:     { file:'skeleton_mage.glb',       pack:'KayKit / Skeletons',                   model:'Skeleton Mage',      license:'CC0 1.0', label:'死者の魔導士',       yaw:-0.36, fit:1.00, hover:0.00 },
};

/** 既存 31 体の敵を、色違いではなく別シルエットのモデルに割り当てる */
const ARCHETYPE_MODEL = {
  rookie:'fallen', guard:'guardian', witch:'abyss', healer:'angel', bandit:'monster',
  hunter:'monster', fist:'titan', gunner:'fallen', sum:'monster', alch:'abyss',
  ninja:'reaper', sword:'fallen', arch:'lich', assa:'reaper', drag:'dragon',
  spell:'fallen', apo:'angel', boss1:'demon', boss2:'lich', boss3:'guardian', hidden:'reaper',
};

export function enemyModelKey(en) {
  if (!en) return 'demon';
  if (en.model3d && ENEMY_MODELS[en.model3d]) return en.model3d;
  const base = String(en.id || '').split('_')[0];
  return ARCHETYPE_MODEL[base] || 'demon';
}

/* ------------------------------------------------------------
   実行時状態
   ------------------------------------------------------------ */
const NORM_HEIGHT = 2.0;      // 接地させた後の基準高さ（ワールド単位）
const CAM_DIST = 5.4;
const TRIAL_KEY = 'demon';    // まず 1 体だけ試験導入してから残りを読み込む

let R = null;
let booted = false;
let activeKey = null;
let activeKind = 'idle';
let kindTimer = 0;
const status = Object.fromEntries(Object.keys(ENEMY_MODELS).map(k => [k, 'pending']));
const detail = {};
let trial = null;
let failure = null;

function setRootFlag(v) {
  try { document.documentElement.dataset.enemy3d = v; } catch (_) { /* no DOM */ }
}
function mark(key, st) { status[key] = st; }

function webglAvailable() {
  try {
    if (typeof window === 'undefined' || !window.document) return false;
    if (!window.WebGLRenderingContext && !window.WebGL2RenderingContext) return false;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl || typeof gl.getParameter !== 'function') return false;
    if (gl.getExtension) gl.getExtension('WEBGL_lose_context')?.loseContext?.();
    return true;
  } catch (_) { return false; }
}

/** 起動時に 1 回だけ呼ぶ。WebGL が無ければ何もしない */
export function initEnemy3D() {
  if (booted) return;
  booted = true;
  if (!webglAvailable()) { setRootFlag('unavailable'); return; }
  setRootFlag('loading');
  Promise.all([
    import('./three.module.js?v=2'),
    import('./three.GLTFLoader.js?v=2'),
  ]).then(([THREE, mod]) => {
    setup(THREE, mod.GLTFLoader);
    // 1 体だけ先に読み込み、表示・向き・大きさ・テクスチャ・動作を検証してから残りへ進む
    loadModel(THREE, TRIAL_KEY).then(ok => {
      trial = verifyTrial(ok);
      setRootFlag(ok ? 'ready' : 'error');
      syncEnemy3D();
      if (ok) {
        const rest = Object.keys(ENEMY_MODELS).filter(k => k !== TRIAL_KEY);
        return Promise.all(rest.map(k => loadModel(THREE, k)));
      }
      return null;
    }).catch(err => { failure = String(err && err.message || err); setRootFlag('error'); });
  }).catch(err => {
    failure = String(err && err.message || err);
    setRootFlag('error');
    console.warn('[enemy3d] three.js / GLTFLoader を読み込めませんでした', err);
  });
}

function setup(THREE, GLTFLoader) {
  const renderer = new THREE.WebGLRenderer({
    alpha:true, antialias:true, premultipliedAlpha:false, powerPreference:'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;

  const canvas = renderer.domElement;
  canvas.id = 'enemy3d-layer';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.65); key.position.set(3.5, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ec8ff, 0.95); rim.position.set(-4, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd9ad, 0.45); fill.position.set(0, 2, -6); scene.add(fill);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, NORM_HEIGHT * 0.56, CAM_DIST);
  camera.lookAt(0, NORM_HEIGHT * 0.50, 0);

  const loader = new GLTFLoader();
  R = { THREE, renderer, canvas, scene, camera, loader, models:new Map(), raf:0, last:0, hosts:[], resize:null };

  R.resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  };
  window.addEventListener('resize', R.resize);
  R.resize();
  startLoop();
}

/* ------------------------------------------------------------
   GLB の読み込み（元ファイルは一切改変しない）
   ------------------------------------------------------------ */
function loadModel(THREE, key) {
  const meta = ENEMY_MODELS[key];
  if (!meta || !R) return Promise.resolve(false);
  if (R.models.has(key)) return Promise.resolve(true);
  mark(key, 'loading');
  const url = ASSET_BASE + meta.file;
  return R.loader.loadAsync(url).then(gltf => {
    const root = gltf.scene;
    const group = new THREE.Group();
    group.add(root);
    R.scene.add(group);
    group.visible = false;

    // 形状・色・テクスチャ・材質はそのまま。接地と一様拡大だけ行う。
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = (NORM_HEIGHT / Math.max(size.y || 1, 0.0001)) * (meta.fit || 1);
    root.scale.setScalar(s);
    root.position.set(
      -((box.min.x + box.max.x) / 2) * s,
      -box.min.y * s + (meta.hover || 0),
      -((box.min.z + box.max.z) / 2) * s,
    );
    group.rotation.y = meta.yaw || 0;
    // 向きを付けた後の実寸を測る（翼・武器の張り出しで見切れないように）
    const finalBox = new THREE.Box3().setFromObject(group);
    const finalSize = finalBox.getSize(new THREE.Vector3());

    let meshes = 0, skins = 0, textured = 0, materialNames = new Set();
    root.traverse(o => {
      if (o.isMesh) {
        meshes++;
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          materialNames.add(m.name || '(unnamed)');
          const map = m.map || m.emissiveMap || m.normalMap;
          if (map && map.image) textured++;
        }
      }
      if (o.isSkinnedMesh) skins++;
    });

    const clips = gltf.animations || [];
    const mixer = clips.length ? new THREE.AnimationMixer(root) : null;
    const actions = {};
    for (const role of ['idle','move','attack','damage','death']) {
      const clip = pickClip(clips, role);
      if (clip && mixer) actions[role] = mixer.clipAction(clip);
    }
    const entry = {
      key, meta, group, root, mixer, actions, clips:clips.map(c => c.name),
      meshes, skins, textured, materials:materialNames.size, current:null, bob:0,
      box:{ x:finalSize.x, y:finalSize.y, z:finalSize.z, minY:finalBox.min.y },
    };
    R.models.set(key, entry);
    detail[key] = {
      file:meta.file, format:'GLB 2.0 (binary glTF)', url, license:meta.license,
      pack:meta.pack, model:meta.model, meshes, skins, materials:materialNames.size,
      textured:textured > 0, animations:entry.clips,
      size:entry.box, yaw:meta.yaw, fit:meta.fit, hover:meta.hover,
    };
    mark(key, 'ready');
    playClip(entry, 'idle');
    syncEnemy3D();
    return true;
  }).catch(err => {
    mark(key, 'error');
    detail[key] = { file:meta.file, format:'GLB 2.0', url, license:meta.license,
      pack:meta.pack, model:meta.model, error:String(err && err.message || err) };
    console.warn('[enemy3d] ' + meta.file + ' を読み込めませんでした', err);
    syncEnemy3D();
    return false;
  });
}

/** 元モデルのクリップ名から 待機 / 移動 / 攻撃 / ダメージ / 撃破 を割り当てる */
const ROLE_PATTERNS = {
  idle:   [/^idle$/i, /flying_idle/i, /^jump_idle$/i, /^standing$/i, /^flying$/i, /idle/i],
  move:   [/^walk$/i, /fast_flying/i, /^run$/i, /^flying$/i, /walk|run|flying/i],
  attack: [/^punch$/i, /^weapon$/i, /bite_front/i, /headbutt/i, /^wave$/i, /^jump$/i, /attack|punch|weapon|bite/i],
  damage: [/hitreact/i, /hitrecieve/i, /^hit/i, /flinch/i],
  death:  [/^death$/i, /^die$/i, /death/i],
};
function pickClip(clips, role) {
  for (const re of ROLE_PATTERNS[role]) {
    const hit = clips.find(c => re.test(c.name));
    if (hit) return hit;
  }
  return null;
}
function playClip(entry, role) {
  if (!entry || !entry.mixer || !R) return;
  const action = entry.actions[role] || entry.actions.idle;
  if (!action || entry.current === action) return;
  for (const a of Object.values(entry.actions)) if (a !== action) a.fadeOut(0.16);
  const once = role === 'death' || role === 'damage' || role === 'attack';
  action.reset().setLoop(once ? R.THREE.LoopOnce : R.THREE.LoopRepeat,
    once ? 1 : Infinity).fadeIn(0.14).play();
  entry.current = action;
}

/** 試験導入 1 体の検証（表示・向き・大きさ・テクスチャ・動作） */
function verifyTrial(loaded) {
  const e = R && R.models.get(TRIAL_KEY);
  if (!loaded || !e) return { ok:false, reason:'GLB の読み込みに失敗' };
  const box = new R.THREE.Box3().setFromObject(e.group);   // 変換後の実際の接地位置
  const t = {
    key:TRIAL_KEY, file:e.meta.file,
    display:!!e.group && e.group.parent === R.scene,
    oriented:typeof e.group.rotation.y === 'number' && Math.abs(e.meta.yaw) > 0.1,
    sized:e.box.y > 0.5 && e.box.y < 8 && e.root.scale.x > 0,
    grounded:Math.abs(box.min.y - (e.meta.hover || 0)) < 0.02 && box.max.y < 4,
    textured:e.textured > 0 && e.materials > 0,
    rigged:e.skins > 0,
    animated:Object.keys(e.actions).length >= 4,
    roles:Object.keys(e.actions),
  };
  t.ok = ['display','oriented','sized','grounded','textured','rigged','animated'].every(k => !!t[k]);
  return t;
}

/* ------------------------------------------------------------
   DOM との同期と描画
   ------------------------------------------------------------ */
export function syncEnemy3D() {
  if (!R) return;
  R.hosts = Array.from(document.querySelectorAll('[data-enemy3d]'));
  const battle = R.hosts.find(h => h.dataset.enemy3dBattle === '1');
  if (battle) activeKey = battle.dataset.enemy3d;
  else if (!R.hosts.some(h => h.dataset.enemy3d === activeKey)) activeKey = null;
  for (const h of R.hosts) {
    const st = status[h.dataset.enemy3d];
    if (st === 'ready') h.dataset.enemy3dLoaded = '1';
    else h.dataset.enemy3dLoaded = st || 'pending';
  }
  startLoop();
}

export function playEnemy3D(kind, key) {
  if (!R) return;
  const k = key || activeKey;
  const entry = R && R.models.get(k);
  if (!entry) return;
  activeKind = kind;
  clearTimeout(kindTimer);
  // 同じ種類の演出が連続しても（連撃など）毎回最初から再生する
  if (kind !== 'idle' && entry.current === entry.actions[kind]) entry.current = null;
  playClip(entry, kind);
  if (kind !== 'idle' && kind !== 'death') {
    kindTimer = setTimeout(() => {
      const cur = R && R.models.get(k);
      if (cur && cur.current === entry.actions[kind]) playClip(cur, 'idle');
    }, kind === 'move' ? 1100 : 950);
  }
}

function startLoop() {
  if (!R || R.raf) return;
  if (!R.last) R.last = performance.now();
  R.raf = requestAnimationFrame(loop);
}
function loop(now) {
  if (!R) return;
  R.raf = 0;
  const dt = Math.min((now - R.last) / 1000, 0.05);
  R.last = now;
  for (const m of R.models.values()) {
    if (m.mixer) m.mixer.update(dt);
    if ((m.meta.hover || 0) > 0) {
      m.bob += dt;
      m.group.position.y = Math.sin(m.bob * 1.9) * 0.045;
    }
  }
  const ch = window.innerHeight;   // three.js の setViewport/setScissor は CSS px を内部で dpr 倍する
  let drew = false;
  for (const host of R.hosts) {
    const key = host.dataset.enemy3d;
    const m = R.models.get(key);
    if (!m || !host.isConnected) continue;
    const r = host.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > ch) continue;
    const x = Math.round(r.left), y = Math.round(ch - r.bottom);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    for (const other of R.models.values()) other.group.visible = false;
    m.group.visible = true;
    const aspect = w / h;
    R.camera.aspect = aspect;
    // モデルごとの実寸に合わせてカメラ距離を決める（埋もれ・見切れ・極端な小ささを防ぐ）
    const tan = Math.tan(R.camera.fov * Math.PI / 360);
    const needH = m.box.y * 1.30 + (m.meta.hover || 0);
    const needW = m.box.x * 1.08;
    const dist = Math.max(3.4, needH / (2 * tan), needW / (2 * tan * aspect));
    const cy = m.box.y * 0.5 + (m.meta.hover || 0);
    R.camera.position.set(0, cy * 1.04, dist);
    R.camera.lookAt(0, cy, 0);
    R.camera.updateProjectionMatrix();
    R.renderer.setViewport(x, y, w, h);
    R.renderer.setScissor(x, y, w, h);
    R.renderer.setScissorTest(true);
    R.renderer.clear(true, true, true);
    R.renderer.render(R.scene, R.camera);
    drew = true;
  }
  R.renderer.setScissorTest(false);
  void drew;
  startLoop();   // 常時回し、表示対象が無いフレームは描画だけスキップする
}

/* ------------------------------------------------------------
   レポート（読み込み成否を正直に返す）
   ------------------------------------------------------------ */
export function enemy3dReport() {
  return {
    available:!!R,
    webgl:webglAvailable(),
    state:(typeof document !== 'undefined' && document.documentElement)
      ? document.documentElement.dataset.enemy3d : 'unknown',
    failure, trial, activeKey, activeKind,
    models:Object.keys(ENEMY_MODELS).map(k => ({
      key:k, label:ENEMY_MODELS[k].label,
      asset:ENEMY_MODELS[k].model,
      file:ENEMY_MODELS[k].file,
      format:detail[k]?.format || 'GLB 2.0 (binary glTF)',
      license:ENEMY_MODELS[k].license,
      pack:ENEMY_MODELS[k].pack,
      status:status[k],
      loaded:status[k] === 'ready',
      textures:detail[k]?.textured ?? null,
      materials:detail[k]?.materials ?? null,
      skins:detail[k]?.skins ?? null,
      animations:detail[k]?.animations || [],
      error:detail[k]?.error || null,
    })),
  };
}

if (typeof window !== 'undefined') {
  window.__OCF3D = { report:enemy3dReport, play:playEnemy3D, sync:syncEnemy3D,
    init:initEnemy3D, models:ENEMY_MODELS };
}
