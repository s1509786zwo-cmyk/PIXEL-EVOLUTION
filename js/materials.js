/* ===========================================================
   進化素材の定義とアイコン生成
   - 8種類 × 5ランク = 40種。形状・模様・質感・装飾・発光を
     種類ごと AND ランクごとに変える（色違いの使い回しはしない）
   =========================================================== */

export const MAT_RANKS = ['R', 'SR', 'SSR', 'UR', 'LR'];

export const MAT_RANK_INFO = {
  R:   { name:'R',   color:'#aebfd4', glow:'#dbe8ff', desc:'自然な鉱石・結晶。控えめな光。', weight:1,
         label:'素朴な鉱石・控えめな光', source:'CPU対戦・デイリーミッション・道具屋' },
  SR:  { name:'SR',  color:'#78c8ff', glow:'#c8efff', desc:'透明感のある結晶。内部に光が宿る。', weight:2,
         label:'透明感と銀青の装飾リング', source:'ダンジョン踏破・修行クエスト・素材合成' },
  SSR: { name:'SSR', color:'#ffd77a', glow:'#fff2b8', desc:'金色の装飾と複雑な結晶構造。', weight:3,
         label:'金紫の紋章と目立つオーラ', source:'ボス撃破・高難易度クエスト・交換所' },
  UR:  { name:'UR',  color:'#d2a0ff', glow:'#f2d4ff', desc:'複数の結晶が融合した神秘の素材。強い発光。', weight:4,
         label:'強い発光・王冠・神秘の粒子', source:'隠しボス・高難易度ダンジョン・上位実績' },
  LR:  { name:'LR',  color:'#f7f0c8', glow:'#ffffff', desc:'虹色・白金色の光。内部に星と宇宙を宿す。', weight:5,
         label:'虹色・白金色の専用オーラと星屑', source:'最上位実績・隠しボス撃破・BP交換' },
};

export const MATERIAL_KINDS = [
  { id:'evo_stone',     name:'進化石',       shape:'ore',      hue:'#8da6c4',
    desc:'ランク進化の基点となる不規則な鉱石。断面に成長の層が見える。',
    obtain:'CPU対戦・デイリーミッション・道具屋', use:'キャラクター / 装備のランク進化' },
  { id:'awaken_crystal',name:'覚醒結晶',     shape:'prism',    hue:'#9ad8ff',
    desc:'縦長の六角柱クリスタル。内部を光がゆっくり巡る。',
    obtain:'ダンジョン・修行クエスト・素材交換所', use:'キャラクター / 装備のランク進化' },
  { id:'mana_crystal',  name:'魔力結晶',     shape:'gem',      hue:'#b39aff',
    desc:'八角形の宝石に同心の魔法陣が刻まれている。魔力を蓄える。',
    obtain:'魔法系CPU・高難易度クエスト', use:'上位ランク進化 / 技の習得' },
  { id:'job_proof',     name:'職業の証',     shape:'shield',   hue:'#e8c890',
    desc:'盾型のメダルとリボン。職業熟練の証として授与される。',
    obtain:'実績達成・修行クエスト・ボス撃破', use:'上級職 / 装備ランク進化' },
  { id:'weapon_ore',    name:'武器強化鉱石', shape:'ingot',    hue:'#c9a07a',
    desc:'層状の金属インゴット。鍛えるほど紋様が浮かび上がる。',
    obtain:'CPU対戦・ダンジョン・道具屋', use:'武器・防具のランク進化 / 強化' },
  { id:'element_gem',   name:'属性の宝石',   shape:'diamond',  hue:'#7fe6c8',
    desc:'回転する多面体。内部で属性の炎が揺れている。',
    obtain:'属性ボス・高難易度ダンジョン', use:'SSR以上の進化 / 属性装備' },
  { id:'boss_core',     name:'ボスの核',     shape:'core',     hue:'#ff8f8f',
    desc:'強敵の中心核。トゲに覆われ、今も脈動している。',
    obtain:'ボス撃破・隠しボス', use:'UR / LR への進化' },
  { id:'legend_mat',    name:'伝説の素材',   shape:'legend',   hue:'#fff0b0',
    desc:'星と羽を纏った伝説の結晶。内部に小さな宇宙が広がる。',
    obtain:'隠しボス・深淵・実績・素材交換所', use:'LR への最終進化' },
];

export const MATERIAL_KIND = Object.fromEntries(MATERIAL_KINDS.map(k => [k.id, k]));

function rankPalette(rank, kind) {
  const base = kind.hue;
  switch (rank) {
    case 'R':   return { body:base, dark:'#5c6b82', light:'#e2ecf8', glow:'#dbe8ff', ring:'#8b9ab0', accent:'#ffffff', stops:[base, '#7388a4'] };
    case 'SR':  return { body:'#7fc9f5', dark:'#2a6fa8', light:'#e6f9ff', glow:'#a8e8ff', ring:'#bfeaff', accent:'#ffffff', stops:['#bdefff','#4aa8e0','#2a6fa8'] };
    case 'SSR': return { body:'#ffd77a', dark:'#a9741f', light:'#fff4c4', glow:'#ffe89a', ring:'#ffdf8e', accent:'#c79bff', stops:['#fff3bc','#ffc75a','#a9741f'] };
    case 'UR':  return { body:'#c997ff', dark:'#6230a8', light:'#f6ddff', glow:'#e2b6ff', ring:'#d9aeff', accent:'#68f7d4', stops:['#f6ddff','#a768e8','#5a2aa0'] };
    default:    return { body:'#fff6d0', dark:'#b9a24e', light:'#ffffff', glow:'#ffffff', ring:'#fff3bc', accent:'#8ef0e3',
      stops:['#fff8dc','#ffd77a','#8ef0e3','#8fb8ff','#d8a6ff','#fff8dc'] };
  }
}
const gid = id => id.replace(/[^a-zA-Z0-9_-]/g, '_');

/* ---------- 種類ごとに完全に異なる形状 ---------- */
function shapeSVG(shape, p, rank, id) {
  const g = `url(#${gid(id)}_g)`, glow = `url(#${gid(id)}_glow)`;
  const stroke = `stroke="${p.dark}" stroke-width="1.6" stroke-linejoin="round"`;
  const facet = `stroke="${p.light}" stroke-width="1" opacity=".65" fill="none"`;
  switch (shape) {
    case 'ore': return `
      <path d="M9 27 L21 9 L43 11 L56 28 L49 51 L25 57 L8 44 Z" fill="${g}" ${stroke}/>
      <path d="M9 27 L25 31 L21 9 M25 31 L43 11 M25 31 L56 28 M25 31 L49 51 M25 31 L8 44 M25 31 L25 57" ${facet}/>
      <path d="M21 9 L26 4 L43 11 M8 44 L4 39 L9 27" fill="none" stroke="${p.dark}" stroke-width="1" opacity=".5"/>`;
    case 'prism': return `
      <path d="M32 3 L46 17 L44 47 L32 61 L20 47 L18 17 Z" fill="${g}" ${stroke}/>
      <path d="M32 3 L32 61 M18 17 L32 22 L46 17 M20 47 L32 42 L44 47 M32 22 L32 42" ${facet}/>
      <path d="M20 47 L18 17 L32 22 Z" fill="${p.light}" opacity=".16"/>
      <ellipse cx="32" cy="32" rx="6" ry="13" fill="${glow}" opacity=".55"/>`;
    case 'gem': return `
      <path d="M22 6 H42 L57 21 V43 L42 58 H22 L7 43 V21 Z" fill="${g}" ${stroke}/>
      <path d="M22 6 L32 17 L42 6 M7 21 L18 32 L7 43 M22 58 L32 47 L42 58 M57 21 L46 32 L57 43" ${facet}/>
      <circle cx="32" cy="32" r="15" fill="none" stroke="${p.light}" stroke-width="1.4" opacity=".7"/>
      <circle cx="32" cy="32" r="9" fill="none" stroke="${p.light}" stroke-width="1" opacity=".55" stroke-dasharray="3 3"/>
      <circle cx="32" cy="32" r="4" fill="${glow}"/>`;
    case 'shield': return `
      <path d="M32 4 L54 13 V33 Q54 49 32 59 Q10 49 10 33 V13 Z" fill="${g}" ${stroke}/>
      <path d="M32 9 L48 16 V33 Q48 45 32 53 Q16 45 16 33 V16 Z" fill="none" stroke="${p.light}" stroke-width="1.2" opacity=".7"/>
      <path d="M32 18 L36 27 L46 28 L38 35 L40 45 L32 40 L24 45 L26 35 L18 28 L28 27 Z" fill="${glow}" opacity=".9"/>
      <path d="M8 48 L18 54 L14 60 L4 55 Z M56 48 L46 54 L50 60 L60 55 Z" fill="${p.dark}" opacity=".8"/>`;
    case 'ingot': return `
      <path d="M7 39 L16 23 H48 L57 39 L48 54 H16 Z" fill="${g}" ${stroke}/>
      <path d="M16 23 L25 33 H39 L48 23 M7 39 H57 M16 54 L25 44 H39 L48 54" ${facet}/>
      <path d="M18 15 H44 L50 22 H12 Z" fill="${p.dark}" opacity=".55" stroke="${p.light}" stroke-width="1"/>
      <path d="M24 33 L32 27 L40 33 L32 39 Z" fill="${glow}" opacity=".7"/>`;
    case 'diamond': return `
      <path d="M32 3 L53 24 L32 59 L11 24 Z" fill="${g}" ${stroke}/>
      <path d="M32 3 L32 59 M11 24 L32 31 L53 24 M32 31 L20 43 M32 31 L44 43" ${facet}/>
      <path d="M32 13 L42 31 L32 47 L22 31 Z" fill="${p.light}" opacity=".22"/>
      <path d="M24 22 Q28 14 32 20 Q36 12 40 22" fill="none" stroke="${p.glow}" stroke-width="1.6" opacity=".9"/>`;
    case 'core': return `
      ${Array.from({length:10},(_,i)=>{const a=i*36*Math.PI/180;const x=32+Math.cos(a)*26,y=32+Math.sin(a)*26;const x2=32+Math.cos(a)*19,y2=32+Math.sin(a)*19;return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${(32+Math.cos(a-0.16)*19).toFixed(1)} ${(32+Math.sin(a-0.16)*19).toFixed(1)} L${(32+Math.cos(a+0.16)*19).toFixed(1)} ${(32+Math.sin(a+0.16)*19).toFixed(1)} Z" fill="${p.dark}" stroke="${p.light}" stroke-width=".6"/>`;}).join('')}
      <circle cx="32" cy="32" r="20" fill="${g}" ${stroke}/>
      <circle cx="32" cy="32" r="13" fill="${glow}" opacity=".55"/>
      <ellipse cx="32" cy="32" rx="10" ry="7" fill="${p.light}" opacity=".85"/>
      <circle cx="32" cy="32" r="5" fill="${p.dark}"/>
      <circle cx="30" cy="30" r="2" fill="#fff"/>`;
    default: return `
      <path d="M32 2 L38 20 L57 12 L47 30 L62 38 L43 40 L47 59 L32 47 L17 59 L21 40 L2 38 L17 30 L7 12 L26 20 Z" fill="${g}" ${stroke}/>
      <circle cx="32" cy="31" r="13" fill="${p.dark}" opacity=".85"/>
      <circle cx="32" cy="31" r="10" fill="${glow}" opacity=".55"/>
      <path d="M22 8 L32 2 L42 8 L38 14 H26 Z" fill="${p.ring}" stroke="${p.dark}" stroke-width="1"/>`;
  }
}

/* ---------- ランクごとの装飾・発光 ---------- */
function rankDecor(rank, p, id) {
  const ring = `fill="none" stroke="${p.ring}"`;
  const spark = (x,y,r=1.6) => `<path d="M${x} ${y-r*2} L${x+r*.6} ${y-r*.6} L${x+r*2} ${y} L${x+r*.6} ${y+r*.6} L${x} ${y+r*2} L${x-r*.6} ${y+r*.6} L${x-r*2} ${y} L${x-r*.6} ${y-r*.6} Z" fill="#fff" opacity=".9"/>`;
  if (rank === 'R') return `${spark(12,12,1.1)}${spark(52,50,1)}`;
  if (rank === 'SR') return `<circle cx="32" cy="32" r="28" ${ring} stroke-width="1" opacity=".6"/>
    <circle cx="32" cy="32" r="24" fill="none" stroke="${p.light}" stroke-width=".6" opacity=".35"/>
    ${spark(10,16,1.4)}${spark(54,46,1.3)}`;
  if (rank === 'SSR') return `<circle cx="32" cy="32" r="29" ${ring} stroke-width="2"/>
    <circle cx="32" cy="32" r="25" fill="none" stroke="${p.accent}" stroke-width=".8" stroke-dasharray="4 3" opacity=".8"/>
    <path d="M32 0 L36 5 L32 10 L28 5 Z M32 64 L36 59 L32 54 L28 59 Z M0 32 L5 28 L10 32 L5 36 Z M64 32 L59 28 L54 32 L59 36 Z" fill="${p.ring}"/>
    ${spark(9,12,1.7)}${spark(55,14,1.5)}${spark(52,54,1.7)}${spark(11,52,1.5)}`;
  if (rank === 'UR') return `<circle cx="32" cy="32" r="30" ${ring} stroke-width="2.4"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="${p.accent}" stroke-width="1.2" stroke-dasharray="2 4" opacity=".9"/>
    <circle cx="32" cy="32" r="22" fill="none" stroke="${p.light}" stroke-width=".6" opacity=".5"/>
    ${Array.from({length:6},(_,i)=>{const a=i*60*Math.PI/180;return `<circle cx="${(32+Math.cos(a)*30).toFixed(1)}" cy="${(32+Math.sin(a)*30).toFixed(1)}" r="2.2" fill="${p.glow}"/>`;}).join('')}
    ${spark(7,9,2)}${spark(57,11,1.8)}${spark(9,55,1.8)}${spark(56,54,2)}${spark(32,2,1.6)}`;
  // LR：虹の二重リング + 星野 + 王冠 + 専用オーラ
  return `<circle cx="32" cy="32" r="31" fill="none" stroke="url(#${gid(id)}_rain)" stroke-width="3"/>
    <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" stroke-width="1" opacity=".8"/>
    <circle cx="32" cy="32" r="23" fill="none" stroke="url(#${gid(id)}_rain)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".9"/>
    ${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180,r=i%2?29:24;return spark((32+Math.cos(a)*r).toFixed(1),(32+Math.sin(a)*r).toFixed(1),i%3===0?1.8:1.1);}).join('')}
    <path d="M20 10 L24 3 L32 8 L40 3 L44 10 Z" fill="#fff8d8" stroke="${p.dark}" stroke-width=".8"/>
    <circle cx="32" cy="32" r="8" fill="none" stroke="#fff" stroke-width=".8" opacity=".7"/>`;
}

/** 素材アイコン（インラインSVG）。小さくても種類とランクが判別できる */
export function materialIcon(itemId, size = 48) {
  const def = MATERIAL_ITEMS.find(m => m.id === itemId);
  if (!def) return '';
  const kind = MATERIAL_KIND[def.matKind], p = rankPalette(def.rank, kind), id = gid(itemId);
  const glowR = { R:2, SR:3, SSR:4, UR:5, LR:6 }[def.rank];
  const stops = p.stops.map((c,i)=>`<stop offset="${(i/(p.stops.length-1)*100).toFixed(0)}%" stop-color="${c}"/>`).join('');
  const rainbow = `<linearGradient id="${id}_rain" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff8dc"/><stop offset="22%" stop-color="#ffd77a"/><stop offset="45%" stop-color="#8ef0e3"/><stop offset="68%" stop-color="#8fb8ff"/><stop offset="86%" stop-color="#d8a6ff"/><stop offset="100%" stop-color="#fff8dc"/></linearGradient>`;
  return `<svg class="mat-icon rank-${def.rank}" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${def.name} ${def.rank}">
    <defs>
      <linearGradient id="${id}_g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
      <radialGradient id="${id}_glow"><stop offset="0%" stop-color="#fff" stop-opacity=".95"/><stop offset="45%" stop-color="${p.glow}" stop-opacity=".7"/><stop offset="100%" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
      <filter id="${id}_blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${glowR}"/></filter>
      ${rainbow}
    </defs>
    ${def.rank==='LR'?`<circle cx="32" cy="32" r="30" fill="url(#${id}_glow)" filter="url(#${id}_blur)" opacity=".9"/>`:''}
    <circle cx="32" cy="32" r="26" fill="${p.glow}" filter="url(#${id}_blur)" opacity="${({R:.18,SR:.3,SSR:.42,UR:.55,LR:.7})[def.rank]}"/>
    <g class="mat-shape">${shapeSVG(kind.shape, p, def.rank, itemId)}</g>
    <g class="mat-decor">${rankDecor(def.rank, p, itemId)}</g>
  </svg>`;
}

/* ---------- 40種のアイテム定義 ---------- */
const OBTAIN_BY_RANK = {
  R:'CPU対戦・デイリーミッション・道具屋・ダンジョン',
  SR:'ダンジョン5階ごと・修行クエスト・素材交換所',
  SSR:'ボス撃破・高難易度クエスト・実績達成',
  UR:'ボス連戦・深淵・隠しボス関連クエスト',
  LR:'隠しボス・深淵20階・最終実績・素材交換所',
};
export const MATERIAL_ITEMS = [];
for (const k of MATERIAL_KINDS) for (const r of MAT_RANKS) {
  const weight = MAT_RANK_INFO[r].weight;
  MATERIAL_ITEMS.push({
    id:`${k.id}_${r}`, name:`${k.name}・${r}`, kind:'material', matKind:k.id, rank:r,
    icon:'◆', price: r==='R' ? Math.round(240*weight) : 0, sell:Math.round(90*Math.pow(3.1,weight-1)),
    desc:`${k.desc}【${r}】${MAT_RANK_INFO[r].desc}`,
    obtain:OBTAIN_BY_RANK[r], use:k.use,
    usedFor: r==='LR' ? '最終進化 / LR装備' : `${r} → ${MAT_RANKS[MAT_RANKS.indexOf(r)+1]} への進化`,
    stack: weight,
  });
}
export const MATERIAL_BY_ID = Object.fromEntries(MATERIAL_ITEMS.map(m => [m.id, m]));
export const isMaterial = id => !!MATERIAL_BY_ID[id];

/** 進化段階ごとの要求素材（種類を混ぜ、低ランクも無駄にしない） */
export const RANK_REQUIREMENTS = {
  SR:  [ {id:'evo_stone_R',n:3}, {id:'awaken_crystal_R',n:2}, {id:'weapon_ore_R',n:2} ],
  SSR: [ {id:'evo_stone_SR',n:3}, {id:'mana_crystal_SR',n:2}, {id:'job_proof_R',n:3}, {id:'element_gem_SR',n:1} ],
  UR:  [ {id:'awaken_crystal_SSR',n:3}, {id:'boss_core_SSR',n:2}, {id:'job_proof_SR',n:3}, {id:'weapon_ore_R',n:5} ],
  LR:  [ {id:'legend_mat_UR',n:2}, {id:'boss_core_UR',n:3}, {id:'element_gem_UR',n:3}, {id:'evo_stone_R',n:8}, {id:'mana_crystal_LR',n:1} ],
};

/** 素材交換：同ランク3個 → 1段階上位の同種素材 */
export function materialUpgradeTarget(id) {
  const m = MATERIAL_BY_ID[id];
  if (!m) return null;
  const i = MAT_RANKS.indexOf(m.rank);
  if (i >= MAT_RANKS.length-1) return null;
  return `${m.matKind}_${MAT_RANKS[i+1]}`;
}
