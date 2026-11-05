// ============ アイテムデータ ============
// kind: consume(戦闘/メニュー使用) / material / book(技の書) / stone
export const ITEMS = [
  {id:'potion',      name:'回復ポーション',   ico:'🧪', kind:'consume', buy:80,   sell:30,  desc:'HPを35%回復する。', effect:{healPct:35}},
  {id:'hi_potion',   name:'ハイポーション',   ico:'⚗️', kind:'consume', buy:260,  sell:90,  desc:'HPを70%回復する。', effect:{healPct:70}},
  {id:'ether',       name:'エーテル',         ico:'💧', kind:'consume', buy:150,  sell:50,  desc:'MPを40%回復する。', effect:{mpPct:40}},
  {id:'hi_ether',    name:'ハイエーテル',     ico:'🌊', kind:'consume', buy:420,  sell:150, desc:'MPを80%回復する。', effect:{mpPct:80}},
  {id:'elixir',      name:'エリクサー',       ico:'🏺', kind:'consume', buy:1500, sell:500, desc:'HPとMPを全回復し状態異常も治す。', effect:{healPct:100,mpPct:100,cure:true}},
  {id:'energy_drink',name:'元気ドリンク',     ico:'🥤', kind:'consume', buy:200,  sell:60,  desc:'スタミナを25回復する。', effect:{stamina:25}},
  {id:'antidote',    name:'万能薬',           ico:'💊', kind:'consume', buy:120,  sell:40,  desc:'全ての状態異常を治す。', effect:{cure:true}},
  {id:'stone',       name:'強化石',           ico:'🔩', kind:'stone',   buy:180,  sell:60,  desc:'装備強化(+1〜+10)に必要。'},
  {id:'hi_stone',    name:'上級強化石',       ico:'💎', kind:'stone',   buy:600,  sell:200, desc:'装備強化(+11〜+15)に必要。'},
  {id:'awk_shard',   name:'覚醒の欠片',       ico:'🔷', kind:'material',buy:500,  sell:150, desc:'覚醒・壱に必要なたくさんの欠片。'},
  {id:'awk_crystal', name:'覚醒の結晶',       ico:'🔮', kind:'material',buy:1200, sell:400, desc:'覚醒・弐に必要な輝く結晶。'},
  {id:'awk_orb',     name:'覚醒の宝玉',       ico:'🟣', kind:'material',buy:2800, sell:900, desc:'覚醒・参に必要な神秘の宝玉。'},
  {id:'awk_core',    name:'神核',             ico:'🌟', kind:'material',buy:6000, sell:2000,desc:'覚醒・肆に必要な神々の核。'},
  {id:'awk_genesis', name:'創世の輝き',       ico:'💫', kind:'material',buy:12000,sell:4000,desc:'覚醒・極に必要な原初の光。'},
  {id:'rebirth_proof',name:'転生の証',        ico:'♾️', kind:'material',buy:0,    sell:5000,desc:'転生した者にのみ与えられる証。'},
  {id:'book_meteor', name:'技の書・隕石招来', ico:'📕', kind:'book', buy:2500, sell:800, desc:'読むと「隕石招来」を習得する。', skill:'book_meteor'},
  {id:'book_absolute_zero',name:'技の書・絶対零度',ico:'📕',kind:'book',buy:2500,sell:800,desc:'読むと「絶対零度」を習得する。',skill:'book_absolute_zero'},
  {id:'book_thunder_god',name:'技の書・雷神の怒り',ico:'📕',kind:'book',buy:2800,sell:900,desc:'読むと「雷神の怒り」を習得する。',skill:'book_thunder_god'},
  {id:'book_dark_eclipse',name:'技の書・暗黒蝕',ico:'📕',kind:'book',buy:2800,sell:900,desc:'読むと「暗黒蝕」を習得する。',skill:'book_dark_eclipse'},
  {id:'book_life_steal',name:'技の書・生命吸収',ico:'📕',kind:'book',buy:3000,sell:1000,desc:'読むと「生命吸収」を習得する。',skill:'book_life_steal'},
  {id:'book_full_cure',name:'技の書・完全治癒',ico:'📗',kind:'book',buy:3200,sell:1100,desc:'読むと「完全治癒」を習得する。',skill:'book_full_cure'},
  {id:'book_dragon_wave',name:'技の書・竜波動',ico:'📕',kind:'book',buy:3000,sell:1000,desc:'読むと「竜波動」を習得する。',skill:'book_dragon_wave'},
  {id:'book_phantom_nine',name:'技の書・九連幻影',ico:'📓',kind:'book',buy:4000,sell:1400,desc:'読むと「九連幻影」を習得する。',skill:'book_phantom_nine'},
];
export const ITEM_MAP = Object.fromEntries(ITEMS.map(i=>[i.id,i]));

// 覚醒段階定義
export const AWAKEN_STAGES = [
  {stage:1, name:'覚醒・壱', level:30,  jl:5,  bosses:1,  mats:{awk_shard:3},   bonus:0.10, color:'#59c2f0', skill:'awk_soul_burst'},
  {stage:2, name:'覚醒・弐', level:50,  jl:10, bosses:3,  mats:{awk_crystal:3}, bonus:0.20, color:'#7ed491', skill:'awk_starlight'},
  {stage:3, name:'覚醒・参', level:70,  jl:15, bosses:5,  mats:{awk_orb:2},     bonus:0.35, color:'#b48cf2', skill:'awk_chaos_edge'},
  {stage:4, name:'覚醒・肆', level:90,  jl:20, bosses:8,  mats:{awk_core:1},    bonus:0.50, color:'#f2c94c', skill:'awk_genesis'},
  {stage:5, name:'覚醒・極', level:100, jl:25, bosses:12, mats:{awk_genesis:1}, bonus:0.70, color:'#ff5fa2', skill:'awk_final_evolution'},
];
export const MAX_LEVEL = 100;
export const MAX_JOB_LEVEL = 30;
export function xpNeed(lv){ return Math.round(40*Math.pow(lv,1.6) + 60*lv); }
export function jobXpNeed(jl){ return Math.round(30*Math.pow(jl,1.5) + 40*jl); }
