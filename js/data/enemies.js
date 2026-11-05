// ============ 敵・CPU対戦・ダンジョンデータ ============
import { JOB_MAP } from './jobs.js?v=20261105c';
import { SKILL_MAP } from './skills.js?v=20261105c';

export const DIFFICULTIES = [
  {id:'easy',   name:'やさしい', mult:0.80, lvOff:-3, reward:0.8,  ai:'simple', color:'#7ed491'},
  {id:'normal', name:'ふつう',   mult:1.00, lvOff:0,  reward:1.0,  ai:'normal', color:'#59c2f0'},
  {id:'hard',   name:'つよい',   mult:1.25, lvOff:3,  reward:1.4,  ai:'smart',  color:'#f2c94c'},
  {id:'extra',  name:'激ムズ',   mult:1.55, lvOff:6,  reward:1.9,  ai:'smart',  color:'#ff8a50'},
  {id:'nightmare',name:'悪夢',   mult:1.90, lvOff:10, reward:2.6,  ai:'smart',  color:'#ff5fa2'},
];
export const DIFF_MAP = Object.fromEntries(DIFFICULTIES.map(d=>[d.id,d]));

export const OPPONENT_NAMES = [
  '蒼剣のレオン','紅蓮のアカネ','疾風のハヤテ','岩鉄のガンテツ','月影のツキヨ','雷鳴のライガ',
  '聖女のルミナ','黒猫のクロエ','砂塵のザハル','氷結のフロスト','炎拳のバオウ','翠風のミドリ',
  '銀髪のシルヴァ','金獅子のレオナルド','紫電のシデン','白翼のセラフィ','鉄壁のバルドル','幻術のマボロシ',
  '星詠みのステラ','海鳴りのマリン','暁のアカツキ','黄昏のタソガレ','霧雨のキリサメ','爆炎のマグマ',
  '凍土のツンドラ','天空のソラ','深淵のノクティス','陽光のソレイユ','嵐のテンペスト','静寂のシズカ',
];

export const BOSSES = [
  {id:'flame_lord', name:'炎帝フレイムロード', job:'berserker', level:30, mult:1.6, ico:'🔥',
    desc:'灼熱の支配者。倒せば炎の覇気を習得できる。', skills:['flame_burst','dragon_fist','rage','fire_breath','berserk_axe'],
    reward:{coins:1500, points:80, mats:{awk_shard:2, stone:3}}},
  {id:'frost_queen', name:'氷皇フロストクイーン', job:'archmage', level:50, mult:1.7, ico:'❄️',
    desc:'絶対零度の女王。倒せば氷の絶界を習得できる。', skills:['blizzard','book_absolute_zero','gravity_well','mana_shield','ice_shard'],
    reward:{coins:3000, points:140, mats:{awk_crystal:2, hi_stone:2}}},
  {id:'storm_king', name:'嵐王ストームキング', job:'dragoon', level:70, mult:1.8, ico:'⚡',
    desc:'天空を統べる嵐の王。倒せば天罰を習得できる。', skills:['judgment_thunder','sky_dominion','wyvern_dive','dragon_scale','railgun_shot'],
    reward:{coins:5500, points:220, mats:{awk_orb:2, hi_stone:3}}},
  {id:'dragon_emperor', name:'竜帝バハムート', job:'dragoon', level:85, mult:2.0, ico:'🐉',
    desc:'全ての竜の頂点。倒せば竜帝の心臓を習得できる。', skills:['bahamut_lance','dragon_king','fire_breath','dragon_scale','world_breaker'],
    reward:{coins:9000, points:320, mats:{awk_core:1, hi_stone:4}}},
  {id:'demon_lord', name:'魔王ゼノグレイア', job:'destroyer', level:100, mult:2.2, ico:'😈',
    desc:'深淵より来たりし魔王。倒せば魔眼を習得できる。', skills:['extinction','universe_end','wrath_of_god','forbidden_tome','doom_cleave'],
    reward:{coins:15000, points:500, mats:{awk_genesis:1, hi_stone:5}}},
  {id:'nameless_king', name:'無名の王', job:'chronomancer', level:120, mult:2.6, ico:'👁️', hidden:true,
    desc:'記録から消えた王。真の強者のみが辿り着ける。', skills:['event_horizon','time_stop','infinity_break','accel_world','boss_void_touch','ultima'],
    reward:{coins:30000, points:1000, mats:{awk_genesis:2, rebirth_proof:1}}},
];
export const BOSS_MAP = Object.fromEntries(BOSSES.map(b=>[b.id,b]));

export const DUNGEONS = [
  {id:'cave', name:'試練の洞窟', ico:'🕳️', floors:5, baseLv:8,  lvStep:3,  recLv:10, desc:'新米ファイターのための洞窟。',
    clearReward:{coins:800, points:40, mats:{stone:3, awk_shard:1}}},
  {id:'ruins', name:'古代遺跡', ico:'🏛️', floors:7, baseLv:28, lvStep:4,  recLv:32, desc:'眠れる古代の力が試される遺跡。',
    clearReward:{coins:2500, points:100, mats:{hi_stone:2, awk_crystal:1}}},
  {id:'castle', name:'魔王城', ico:'🏰', floors:10, baseLv:52, lvStep:5, recLv:58, desc:'魔王の軍勢が待ち受ける難攻不落の城。',
    clearReward:{coins:7000, points:250, mats:{awk_orb:2, hi_stone:3}}},
  {id:'abyss', name:'深淵の塔', ico:'🗼', floors:12, baseLv:78, lvStep:6, recLv:85, desc:'高難易度。深淵の頂を目指す者の塔。',
    clearReward:{coins:18000, points:600, mats:{awk_core:1, hi_stone:5}}},
  {id:'void', name:'虚無の間', ico:'🌌', floors:1, baseLv:120, lvStep:0, recLv:110, hidden:true, desc:'無名の王が座す虚無の玉座。',
    clearReward:{coins:50000, points:1500, mats:{awk_genesis:2, rebirth_proof:1}}},
];
export const DUNGEON_MAP = Object.fromEntries(DUNGEONS.map(d=>[d.id,d]));

// 敵ユニット生成
export function makeEnemy({job, level, mult=1, name, skills, seed, isBoss=false, diff='normal'}){
  const j = JOB_MAP[job] || JOB_MAP.fighter;
  const stats = {};
  for (const k in j.base){
    stats[k] = Math.round((j.base[k] + j.growth[k]*(level-1)) * mult);
  }
  // 装備相当の補正
  stats.hp = Math.round(stats.hp*(1+level*0.012));
  stats.atk = Math.round(stats.atk*(1+level*0.008));
  stats.def = Math.round(stats.def*(1+level*0.008));
  let sk = skills;
  if (!sk){
    sk = j.learn.filter(l=>l.lv<=level).map(l=>l.id);
    sk = sk.slice(-5);
    if (level>=6) sk.push('spirit_charge');
    if (level>=30) sk.push('all_out');
    if (level>=40) sk.push('limit_break');
  }
  sk = sk.filter(id=>SKILL_MAP[id]);
  return {name: name||'CPUファイター', job, level, stats, skills:sk, seed: seed||name||job, isBoss, diff, style:j.style};
}

export function makeOpponent(playerLevel, diffId, rng=Math.random){
  const d = DIFF_MAP[diffId]||DIFF_MAP.normal;
  const jobIds = Object.keys(JOB_MAP).filter(id=>JOB_MAP[id].tier!=='special' || playerLevel>=45);
  const job = jobIds[Math.floor(rng()*jobIds.length)];
  const name = OPPONENT_NAMES[Math.floor(rng()*OPPONENT_NAMES.length)];
  const level = Math.max(1, Math.min(130, playerLevel + d.lvOff + Math.floor(rng()*5)-2));
  return makeEnemy({job, level, mult:d.mult, name, diff:diffId});
}

export function makeDungeonFloor(dungeonId, floor){
  const d = DUNGEON_MAP[dungeonId];
  if (dungeonId==='void'){
    const b = BOSS_MAP.nameless_king;
    return makeEnemy({job:b.job, level:b.level, mult:b.mult, name:b.name, skills:b.skills, seed:b.id, isBoss:true, diff:'nightmare'});
  }
  const level = d.baseLv + (floor-1)*d.lvStep;
  const isLast = floor===d.floors;
  const jobIds = Object.keys(JOB_MAP);
  const job = jobIds[Math.floor(Math.random()*jobIds.length)];
  const name = isLast ? d.name+'の主' : OPPONENT_NAMES[Math.floor(Math.random()*OPPONENT_NAMES.length)];
  return makeEnemy({job, level, mult:isLast?1.5:1.05, name, seed:dungeonId+floor, isBoss:isLast, diff:isLast?'hard':'normal'});
}
