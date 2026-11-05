// ============ 武器・装備データ ============
export const RARITIES = ['N','R','E','L','M','S'];
export const RARITY = {
  N:{name:'ノーマル',     color:'#a8b0b8', mult:1.0,  effects:0, sell:50,    weight:52},
  R:{name:'レア',         color:'#59c2f0', mult:1.55, effects:0, sell:160,   weight:28},
  E:{name:'エピック',     color:'#b48cf2', mult:2.3,  effects:1, sell:480,   weight:13},
  L:{name:'レジェンダリー',color:'#f2c94c', mult:3.4,  effects:2, sell:1600,  weight:5},
  M:{name:'ミシック',     color:'#ff8a50', mult:5.0,  effects:2, sell:5200,  weight:1.7},
  S:{name:'シークレット', color:'#ff5fa2', mult:7.5,  effects:3, sell:16000, weight:0.3},
};
export const SLOTS = {
  weapon:{name:'武器', ico:'🗡️'},
  armor:{name:'防具', ico:'🛡️'},
  accessory:{name:'アクセサリー', ico:'💍'},
  ornament:{name:'装飾品', ico:'📿'},
};
// 武器テンプレート [タイプ][レアリティ]
export const WEAPON_NAMES = {
  sword:  ['鉄の剣','鋼の剣','白銀の剣','聖剣デュランダル','魔剣アポカリプス','創世神剣エクスカリバー'],
  axe:    ['手斧','バトルアックス','ミスリルアクス','ジャイアントベイン','獄斧ラグナロク','滅界斧デストリア'],
  spear:  ['青銅の槍','白銀の槍','竜牙の槍','聖槍ロンギヌス','魔槍ゲイボルグ','神槍グングニル'],
  bow:    ['短弓','長弓','精霊の弓','鳳凰の弓','魔弓アルテミス','天星弓オリオン'],
  gun:    ['旧式銃','魔導銃','銀弾の銃','聖銃ジャッジメント','魔銃カオスバレット','神銃デウスエクスマキナ'],
  staff:  ['木の杖','魔導杖','精霊の杖','賢者の杖','魔神杖ルシファー','創世杖カドゥケウス'],
  special:['旅の籠手','闘士の籠手','精霊の宝具','英雄の聖遺物','魔神の心臓','原初の宝玉'],
};
export const ARMOR_NAMES    = ['布の服','革の鎧','鎖帷子','聖騎士の鎧','竜鱗の鎧','神域の衣'];
export const ACCESSORY_NAMES= ['銅の指輪','銀の指輪','精霊の指輪','英雄の指輪','竜眼の指輪','神代の指輪'];
export const ORNAMENT_NAMES = ['旅のお守り','戦士の紋章','精霊の宝珠','王者の冠','竜皇の宝玉','創世の欠片'];

// 特殊効果プール(エピック以上)
export const EFFECT_POOL = [
  {key:'crit',     name:'会心強化',   desc:'会心率+{v}%',        min:4, max:12},
  {key:'drain',    name:'生命吸収',   desc:'与ダメージの{v}%吸収', min:3, max:10},
  {key:'elem',     name:'属性増幅',   desc:'属性ダメージ+{v}%',   min:6, max:18},
  {key:'regen',    name:'自然治癒',   desc:'毎ターンHP{v}%回復',  min:2, max:5},
  {key:'mpSave',   name:'魔力節約',   desc:'消費MP-{v}%',        min:8, max:25},
  {key:'gauge',    name:'闘志高揚',   desc:'闘志上昇+{v}%',      min:10,max:30},
  {key:'guard',    name:'鉄壁',      desc:'被ダメージ-{v}%',     min:3, max:9},
  {key:'berserk',  name:'背水',      desc:'HP30%以下で攻撃+{v}%',min:10,max:30},
  {key:'resist',   name:'状態耐性',   desc:'状態異常耐性+{v}%',   min:15,max:40},
  {key:'first',    name:'先制',      desc:'戦闘開始時 闘志+{v}',  min:15,max:40},
];
export const EFFECT_MAP = Object.fromEntries(EFFECT_POOL.map(e=>[e.key,e]));

// レアリティ別基礎ステータス(武器はatk/mag、防具はdef/hp、アクセはspd/acc/eva/mp、装飾は万能)
const BASE = {
  weapon:   {atk:10, mag:10, hp:0,  mp:0,  def:0, spd:1, acc:2, eva:0},
  armor:    {atk:0,  mag:0,  hp:40, mp:0,  def:8, spd:0, acc:0, eva:1},
  accessory:{atk:2,  mag:2,  hp:10, mp:12, def:1, spd:3, acc:3, eva:2},
  ornament: {atk:3,  mag:3,  hp:22, mp:8,  def:2, spd:1, acc:1, eva:1},
};
let _uid = 1;
export function makeEquip(slot, rarity, type=null, opts={}){
  const ri = RARITIES.indexOf(rarity);
  const r = RARITY[rarity];
  const names = slot==='weapon' ? WEAPON_NAMES[type||'sword']
    : slot==='armor' ? ARMOR_NAMES : slot==='accessory' ? ACCESSORY_NAMES : ORNAMENT_NAMES;
  const base = BASE[slot];
  const grade = 0.9 + Math.random()*0.25; // 個体差
  const stats = {};
  for (const k in base){
    if (!base[k]) continue;
    let v = base[k]*r.mult*grade;
    if (k==='acc'||k==='eva') v = base[k]*r.mult*grade*0.8;
    stats[k] = Math.max(1, Math.round(v));
  }
  const effects = [];
  const pool = [...EFFECT_POOL];
  for (let i=0;i<r.effects && pool.length;i++){
    const e = pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    const v = Math.round(e.min + Math.random()*(e.max-e.min));
    effects.push({key:e.key, val:v});
  }
  return {
    uid: 'eq'+Date.now().toString(36)+(_uid++),
    slot, type: slot==='weapon'?(type||'sword'):null,
    rarity, name: names[ri], lv:0, stats, effects,
    template: slot+':'+(type||'')+':'+rarity,
    special: opts.special||false,
  };
}
export function equipPower(eq){ // 表示用戦力
  const m = 1 + eq.lv*0.09;
  return Math.round(((eq.stats.atk||0)+(eq.stats.mag||0))*3*m + ((eq.stats.def||0)*2+(eq.stats.hp||0)*0.3+(eq.stats.mp||0)*0.2+(eq.stats.spd||0)*2+(eq.stats.acc||0)+(eq.stats.eva||0))*m + eq.effects.length*40);
}
export function equipStat(eq, k){ return Math.round((eq.stats[k]||0)*(1+eq.lv*0.09)); }
export function enhanceCost(lv){ return {coins: Math.round(120*Math.pow(lv+1,1.55)), stone: lv<10?1:0, hiStone: lv>=10?1:0}; }
export const MAX_ENHANCE = 15;

// ガチャ確率(%)と天井
export const GACHA_RATES = RARITIES.map(r=>({r, rate:RARITY[r].weight}));
export const PITY_L = 20;   // 20回以内にL以上保証
export const PITY_M = 80;   // 80回以内にM以上保証
export const GACHA_COST = 300;
export const GACHA_COST10 = 2700;

// 対戦ポイント交換の特別装備
export const SPECIAL_EQUIPS = [
  {id:'sp_hero_sword', name:'英雄王の剣', slot:'weapon', type:'sword', rarity:'S', cost:2500, desc:'歴代英雄王の魂が宿る剣'},
  {id:'sp_god_armor', name:'神域の聖衣', slot:'armor', rarity:'S', cost:3000, desc:'神域の加護を纏った聖衣'},
  {id:'sp_dragon_eye', name:'竜神の眼帯', slot:'accessory', rarity:'S', cost:2200, desc:'全てを見通す竜神の片眼'},
  {id:'sp_genesis', name:'創世の首飾り', slot:'ornament', rarity:'S', cost:2800, desc:'世界創生の記憶を宿す首飾り'},
];
