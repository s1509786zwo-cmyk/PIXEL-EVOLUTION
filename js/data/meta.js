// ============ ランク・実績・称号・クエスト・交換所 ============
export const RANKS = [
  {id:'beginner', name:'ビギナー',   rp:0,     ico:'🌱', reward:{coins:0}},
  {id:'bronze',   name:'ブロンズ',   rp:200,   ico:'🥉', reward:{coins:500, points:30}},
  {id:'silver',   name:'シルバー',   rp:500,   ico:'🥈', reward:{coins:1200, points:60}},
  {id:'gold',     name:'ゴールド',   rp:1000,  ico:'🥇', reward:{coins:2500, points:120, mats:{awk_crystal:1}}},
  {id:'platinum', name:'プラチナ',   rp:1800,  ico:'🏅', reward:{coins:5000, points:200, mats:{awk_orb:1}}},
  {id:'diamond',  name:'ダイヤモンド',rp:3000, ico:'💠', reward:{coins:9000, points:350, mats:{awk_core:1}}},
  {id:'master',   name:'マスター',   rp:5000,  ico:'👑', reward:{coins:15000, points:600, mats:{awk_genesis:1}}},
  {id:'legend',   name:'レジェンド', rp:8000,  ico:'🌟', reward:{coins:25000, points:1000, mats:{awk_genesis:1}}},
  {id:'divine',   name:'神域',       rp:12000, ico:'⚜️', reward:{coins:50000, points:2000, mats:{awk_genesis:2}}},
];
export function rankOf(rp){ let r=RANKS[0]; for(const x of RANKS) if(rp>=x.rp) r=x; return r; }
export function nextRank(rp){ return RANKS.find(x=>x.rp>rp)||null; }

// ---- 称号 ----
export const TITLES = [
  {id:'novice',   name:'新米ファイター', desc:'駆け出しの証', bonus:{}, from:'初期称号'},
  {id:'winner',   name:'勝利を掴む者',   desc:'攻撃+3%',    bonus:{atk:.03}, from:'初勝利'},
  {id:'veteran',  name:'百戦錬磨',       desc:'全能力+3%',  bonus:{all:.03}, from:'100勝'},
  {id:'streaker', name:'連勝街道',       desc:'速度+5%',    bonus:{spd:.05}, from:'5連勝'},
  {id:'unstoppable',name:'無双の覇者',   desc:'攻撃+6% 会心+5%', bonus:{atk:.06,crit:5}, from:'10連勝'},
  {id:'awakened', name:'覚醒者',         desc:'全能力+4%',  bonus:{all:.04}, from:'覚醒・壱'},
  {id:'transcendent',name:'超越者',      desc:'全能力+7%',  bonus:{all:.07}, from:'覚醒・極'},
  {id:'collector',name:'蒐集家',         desc:'コイン獲得+15%', bonus:{coin:.15}, from:'装備図鑑25種'},
  {id:'scholar',  name:'技の探求者',     desc:'経験値+15%', bonus:{xp:.15}, from:'技50種習得'},
  {id:'dragonslayer',name:'竜殺し',      desc:'攻撃+8%',    bonus:{atk:.08}, from:'竜帝撃破'},
  {id:'demonbane',name:'魔王討伐者',     desc:'全能力+6%',  bonus:{all:.06}, from:'魔王撃破'},
  {id:'reborn',   name:'輪廻する者',     desc:'全能力+5% 経験+10%', bonus:{all:.05,xp:.10}, from:'転生'},
  {id:'champion', name:'闘技場の覇者',   desc:'対戦ポイント+20%', bonus:{point:.20}, from:'交換所(500pt)'},
  {id:'abysswalker',name:'深淵を歩む者', desc:'全能力+8%',  bonus:{all:.08}, from:'深淵の塔制覇'},
  {id:'voidking', name:'虚無の王',       desc:'全能力+12%', bonus:{all:.12}, from:'無名の王撃破'},
  {id:'godhand',  name:'神に選ばれし者', desc:'全能力+10%', bonus:{all:.10}, from:'ランク神域'},
];
export const TITLE_MAP = Object.fromEntries(TITLES.map(t=>[t.id,t]));

// ---- 実績 ----
const maxLv = S => Math.max(0,...S.characters.map(c=>c.level));
const maxAw = S => Math.max(0,...S.characters.map(c=>c.awaken));
const skillCount = S => Object.keys(S.codex.skills).length;
const equipCount = S => Object.keys(S.codex.equip).length;
export const ACHIEVEMENTS = [
  {id:'first_win', name:'初陣の勝利', desc:'CPU対戦で1勝する', check:S=>S.counters.wins>=1, reward:{coins:300}, title:'winner'},
  {id:'wins_10', name:'歴戦の証', desc:'10勝する', check:S=>S.counters.wins>=10, reward:{coins:800, points:30}},
  {id:'wins_50', name:'戦場の主', desc:'50勝する', check:S=>S.counters.wins>=50, reward:{coins:3000, points:100}},
  {id:'wins_100', name:'百戦錬磨', desc:'100勝する', check:S=>S.counters.wins>=100, reward:{coins:8000, points:250}, title:'veteran'},
  {id:'wins_300', name:'戦神', desc:'300勝する', check:S=>S.counters.wins>=300, reward:{coins:25000, points:800}},
  {id:'streak_3', name:'三連星', desc:'3連勝する', check:S=>S.counters.bestStreak>=3, reward:{coins:500}},
  {id:'streak_5', name:'連勝街道', desc:'5連勝する', check:S=>S.counters.bestStreak>=5, reward:{coins:1500, points:50}, title:'streaker'},
  {id:'streak_10', name:'無双の覇者', desc:'10連勝する', check:S=>S.counters.bestStreak>=10, reward:{coins:6000, points:200}, title:'unstoppable'},
  {id:'lv_10', name:'成長の芽', desc:'Lv10に到達', check:S=>maxLv(S)>=10, reward:{coins:400}},
  {id:'lv_30', name:'一人前', desc:'Lv30に到達', reward:{coins:1500, mats:{awk_shard:1}}, check:S=>maxLv(S)>=30},
  {id:'lv_50', name:'中堅の実力', desc:'Lv50に到達', check:S=>maxLv(S)>=50, reward:{coins:4000, mats:{awk_crystal:1}}},
  {id:'lv_70', name:'達人の域', desc:'Lv70に到達', check:S=>maxLv(S)>=70, reward:{coins:9000, mats:{awk_orb:1}}},
  {id:'lv_100', name:'限界突破', desc:'Lv100に到達', check:S=>maxLv(S)>=100, reward:{coins:20000, mats:{awk_core:1}}},
  {id:'awaken_1', name:'魂の目覚め', desc:'覚醒・壱に到達', check:S=>maxAw(S)>=1, reward:{coins:2000, points:80}, title:'awakened'},
  {id:'awaken_3', name:'魂の昇華', desc:'覚醒・参に到達', check:S=>maxAw(S)>=3, reward:{coins:10000, points:300}},
  {id:'awaken_5', name:'超越者', desc:'覚醒・極に到達', check:S=>maxAw(S)>=5, reward:{coins:30000, points:1000}, title:'transcendent'},
  {id:'skills_10', name:'技の入門', desc:'技を10種習得', check:S=>skillCount(S)>=10, reward:{coins:500}},
  {id:'skills_30', name:'技の使い手', desc:'技を30種習得', check:S=>skillCount(S)>=30, reward:{coins:2000}},
  {id:'skills_50', name:'技の探求者', desc:'技を50種習得', check:S=>skillCount(S)>=50, reward:{coins:5000, points:100}, title:'scholar'},
  {id:'skills_100', name:'技の大師', desc:'技を100種習得', check:S=>skillCount(S)>=100, reward:{coins:15000, points:400}},
  {id:'skills_150', name:'万象の技', desc:'技を150種習得', check:S=>skillCount(S)>=150, reward:{coins:30000, points:800}},
  {id:'equip_10', name:'装備コレクター', desc:'装備図鑑10種', check:S=>equipCount(S)>=10, reward:{coins:800}},
  {id:'equip_25', name:'蒐集家', desc:'装備図鑑25種', check:S=>equipCount(S)>=25, reward:{coins:3000, points:80}, title:'collector'},
  {id:'equip_50', name:'宝物庫', desc:'装備図鑑50種', check:S=>equipCount(S)>=50, reward:{coins:12000, points:300}},
  {id:'gacha_10', name:'ガチャデビュー', desc:'ガチャを10回引く', check:S=>S.counters.gacha>=10, reward:{coins:500}},
  {id:'gacha_50', name:'ガチャの達人', desc:'ガチャを50回引く', check:S=>S.counters.gacha>=50, reward:{coins:2500, mats:{stone:5}}},
  {id:'gacha_100', name:'ガチャ王', desc:'ガチャを100回引く', check:S=>S.counters.gacha>=100, reward:{coins:8000, mats:{hi_stone:3}}},
  {id:'mythic_1', name:'神話の入手', desc:'ミシック装備を入手', check:S=>S.counters.mythic>=1, reward:{coins:3000, points:100}},
  {id:'secret_1', name:'秘密の発見', desc:'シークレット装備を入手', check:S=>S.counters.secret>=1, reward:{coins:10000, points:400}},
  {id:'boss_1', name:'強敵撃破', desc:'ボスを1体倒す', check:S=>S.counters.bossKills>=1, reward:{coins:1000, points:50}},
  {id:'boss_5', name:'ボスハンター', desc:'ボスを5体倒す', check:S=>S.counters.bossKills>=5, reward:{coins:5000, points:200}},
  {id:'dragon_kill', name:'竜殺し', desc:'竜帝バハムートを倒す', check:S=>!!S.bosses.dragon_emperor, reward:{coins:8000, points:300}, title:'dragonslayer'},
  {id:'demon_kill', name:'魔王討伐者', desc:'魔王ゼノグレイアを倒す', check:S=>!!S.bosses.demon_lord, reward:{coins:15000, points:500}, title:'demonbane'},
  {id:'void_kill', name:'虚無の王', desc:'無名の王を倒す', check:S=>!!S.bosses.nameless_king, reward:{coins:40000, points:1500}, title:'voidking'},
  {id:'dung_cave', name:'洞窟踏破', desc:'試練の洞窟を制覇', check:S=>!!S.dungeons.cave?.cleared, reward:{coins:600, points:30}},
  {id:'dung_ruins', name:'遺跡踏破', desc:'古代遺跡を制覇', check:S=>!!S.dungeons.ruins?.cleared, reward:{coins:2000, points:80}},
  {id:'dung_castle', name:'城踏破', desc:'魔王城を制覇', check:S=>!!S.dungeons.castle?.cleared, reward:{coins:6000, points:200}},
  {id:'dung_abyss', name:'深淵を歩む者', desc:'深淵の塔を制覇', check:S=>!!S.dungeons.abyss?.cleared, reward:{coins:20000, points:700}, title:'abysswalker'},
  {id:'rebirth_1', name:'輪廻の始まり', desc:'転生を1回行う', check:S=>S.counters.rebirth>=1, reward:{coins:5000, points:200}, title:'reborn'},
  {id:'rebirth_3', name:'永劫回帰', desc:'転生を3回行う', check:S=>S.counters.rebirth>=3, reward:{coins:20000, points:800}},
  {id:'train_10', name:'修行の成果', desc:'トレーニング10回', check:S=>S.counters.trains>=10, reward:{coins:600}},
  {id:'train_50', name:'修行の鬼', desc:'トレーニング50回', check:S=>S.counters.trains>=50, reward:{coins:3000, mats:{stone:3}}},
  {id:'enhance_10', name:'鍛冶の極み', desc:'装備を+10まで強化', check:S=>S.counters.maxEnhance>=10, reward:{coins:2000, mats:{hi_stone:1}}},
  {id:'enhance_15', name:'神鍛冶', desc:'装備を+15まで強化', check:S=>S.counters.maxEnhance>=15, reward:{coins:10000, mats:{hi_stone:3}}},
  {id:'fuse_1', name:'錬成の秘術', desc:'装備合成を1回行う', check:S=>S.counters.fuses>=1, reward:{coins:1000}},
  {id:'rank_gold', name:'ゴールドランク', desc:'ゴールドランク到達', check:S=>S.rp>=1000, reward:{coins:2000, points:80}},
  {id:'rank_master', name:'マスターランク', desc:'マスターランク到達', check:S=>S.rp>=5000, reward:{coins:12000, points:400}},
  {id:'rank_divine', name:'神に選ばれし者', desc:'神域ランク到達', check:S=>S.rp>=12000, reward:{coins:40000, points:1500}, title:'godhand'},
];
export const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,a]));

// ---- デイリークエスト ----
export const DAILY_QUESTS = [
  {id:'dq_win3', name:'対戦で3勝する', counter:'wins', need:3, reward:{coins:400, points:20}},
  {id:'dq_train2', name:'トレーニングを2回行う', counter:'trains', need:2, reward:{coins:300}},
  {id:'dq_gacha1', name:'ガチャを1回引く', counter:'gacha', need:1, reward:{coins:250}},
  {id:'dq_skill5', name:'戦闘で技を5回使う', counter:'skillUses', need:5, reward:{coins:350, points:10}},
  {id:'dq_floor1', name:'ダンジョンを1階層攻略', counter:'floors', need:1, reward:{coins:500, points:25}},
  {id:'dq_battle5', name:'対戦を5回行う', counter:'battles', need:5, reward:{coins:300, points:15}},
];

// ---- 対戦ポイント交換所 ----
export const POINT_SHOP = [
  {id:'ps_sword_god', kind:'skill', skill:'pt_gladiator', cost:250},
  {id:'ps_saint', kind:'skill', skill:'pt_saint_wall', cost:300},
  {id:'ps_mana', kind:'skill', skill:'pt_mana_flood', cost:350},
  {id:'ps_war', kind:'skill', skill:'pt_war_dance', cost:400},
  {id:'ps_soul', kind:'skill', skill:'pt_soul_drain', cost:450},
  {id:'ps_spear', kind:'skill', skill:'pt_judgment_spear', cost:500},
  {id:'ps_arma', kind:'skill', skill:'pt_armageddon', cost:700},
  {id:'ps_phoenix', kind:'skill', skill:'pt_immortal', cost:800},
  {id:'ps_orb', kind:'item', item:'awk_orb', cost:300},
  {id:'ps_core', kind:'item', item:'awk_core', cost:800},
  {id:'ps_genesis', kind:'item', item:'awk_genesis', cost:1500},
  {id:'ps_histone', kind:'item', item:'hi_stone', cost:100},
  {id:'ps_book9', kind:'item', item:'book_phantom_nine', cost:350},
  {id:'ps_title', kind:'title', title:'champion', cost:500},
  {id:'sp_hero_sword', kind:'equip', cost:2500},
  {id:'sp_god_armor', kind:'equip', cost:3000},
  {id:'sp_dragon_eye', kind:'equip', cost:2200},
  {id:'sp_genesis', kind:'equip', cost:2800},
];

// ---- 図鑑コレクション報酬 ----
export const CODEX_MILESTONES = [
  {id:'cx_sk25', kind:'skills', need:25, reward:{coins:1000}},
  {id:'cx_sk60', kind:'skills', need:60, reward:{coins:4000, points:100}},
  {id:'cx_sk120', kind:'skills', need:120, reward:{coins:12000, points:400}},
  {id:'cx_sk215', kind:'skills', need:215, reward:{coins:50000, points:2000, title:'scholar'}},
  {id:'cx_eq10', kind:'equip', need:10, reward:{coins:800}},
  {id:'cx_eq30', kind:'equip', need:30, reward:{coins:3500, points:100}},
  {id:'cx_eq60', kind:'equip', need:60, reward:{coins:15000, points:500}},
  {id:'cx_job6', kind:'jobs', need:6, reward:{coins:1000}},
  {id:'cx_job12', kind:'jobs', need:12, reward:{coins:4000, points:120}},
  {id:'cx_job22', kind:'jobs', need:22, reward:{coins:15000, points:500}},
  {id:'cx_en10', kind:'enemies', need:10, reward:{coins:1000}},
  {id:'cx_en25', kind:'enemies', need:25, reward:{coins:5000, points:150}},
];
