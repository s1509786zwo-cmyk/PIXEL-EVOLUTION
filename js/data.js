import { MATERIAL_ITEMS } from './materials.js?v=2';
import { ENEMY_KINDS } from './enemyAssets.js?v=2';

/* ===========================================================
   オリキャラファイターズ / ゲームデータ定義
   - 職業・技・装備・アイテム・CPU・クエスト・実績
   - すべてプログラムで実体を持つデータ（ダミーなし）
   =========================================================== */

export const VERSION = 8;
export const MAX_LEVEL_BASE = 60;
export const AWAKENING_NAMES = ['未覚醒', '覚醒I・萌芽', '覚醒II・進化', '覚醒III・超越', '覚醒IV・神化', '覚醒V・極致'];

export const RARITIES = [
  { id: 'N', name: 'ノーマル', color: '#a9b4c4', rate: 44.5, mult: 1.00, glow: 'none' },
  { id: 'R', name: 'レア', color: '#59b6ff', rate: 30.0, mult: 1.35, glow: 'soft' },
  { id: 'E', name: 'エピック', color: '#b98bff', rate: 16.0, mult: 1.80, glow: 'soft' },
  { id: 'L', name: 'レジェンダリー', color: '#ffc75a', rate: 7.0, mult: 2.45, glow: 'strong' },
  { id: 'M', name: 'ミシック', color: '#ff6fae', rate: 2.0, mult: 3.30, glow: 'strong' },
  { id: 'S', name: 'シークレット', color: '#68f7d4', rate: 0.5, mult: 4.60, glow: 'prism' },
];
export const RARITY = Object.fromEntries(RARITIES.map(r => [r.id, r]));
export const RARITY_ORDER = RARITIES.map(r => r.id);

/* 武器ガチャ排出確率の合計（常に100%） */
export const RATE_TOTAL = Math.round(RARITIES.reduce((a, r) => a + r.rate, 0) * 10) / 10;

/* -----------------------------------------------------------
   キャラクターのレアリティ（= 進化段階）
   ※ 武器ガチャのレアリティ RARITIES とは完全に別データ。
   ※ レベルとは別管理で、レベルアップだけでは上がらない。
   ----------------------------------------------------------- */
export const CHAR_RARITIES = [
  { id:'R',   name:'R',   color:'#aebfd4', glow:'#dbe8ff', mult:1.00, css:'rank-R',
    label:'控えめな枠と小さな光の粒子', decor:'素朴な光の輪',
    fx:{ tier:0, main:'#aebfd4', glow:'#dbe8ff', sub:'#8b9ab0', soft:'rgba(174,191,212,.10)', theme:'plain' } },
  { id:'SR',  name:'SR',  color:'#78c8ff', glow:'#c8efff', mult:1.18, css:'rank-SR',
    label:'銀色の枠とゆっくり流れる光', decor:'銀の装飾リングと光の流れ',
    fx:{ tier:1, main:'#d8eefa', glow:'#f0faff', sub:'#78c8ff', soft:'rgba(190,230,255,.16)', theme:'silver' } },
  { id:'SSR', name:'SSR', color:'#ffd77a', glow:'#fff2b8', mult:1.42, css:'rank-SSR',
    label:'金色の枠と強く輝くオーラ', decor:'金の紋章と強いオーラ',
    fx:{ tier:2, main:'#ffd77a', glow:'#fff2b8', sub:'#b98bff', soft:'rgba(255,205,100,.20)', theme:'gold' } },
  { id:'UR',  name:'UR',  color:'#d2a0ff', glow:'#f2d4ff', mult:1.72, css:'rank-UR',
    label:'紫と青の豪華な枠、巡る稲妻とエネルギー', decor:'紫青の紋章と稲妻',
    fx:{ tier:3, main:'#c997ff', glow:'#e2b6ff', sub:'#65d9ff', soft:'rgba(160,110,255,.22)', theme:'arcane' } },
  { id:'LR',  name:'LR',  color:'#f7f0c8', glow:'#ffffff', mult:2.10, css:'rank-LR',
    label:'紅蓮の専用枠、枠の外周を燃え上がる炎', decor:'紅蓮の炎枠と立ち昇る火花',
    fx:{ tier:4, main:'#ff4b36', glow:'#ffb347', sub:'#ff8fa8', soft:'rgba(255,70,40,.24)', theme:'flame' } },
];
export const CHAR_RARITY = Object.fromEntries(CHAR_RARITIES.map(r => [r.id, r]));
export const CHAR_RARITY_ORDER = CHAR_RARITIES.map(r => r.id);
export const charRankIndex = r => Math.max(0, CHAR_RARITY_ORDER.indexOf(r || 'R'));

/* 進化ルール：必要レベルはゲームバランスに合わせて調整（20/35/50/65） */
export const EVOLUTION_RULES = [
  { from:'R',   to:'SR',  level:20, coins:2500,  skill:'sk_light_impact', gain:'全ステータス +22% + 会心/奥義強化', rate:0.22 },
  { from:'SR',  to:'SSR', level:35, coins:9000,  skill:'sk_star_nova',    gain:'全ステータス +34% + 会心/奥義強化', rate:0.34 },
  { from:'SSR', to:'UR',  level:50, coins:26000, skill:'sk_awaken1',      gain:'全ステータス +48% + 会心/奥義強化', rate:0.48 },
  { from:'UR',  to:'LR',  level:65, coins:64000, skill:'sk_secret',       gain:'全ステータス +65% + 会心/奥義強化', rate:0.65 },
];
export const EVOLUTION_BY_FROM = Object.fromEntries(EVOLUTION_RULES.map(r => [r.from, r]));


/* -----------------------------------------------------------
   基本ステータスは HP / 攻撃力 / 防御力 / MP の 4 種類のみ。
   速度・命中・回避・会心・魔力・魔法防御は「基本ステータス」から廃止し、
   技・装備の特殊効果（effects）として内部で扱う。
   ----------------------------------------------------------- */
export const STAT_KEYS = ['hp', 'atk', 'def', 'mp'];
export const STAT_NAMES = { hp: 'HP', atk: '攻撃力', def: '防御力', mp: 'MP' };
export const STAT_ICONS = { hp: '❤', atk: '⚔', def: '🛡', mp: '✦' };
/** 旧セーブ・既存データの互換：削除したステータスを 4 種へ換算して合算する */
export const LEGACY_STAT_KEYS = ['spd', 'mag', 'acc', 'eva', 'mdef'];
export const LEGACY_TO_CORE = { mag:'atk', spd:'def', acc:'atk', eva:'def', mdef:'def' };
export const BUFF_TO_CORE = { mag:'atk', spd:'def', acc:'hit', eva:'dodge', mdef:'def' };
export function coreStatKey(k) { return BUFF_TO_CORE[k] || k; }
export function toCoreStats(raw0 = {}) {
  const raw = raw0 || {};
  const n = k => Number(raw[k]) || 0;
  return {
    hp:  n('hp'),
    atk: n('atk') + n('mag') * 0.85 + n('acc') * 0.15,
    def: n('def') + n('eva') * 0.6 + n('spd') * 0.35 + n('mdef') * 0.5,
    mp:  n('mp') + n('mag') * 0.35,
  };
}

export const ELEMENTS = {
  fire:   { name: '火', color: '#ff7a45', beats: 'ice' },
  water:  { name: '水', color: '#4fb8ff', beats: 'fire' },
  wind:   { name: '風', color: '#8ce6a8', beats: 'earth' },
  earth:  { name: '土', color: '#d8a866', beats: 'thunder' },
  thunder:{ name: '雷', color: '#ffe066', beats: 'water' },
  ice:    { name: '氷', color: '#a5e7ff', beats: 'wind' },
  light:  { name: '光', color: '#fff3b0', beats: 'dark' },
  dark:   { name: '闇', color: '#c58cff', beats: 'light' },
  star:   { name: '星', color: '#8ef0e3', beats: 'dark' },
  none:   { name: '無', color: '#c9d3e0', beats: null },
};
export const ELEMENT_IDS = Object.keys(ELEMENTS);

export const STYLES = [
  { id: 'balanced', name: 'バランス', desc: '攻守のバランスに優れ、どんな相手にも対応できる', bonus: { atk: 5, def: 4, hp: 6, mp: 4 } },
  { id: 'power', name: 'パワー', desc: '一撃の威力を重視する豪快な戦い方', bonus: { atk: 10, hp: 20, def: 4 } },
  { id: 'speed', name: 'スピード', desc: '手数と防御で押し切る俊敏な戦い方', bonus: { def: 8, atk: 4 } },
  { id: 'magic', name: 'マジック', desc: 'MPを活かした技中心の戦い方', bonus: { atk: 9, mp: 18 } },
  { id: 'guard', name: 'ガード', desc: '耐久と反撃で相手を削り倒す戦い方', bonus: { def: 10, hp: 35 } },
  { id: 'critical', name: 'クリティカル', desc: '会心と状態異常で一発逆転を狙う戦い方', bonus: { atk: 8, def: 3 } },
];

/* -----------------------------------------------------------
   技データ：120種類以上。parts = 実際に戦闘で解決される効果
   ----------------------------------------------------------- */
const ELEM_PREFIX = {
  fire: 'フレイム', water: 'アクア', wind: 'ゲイル', earth: 'ガイア', thunder: 'サンダー',
  ice: 'フロスト', light: 'ホーリー', dark: 'ダーク', star: 'アストラル', none: 'フォース',
};
const SUFFIXES = [
  { key: 'slash',   label: 'スラッシュ',   fx: 'slash',     power: 72,  mp: 3,  cd: 0, scale: 'atk', cat: '斬撃' },
  { key: 'shot',    label: 'ショット',     fx: 'pierce',    power: 80,  mp: 4,  cd: 0, scale: 'atk', cat: '遠距離' },
  { key: 'wave',    label: 'ウェイブ',     fx: 'wave',      power: 92,  mp: 7,  cd: 1, scale: 'mag', cat: '範囲攻撃' },
  { key: 'impact',  label: 'インパクト',   fx: 'impact',    power: 108, mp: 9,  cd: 1, scale: 'atk', cat: '打撃' },
  { key: 'burst',   label: 'バースト',     fx: 'burst',     power: 126, mp: 14, cd: 2, scale: 'mag', cat: '魔法' },
  { key: 'nova',    label: 'ノヴァ',       fx: 'nova',      power: 152, mp: 20, cd: 3, scale: 'mag', cat: '必殺技' },
  { key: 'judge',   label: 'ジャッジメント', fx: 'holy',     power: 178, mp: 26, cd: 4, scale: 'atk', cat: '必殺技' },
  { key: 'eternal', label: 'エターナル',   fx: 'prism',     power: 215, mp: 34, cd: 5, scale: 'mag', cat: '覚醒技' },
];
const SPECIAL_SKILLS = [
  { id:'sk_double', name:'二連斬り', element:'none', cat:'連続攻撃', mp:6, cd:1, fx:'slash', power:62, parts:[{op:'damage',power:62,scale:'atk',hits:2}], desc:'2回連続で斬りつける。' },
  { id:'sk_triple', name:'三連突き', element:'none', cat:'連続攻撃', mp:10, cd:2, fx:'pierce', power:50, parts:[{op:'damage',power:50,scale:'atk',hits:3}], desc:'3回の連続突きで削る。' },
  { id:'sk_quint', name:'五連星撃', element:'star', cat:'連続攻撃', mp:18, cd:3, fx:'prism', power:44, parts:[{op:'damage',power:44,scale:'atk',hits:5}], desc:'星の軌跡が5度舞う。' },
  { id:'sk_sweep', name:'薙ぎ払い', element:'none', cat:'範囲攻撃', mp:8, cd:1, fx:'wave', power:105, parts:[{op:'damage',power:105,scale:'atk',hits:1},{op:'debuff',stat:'def',amount:12,dur:2}], desc:'薙ぎ払いで相手の防御を下げる。' },
  { id:'sk_arrowrain', name:'アローレイン', element:'wind', cat:'遠距離攻撃', mp:14, cd:2, fx:'pierce', power:58, parts:[{op:'damage',power:58,scale:'atk',hits:3}], desc:'矢の雨を降らせる。' },
  { id:'sk_snipe', name:'必中・貫通射', element:'none', cat:'遠距離攻撃', mp:12, cd:2, fx:'pierce', power:135, acc:255, parts:[{op:'damage',power:135,scale:'atk',hits:1,trueHit:true}], desc:'回避を無視して必ず命中する。' },
  { id:'sk_meteo', name:'メテオストライク', element:'fire', cat:'範囲攻撃', mp:28, cd:4, fx:'nova', power:190, parts:[{op:'damage',power:190,scale:'mag',hits:1},{op:'status',status:'burn',chance:60,dur:3}], desc:'隕石で焼き尽くす。' },
  { id:'sk_blizzard', name:'絶対零度', element:'ice', cat:'魔法', mp:24, cd:4, fx:'burst', power:165, parts:[{op:'damage',power:165,scale:'mag',hits:1},{op:'status',status:'freeze',chance:45,dur:1}], desc:'凍結を狙う氷魔法。' },
  { id:'sk_thunderlord', name:'雷帝の裁き', element:'thunder', cat:'魔法', mp:26, cd:4, fx:'holy', power:175, parts:[{op:'damage',power:175,scale:'mag',hits:1},{op:'status',status:'paralysis',chance:40,dur:1}], desc:'麻痺を伴う雷撃。' },
  { id:'sk_quake', name:'大地割れ', element:'earth', cat:'範囲攻撃', mp:16, cd:2, fx:'impact', power:130, parts:[{op:'damage',power:130,scale:'atk',hits:1},{op:'debuff',stat:'spd',amount:18,dur:2}], desc:'地割れで足止めする。' },
  { id:'sk_heal', name:'ヒール', element:'light', cat:'回復', mp:8, cd:1, fx:'heal', power:0, parts:[{op:'heal',power:95,scale:'mag'}], desc:'HPを回復する。' },
  { id:'sk_greaterheal', name:'グレーターヒール', element:'light', cat:'回復', mp:18, cd:3, fx:'heal', power:0, parts:[{op:'heal',power:190,scale:'mag'},{op:'cleanse'}], desc:'大きく回復し状態異常を解除。' },
  { id:'sk_regen', name:'リジェネレーション', element:'light', cat:'回復', mp:14, cd:3, fx:'heal', power:0, parts:[{op:'status',status:'regen',chance:100,dur:4,target:'self'}], desc:'毎ターンHPが回復する。' },
  { id:'sk_mpcharge', name:'魔力吸収', element:'dark', cat:'補助', mp:0, cd:2, fx:'dark', power:0, parts:[{op:'restoreMp',amount:22},{op:'damage',power:40,scale:'mag',hits:1}], desc:'MPを回復しつつ攻撃。' },
  { id:'sk_drain', name:'ドレイン', element:'dark', cat:'魔法', mp:12, cd:2, fx:'dark', power:0, parts:[{op:'damage',power:110,scale:'mag',hits:1,drain:0.5}], desc:'与えたダメージの半分を吸収。' },
  { id:'sk_guardup', name:'アイアンウォール', element:'earth', cat:'防御', mp:9, cd:2, fx:'buff', power:0, parts:[{op:'buff',stat:'def',amount:45,dur:3,target:'self'},{op:'shield',amount:70}], desc:'防御を上げてバリアを張る。' },
  { id:'sk_powerup', name:'バーサーク', element:'fire', cat:'補助', mp:10, cd:2, fx:'buff', power:0, parts:[{op:'buff',stat:'atk',amount:40,dur:3,target:'self'}], desc:'攻撃力を大きく上げる。' },
  { id:'sk_mindup', name:'魔導書展開', element:'star', cat:'補助', mp:10, cd:2, fx:'buff', power:0, parts:[{op:'buff',stat:'mag',amount:40,dur:3,target:'self'},{op:'restoreMp',amount:10}], desc:'攻撃力を高めMPを補充。' },
  { id:'sk_haste', name:'ヘイスト', element:'wind', cat:'補助', mp:11, cd:3, fx:'buff', power:0, parts:[{op:'buff',stat:'spd',amount:45,dur:3,target:'self'}], desc:'防御力を上げて被打撃に備える。' },
  { id:'sk_focus', name:'集中', element:'none', cat:'補助', mp:6, cd:2, fx:'buff', power:0, parts:[{op:'buff',stat:'acc',amount:40,dur:3,target:'self'},{op:'buff',stat:'eva',amount:20,dur:3,target:'self'}], desc:'命中と回避を高める。' },
  { id:'sk_counter', name:'カウンタースタンス', element:'none', cat:'カウンター', mp:10, cd:3, fx:'buff', power:0, parts:[{op:'counter',amount:1.1,dur:2}], desc:'受けた攻撃を1.1倍で跳ね返す。' },
  { id:'sk_poison', name:'ポイズンダート', element:'dark', cat:'状態異常', mp:7, cd:1, fx:'dark', power:0, parts:[{op:'damage',power:60,scale:'atk',hits:1},{op:'status',status:'poison',chance:80,dur:4}], desc:'毒を仕込んだ一撃。' },
  { id:'sk_curse', name:'呪縛の言葉', element:'dark', cat:'状態異常', mp:13, cd:3, fx:'dark', power:0, parts:[{op:'status',status:'curse',chance:75,dur:3},{op:'debuff',stat:'mag',amount:25,dur:3}], desc:'攻撃力を奪う呪いをかける。' },
  { id:'sk_sleep', name:'スリープソング', element:'water', cat:'状態異常', mp:10, cd:3, fx:'wave', power:0, parts:[{op:'status',status:'sleep',chance:55,dur:2}], desc:'相手を眠らせる。' },
  { id:'sk_confuse', name:'幻惑の霧', element:'wind', cat:'状態異常', mp:11, cd:3, fx:'wave', power:0, parts:[{op:'status',status:'confuse',chance:55,dur:2}], desc:'混乱させ自傷させる。' },
  { id:'sk_break', name:'アーマーブレイク', element:'none', cat:'補助', mp:9, cd:2, fx:'impact', power:0, parts:[{op:'damage',power:70,scale:'atk',hits:1},{op:'debuff',stat:'def',amount:35,dur:3}], desc:'防御を大きく下げる。' },
  { id:'sk_summon_go', name:'召喚・ゴーレム', element:'earth', cat:'召喚', mp:20, cd:4, fx:'summon', power:0, parts:[{op:'summon',power:130},{op:'shield',amount:90}], desc:'土の巨像を呼び出す。' },
  { id:'sk_summon_ph', name:'召喚・フェニックス', element:'fire', cat:'召喚', mp:24, cd:4, fx:'summon', power:0, parts:[{op:'summon',power:165},{op:'heal',power:70,scale:'mag'}], desc:'不死鳥が敵を焼き味方を癒す。' },
  { id:'sk_summon_dr', name:'召喚・星龍', element:'star', cat:'召喚', mp:32, cd:5, fx:'summon', power:0, parts:[{op:'summon',power:230}], desc:'星龍の息吹が敵を呑み込む。' },
  { id:'sk_ultimate', name:'奥義・千裂斬', element:'none', cat:'必殺技', mp:36, cd:6, fx:'nova', power:0, parts:[{op:'damage',power:78,scale:'atk',hits:5},{op:'debuff',stat:'def',amount:20,dur:2}], desc:'渾身の五連斬奥義。' },
  { id:'sk_ultimate_m', name:'奥義・元素崩壊', element:'star', cat:'必殺技', mp:42, cd:6, fx:'prism', power:0, parts:[{op:'damage',power:270,scale:'mag',hits:1},{op:'status',status:'burn',chance:50,dur:3}], desc:'全属性を収束させた終極魔法。' },
  { id:'sk_awaken1', name:'覚醒技・光翼裂斬', element:'light', cat:'覚醒限定技', mp:30, cd:5, fx:'holy', power:0, parts:[{op:'damage',power:210,scale:'atk',hits:1},{op:'buff',stat:'atk',amount:25,dur:2,target:'self'}], desc:'覚醒者のみが使える光の斬撃。' },
  { id:'sk_awaken2', name:'覚醒技・時空断絶', element:'star', cat:'覚醒限定技', mp:38, cd:6, fx:'prism', power:0, parts:[{op:'damage',power:250,scale:'mag',hits:1},{op:'status',status:'paralysis',chance:60,dur:1}], desc:'時を止めて空間を裂く。' },
  { id:'sk_awaken3', name:'覚醒技・終焉の祈り', element:'dark', cat:'覚醒限定技', mp:46, cd:7, fx:'nova', power:0, parts:[{op:'damage',power:330,scale:'mag',hits:1},{op:'drainSelf',ratio:0.18}], desc:'全てを終わらせる禁断の祈り。' },
  { id:'sk_secret', name:'禁忌・ゼロ・リバース', element:'none', cat:'覚醒限定技', mp:55, cd:8, fx:'prism', power:0, parts:[{op:'damage',power:400,scale:'atk',hits:1},{op:'heal',power:120,scale:'mag'},{op:'cleanse'}], desc:'シークレット級の禁忌奥義。' },
  { id:'sk_boss', name:'滅界の呼吸', element:'dark', cat:'必殺技', mp:40, cd:5, fx:'nova', power:0, parts:[{op:'damage',power:295,scale:'mag',hits:1},{op:'status',status:'curse',chance:50,dur:3}], desc:'隠しボスが放つ滅びの息吹。' },
  { id:'sk_revive', name:'不死鳥の羽', element:'light', cat:'回復', mp:30, cd:8, fx:'heal', power:0, parts:[{op:'heal',power:260,scale:'mag'},{op:'cleanse'},{op:'shield',amount:120}], desc:'瀕死から立ち上がる究極回復。' },
  { id:'sk_mpbreak', name:'魔力枯渇', element:'none', cat:'状態異常', mp:8, cd:2, fx:'dark', power:0, parts:[{op:'damage',power:55,scale:'atk',hits:1},{op:'drainMp',amount:18}], desc:'相手のMPを奪う。' },
  { id:'sk_charge', name:'チャージ', element:'none', cat:'補助', mp:0, cd:2, fx:'buff', power:0, parts:[{op:'restoreMp',amount:26},{op:'buff',stat:'spd',amount:15,dur:2,target:'self'}], desc:'MPを溜めて体を軽くする。' },
  { id:'sk_pierce_armor', name:'貫鉄斬', element:'none', cat:'斬撃', mp:12, cd:2, fx:'pierce', power:0, parts:[{op:'damage',power:140,scale:'atk',hits:1,pierce:0.5}], desc:'防御の半分を無視して斬る。' },
  { id:'sk_whirl', name:'旋風連舞', element:'wind', cat:'連続攻撃', mp:16, cd:3, fx:'wave', power:0, parts:[{op:'damage',power:52,scale:'atk',hits:4},{op:'buff',stat:'spd',amount:20,dur:2,target:'self'}], desc:'風のように4回舞い斬る。' },
  { id:'sk_sacrifice', name:'血契約', element:'dark', cat:'必殺技', mp:0, cd:5, fx:'dark', power:0, parts:[{op:'drainSelf',ratio:0.15},{op:'damage',power:290,scale:'atk',hits:1}], desc:'自らの血と引き換えに大ダメージ。' },
  { id:'sk_mirror', name:'鏡の守り', element:'light', cat:'防御', mp:14, cd:4, fx:'holy', power:0, parts:[{op:'counter',amount:1.5,dur:2},{op:'shield',amount:110}], desc:'受けた攻撃を1.5倍で返す。' },
  { id:'sk_purify', name:'浄化の光', element:'light', cat:'回復', mp:9, cd:2, fx:'heal', power:0, parts:[{op:'cleanse'},{op:'heal',power:70,scale:'mag'}], desc:'状態を浄化しながら癒す。' },
  { id:'sk_silence', name:'沈黙の呪符', element:'dark', cat:'状態異常', mp:12, cd:3, fx:'dark', power:0, parts:[{op:'drainMp',amount:30},{op:'debuff',stat:'mag',amount:30,dur:3}], desc:'相手の攻撃力とMPを封じる。' },
  { id:'sk_eclipse', name:'皆既蝕', element:'dark', cat:'覚醒限定技', mp:44, cd:7, fx:'nova', power:0, parts:[{op:'damage',power:300,scale:'mag',hits:1},{op:'status',status:'sleep',chance:50,dur:1}], desc:'光を飲み込む闇の極技。' },
  { id:'sk_genesis', name:'創世の旋律', element:'star', cat:'覚醒限定技', mp:52, cd:8, fx:'prism', power:0, parts:[{op:'damage',power:360,scale:'mag',hits:1},{op:'heal',power:150,scale:'mag'},{op:'shield',amount:140}], desc:'世界を書き換える創世の技。' },
  { id:'sk_phantom', name:'幻影分身', element:'none', cat:'補助', mp:15, cd:4, fx:'buff', power:0, parts:[{op:'buff',stat:'eva',amount:60,dur:3,target:'self'},{op:'buff',stat:'acc',amount:25,dur:3,target:'self'}], desc:'分身で回避と命中を上げる。' },
  { id:'sk_critical', name:'会心の極意', element:'none', cat:'補助', mp:11, cd:3, fx:'buff', power:0, parts:[{op:'buff',stat:'acc',amount:55,dur:3,target:'self'},{op:'restoreMp',amount:8}], desc:'会心の機会を大きく高める。' },
];

function buildSkills() {
  const list = [];
  for (const [el, prefix] of Object.entries(ELEM_PREFIX)) {
    SUFFIXES.forEach((s, i) => {
      const power = Math.round(s.power * (el === 'star' ? 1.1 : el === 'none' ? 0.92 : 1));
      list.push({
        id: `sk_${el}_${s.key}`,
        name: `${prefix}${s.label}`,
        element: el,
        cat: s.cat,
        mp: s.mp, cd: s.cd, fx: s.fx,
        power,
        tier: i + 1,
        parts: [{ op: 'damage', power, scale: s.scale, hits: 1 }],
        desc: `${ELEMENTS[el].name}属性の${s.cat}。威力${power}。`,
        source: i >= 6 ? 'exchange' : (i >= 4 ? 'book' : 'level'),
      });
    });
  }
  for (const s of SPECIAL_SKILLS) {
    list.push({ ...s, tier: s.cat === '覚醒限定技' ? 8 : 5, source: s.cat === '覚醒限定技' ? 'awakening' : 'book' });
  }
  return list;
}
const BASE_SKILLS = buildSkills();

/* -----------------------------------------------------------
   職業データ：基本職 / 上級職 / 特殊職
   ----------------------------------------------------------- */
const J = (id, name, tier, icon, color, growth, weapons, style, skills, req, desc) => ({
  id, name, tier, icon, color, growth, weapons, style, skills, req, desc,
});
export const JOBS = [
  J('warrior','戦士',1,'⚔','#c9a15a',{hp:16,mp:3,atk:5.2,def:4.6,spd:2.3,mag:1.4,acc:0.8,eva:0.5},['剣','斧','槍','拳'],'power',
    ['sk_none_slash','sk_fire_slash','sk_double','sk_powerup','sk_sweep','sk_guardup'], null,'均衡の取れた前衛。斧や剣で殴り合う。'),
  J('fencer','剣士',1,'🗡','#8fd3ff',{hp:12,mp:5,atk:5.6,def:3.0,spd:4.5,mag:2.0,acc:1.2,eva:1.1},['剣','短剣'],'speed',
    ['sk_none_shot','sk_wind_slash','sk_double','sk_focus','sk_triple','sk_snipe'], null,'軽快な剣裁きと連撃が持ち味。'),
  J('knight','騎士',1,'🛡','#d9c07b',{hp:19,mp:4,atk:4.2,def:6.2,spd:1.8,mag:1.6,acc:0.7,eva:0.4},['剣','槍','斧'],'guard',
    ['sk_earth_impact','sk_guardup','sk_break','sk_counter','sk_light_slash','sk_regen'], null,'堅い鎧で仲間を守る重防御職。'),
  J('mage','魔法使い',1,'✧','#a88bff',{hp:9,mp:12,atk:1.8,def:2.2,spd:2.8,mag:6.4,acc:1.0,eva:0.7},['杖','特殊'],'magic',
    ['sk_fire_burst','sk_water_wave','sk_thunder_burst','sk_mpcharge','sk_ice_wave','sk_fire_nova'], null,'属性魔法で遠くから攻める。'),
  J('priest','僧侶',1,'✚','#ffe9a8',{hp:12,mp:11,atk:2.2,def:3.2,spd:2.4,mag:5.2,acc:0.9,eva:0.8},['杖','槍'],'guard',
    ['sk_heal','sk_light_wave','sk_regen','sk_greaterheal','sk_light_impact','sk_focus'], null,'回復と光魔法で長く戦う。'),
  J('thief','盗賊',1,'🗝','#9ad6a0',{hp:11,mp:6,atk:4.4,def:2.6,spd:6.0,mag:2.2,acc:1.7,eva:1.8},['短剣','弓','銃'],'critical',
    ['sk_poison','sk_dark_shot','sk_mpbreak','sk_double','sk_confuse','sk_triple'], null,'状態異常と素早さで撹乱する。'),
  J('archer','弓使い',1,'🏹','#a7d98a',{hp:11,mp:6,atk:5.0,def:2.6,spd:5.0,mag:2.4,acc:1.9,eva:1.0},['弓','銃'],'speed',
    ['sk_none_shot','sk_wind_shot','sk_arrowrain','sk_snipe','sk_focus','sk_ice_shot'], null,'必中と遠距離攻撃の名手。'),
  J('monk','武闘家',1,'✊','#f0b27a',{hp:15,mp:7,atk:5.8,def:3.6,spd:4.4,mag:2.6,acc:1.2,eva:1.1},['拳','特殊'],'power',
    ['sk_none_impact','sk_earth_impact','sk_double','sk_powerup','sk_charge','sk_quint'], null,'素手で連打し、気を溜める。'),
  J('gunner','銃士',1,'🔫','#c2c9d6',{hp:12,mp:7,atk:5.4,def:3.0,spd:4.6,mag:2.8,acc:2.0,eva:0.8},['銃','弓'],'critical',
    ['sk_thunder_shot','sk_none_shot','sk_snipe','sk_mpbreak','sk_fire_shot','sk_dark_shot'], null,'雷と鉛で精密に撃ち抜く。'),
  J('summoner','召喚士',1,'☾','#c1a0ff',{hp:10,mp:13,atk:2.0,def:2.6,spd:2.6,mag:6.0,acc:0.9,eva:0.8},['杖','特殊','短剣'],'magic',
    ['sk_summon_go','sk_star_wave','sk_mindup','sk_summon_ph','sk_water_burst','sk_charge'], null,'幻獣を呼び出して戦う。'),
  J('alchemist','錬金術師',1,'⚗','#8fe0c6',{hp:12,mp:10,atk:3.0,def:3.4,spd:3.2,mag:5.0,acc:1.1,eva:0.9},['杖','銃','特殊'],'balanced',
    ['sk_poison','sk_heal','sk_water_burst','sk_curse','sk_drain','sk_greaterheal'], null,'薬と混合魔法で局面を変える。'),
  J('ninja','忍者',1,'✷','#8d9be8',{hp:11,mp:8,atk:5.2,def:2.6,spd:6.4,mag:3.8,acc:1.6,eva:1.8},['短剣','特殊','拳'],'speed',
    ['sk_wind_slash','sk_double','sk_poison','sk_sleep','sk_triple','sk_dark_burst'], null,'分身のような連撃と呪術。'),

  J('swordmaster','剣聖',2,'🗡','#ffd77a',{hp:17,mp:8,atk:7.2,def:4.2,spd:5.4,mag:3.2,acc:1.7,eva:1.2},['剣','短剣'],'critical',
    ['sk_none_judge','sk_light_judge','sk_ultimate','sk_quint','sk_focus','sk_awaken1'],
    { jobs:{fencer:4}, level:18 },'剣士の極致。会心と奥義で一閃する。'),
  J('archmage','魔導士',2,'✦','#d3a6ff',{hp:12,mp:16,atk:2.2,def:3.0,spd:3.4,mag:8.4,acc:1.2,eva:0.8},['杖','特殊'],'magic',
    ['sk_fire_nova','sk_ice_nova','sk_thunder_nova','sk_ultimate_m','sk_mindup','sk_meteo'],
    { jobs:{mage:4}, level:18 },'魔法使いの上位職。大魔法を操る。'),
  J('assassin','暗殺者',2,'☠','#ff8fa8',{hp:13,mp:9,atk:6.8,def:3.0,spd:7.2,mag:3.8,acc:2.2,eva:2.0},['短剣','銃'],'critical',
    ['sk_dark_judge','sk_poison','sk_confuse','sk_triple','sk_snipe','sk_drain'],
    { jobs:{thief:4}, level:18 },'一撃必殺を狙う闇の仕事人。'),
  J('dragonknight','竜騎士',2,'🐉','#ffab6b',{hp:21,mp:8,atk:6.6,def:6.0,spd:3.6,mag:3.6,acc:1.1,eva:0.7},['槍','斧','剣'],'power',
    ['sk_fire_impact','sk_fire_nova','sk_quake','sk_guardup','sk_summon_dr','sk_ultimate'],
    { jobs:{knight:4,warrior:3}, level:22 },'竜の力を宿した重装騎士。'),
  J('spellblade','魔剣士',2,'⚔','#9be9ff',{hp:15,mp:12,atk:6.0,def:4.2,spd:4.4,mag:6.2,acc:1.3,eva:1.0},['剣','杖','特殊'],'balanced',
    ['sk_thunder_slash','sk_ice_burst','sk_drain','sk_powerup','sk_light_judge','sk_ultimate'],
    { jobs:{fencer:3,mage:3}, level:22 },'剣と魔法を融合させた万能職。'),
  J('apostle','神の使徒',2,'✟','#fff0b8',{hp:16,mp:15,atk:3.4,def:5.0,spd:3.0,mag:7.4,acc:1.1,eva:1.0},['杖','槍','特殊'],'guard',
    ['sk_light_nova','sk_greaterheal','sk_revive','sk_light_judge','sk_regen','sk_focus'],
    { jobs:{priest:4}, level:20 },'奇跡を行使する聖なる代弁者。'),

  J('destroyer','破壊神',3,'☄','#ff7b6b',{hp:24,mp:14,atk:8.4,def:5.4,spd:4.4,mag:7.0,acc:1.5,eva:0.9},['斧','剣','拳','特殊'],'power',
    ['sk_fire_eternal','sk_none_judge','sk_ultimate','sk_meteo','sk_awaken3','sk_boss'],
    { jobs:{warrior:6,dragonknight:3}, level:38, awakening:2 },'全てを薙ぎ払う破壊の化身。'),
  J('timeweaver','時空術師',3,'⧗','#8ff0e0',{hp:14,mp:18,atk:3.2,def:4.0,spd:6.0,mag:9.2,acc:1.4,eva:1.4},['杖','特殊','銃'],'magic',
    ['sk_star_eternal','sk_awaken2','sk_ultimate_m','sk_haste','sk_thunder_nova','sk_secret'],
    { jobs:{mage:6,summoner:4}, level:40, awakening:2 },'時間と空間を編み直す禁術職。'),
  J('starguard','星輝の守護者',3,'✵','#ffe6a1',{hp:22,mp:16,atk:6.2,def:7.0,spd:4.0,mag:7.4,acc:1.4,eva:1.2},['剣','槍','杖','特殊'],'balanced',
    ['sk_star_judge','sk_star_eternal','sk_revive','sk_awaken1','sk_summon_dr','sk_light_nova'],
    { jobs:{knight:5,priest:4}, level:42, awakening:3 },'星の加護で戦場を支える最上位職。'),
  // 特殊役職「神」：指定名ギミックを持つキャラだけが、ランクアップ／転生時に就ける
  J('god','神',3,'✵','#fff6d0',{hp:32,mp:22,atk:11.5,def:9.2,spd:8.4,mag:11.8,acc:2.4,eva:2.0},
    ['剣','銃','杖','斧','槍','弓','拳','短剣','特殊'],'balanced',
    ['sk_god_flash','sk_god_heal','sk_god_nova','sk_god_barrier','sk_god_judge','sk_god_revive'],
    { god:true },'指定された名前にのみ解放される最上位の特殊役職。全能力が通常職を大きく上回る。'),
];
export const JOB = Object.fromEntries(JOBS.map(j => [j.id, j]));
export const GOD_JOB_ID = 'god';
export const GOD_SKILL_IDS = ['sk_god_flash','sk_god_heal','sk_god_nova','sk_god_barrier','sk_god_judge','sk_god_revive'];

/* -----------------------------------------------------------
   特殊ギミック：名前に含まれる文字列で「神」と専用奥義が解放される
   ※ 判定は作成時の 1 回だけ。後から名前を変えても増加しない。
   ----------------------------------------------------------- */
export const SPECIAL_NAME_KEYS = [
  { key:'飯山',   label:'飯山',   ultimateName:'飯山ラッシュ',       element:'none',     color:'#ff8f6b' },
  { key:'三尾',   label:'三尾',   ultimateName:'三尾イッキ',         element:'thunder',  color:'#ffe066' },
  { key:'すずそう', label:'すずそう', ultimateName:'地ならし',         element:'earth',    color:'#d8a866' },
  { key:'河岡',   label:'河岡',   ultimateName:'おにーちゃん///', element:'light',    color:'#ff9ecf' },
];
export function specialNameKey(name) {
  const n = String(name || '');
  const hit = SPECIAL_NAME_KEYS.find(x => n.includes(x.key));
  return hit ? hit.key : null;
}
export const SPECIAL_NAME_LABEL = Object.fromEntries(SPECIAL_NAME_KEYS.map(x => [x.key, x.label]));

/* -----------------------------------------------------------
   奥義：通常職 21 種 + 神 + 特殊ギミック 4 種
   - cat:'奥義' / ultimate:true / gauge:100（専用ゲージが満ちないと使用不可）
   - 通常技（最大威力 215）を大きく上回る
   ----------------------------------------------------------- */
export const ULTIMATE_GAUGE_MAX = 100;
export const ULTIMATE_GAUGE_GAIN = 22;      // プレイヤーターンごと
export const ULTIMATE_GAUGE_HIT_GAIN = 8;   // 被ダメージ時
const JOB_ULT_CONFIG = {
  warrior:    { name:'奥義・覇王崩天斬',   element:'none',     power:430, hits:1, scale:'atk', extra:[{op:'buff',stat:'atk',amount:55,dur:3,target:'self'}] },
  fencer:     { name:'奥義・千刃一閃',     element:'wind',     power:150, hits:3, scale:'atk', extra:[{op:'debuff',stat:'def',amount:22,dur:2}] },
  knight:     { name:'奥義・不落聖壁',     element:'earth',    power:390, hits:1, scale:'atk', extra:[{op:'shield',amount:260},{op:'buff',stat:'def',amount:60,dur:3,target:'self'}] },
  mage:       { name:'奥義・元素終焉',     element:'fire',     power:470, hits:1, scale:'mag', extra:[{op:'status',status:'burn',chance:85,dur:3}] },
  priest:     { name:'奥義・天啓の光',     element:'light',    power:410, hits:1, scale:'mag', extra:[{op:'heal',power:260,scale:'mag'},{op:'cleanse'}] },
  thief:      { name:'奥義・百影殺',       element:'dark',     power:135, hits:4, scale:'atk', extra:[{op:'status',status:'poison',chance:85,dur:3}] },
  archer:     { name:'奥義・天貫きの矢',   element:'wind',     power:455, hits:1, scale:'atk', extra:[{op:'debuff',stat:'eva',amount:30,dur:2}] },
  monk:       { name:'奥義・爆覇連拳',     element:'earth',    power:145, hits:4, scale:'atk', extra:[{op:'buff',stat:'spd',amount:45,dur:3,target:'self'}] },
  gunner:     { name:'奥義・雷弾終止符',   element:'thunder',  power:445, hits:1, scale:'atk', extra:[{op:'status',status:'paralysis',chance:70,dur:1}] },
  summoner:   { name:'奥義・幻獣降臨',     element:'star',     power:430, hits:1, scale:'mag', extra:[{op:'summon',power:260}] },
  alchemist:  { name:'奥義・賢者の方程式', element:'water',    power:420, hits:1, scale:'mag', extra:[{op:'restoreMp',amount:60},{op:'cleanse'}] },
  ninja:      { name:'奥義・影縫い千連',   element:'dark',     power:140, hits:4, scale:'atk', extra:[{op:'status',status:'sleep',chance:65,dur:1}] },
  swordmaster:{ name:'奥義・剣聖無双',     element:'light',    power:480, hits:1, scale:'atk', extra:[{op:'buff',stat:'acc',amount:40,dur:3,target:'self'}] },
  archmage:   { name:'奥義・大魔導崩壊',   element:'fire',     power:500, hits:1, scale:'mag', extra:[{op:'drainMp',amount:40}] },
  assassin:   { name:'奥義・即死の刻',     element:'dark',     power:490, hits:1, scale:'atk', extra:[{op:'status',status:'curse',chance:85,dur:3}] },
  dragonknight:{ name:'奥義・竜皇焔撃',   element:'fire',     power:475, hits:1, scale:'atk', extra:[{op:'buff',stat:'atk',amount:50,dur:3,target:'self'}] },
  spellblade: { name:'奥義・魔剣終極', element:'thunder', power:465, hits:1, scale:'mag', extra:[{op:'debuff',stat:'mag',amount:25,dur:2}] },
  apostle:    { name:'奥義・奇跡の裁き',   element:'light',    power:460, hits:1, scale:'mag', extra:[{op:'heal',power:220,scale:'mag'}] },
  destroyer:  { name:'奥義・万象壊滅',     element:'fire',     power:540, hits:1, scale:'atk', extra:[{op:'debuff',stat:'def',amount:30,dur:2}] },
  timeweaver: { name:'奥義・時空終断',     element:'star',     power:520, hits:1, scale:'mag', extra:[{op:'status',status:'confuse',chance:80,dur:2}] },
  starguard:  { name:'奥義・星輝創世',     element:'star',     power:505, hits:1, scale:'mag', extra:[{op:'shield',amount:240},{op:'heal',power:200,scale:'mag'}] },
};
function jobUltimate(job) {
  const c = JOB_ULT_CONFIG[job.id] || JOB_ULT_CONFIG.warrior;
  return {
    id:`ult_${job.id}`, name:c.name, element:c.element, cat:'奥義',
    mp:42, cd:5, gauge:ULTIMATE_GAUGE_MAX, fx:'ultimate', power:c.power,
    ultimate:true, jobId:job.id, tier:9, source:'evolution',
    desc:`${job.name}の最上位技。通常技を大きく上回る威力と固有の追加効果を持つ。`,
    parts:[{ op:'damage', power:c.power, scale:c.scale, hits:c.hits, trueHit:true, pierce:0.25 }, ...c.extra],
  };
}
export const JOB_ULTIMATES = JOBS.filter(j => j.id !== 'god').map(jobUltimate);
export const JOB_ULTIMATE = Object.fromEntries(JOB_ULTIMATES.map(u => [u.jobId, u.id]));

export const GOD_ULTIMATE_ID = 'ult_god';
export const GOD_ULTIMATE = {
  id:GOD_ULTIMATE_ID, name:'奥義・神創世記', element:'star', cat:'奥義',
  mp:56, cd:5, gauge:ULTIMATE_GAUGE_MAX, fx:'ultimate', power:620,
  ultimate:true, godOnly:true, jobId:'god', tier:9, source:'evolution',
  desc:'「神」のみが使える最上位の奥義。全能力を底上げしつつ敵を薙ぎ払う。',
  parts:[
    { op:'damage', power:620, scale:'mag', hits:2, trueHit:true, pierce:0.4 },
    { op:'buff', stat:'atk', amount:70, dur:4, target:'self' },
    { op:'buff', stat:'mag', amount:70, dur:4, target:'self' },
    { op:'heal', power:280, scale:'mag' },
  ],
};

const SPECIAL_ULT_PARTS = {
  '飯山': [
    { op:'damage', power:95,  scale:'atk', hits:5, trueHit:true },
    { op:'damage', power:330, scale:'atk', hits:1, trueHit:true, pierce:0.3 },
    { op:'debuff', stat:'def', amount:24, dur:2 },
  ],
  '三尾': [
    { op:'damage', power:145, scale:'atk', hits:3, trueHit:true },
    { op:'damage', power:360, scale:'atk', hits:1, trueHit:true, pierce:0.35 },
    { op:'buff', stat:'atk', amount:50, dur:3, target:'self' },
  ],
  'すずそう': [
    { op:'damage', power:270, scale:'atk', hits:1, trueHit:true, pierce:0.4 },
    { op:'damage', power:180, scale:'atk', hits:3, trueHit:true },
    { op:'debuff', stat:'spd', amount:35, dur:2 },
  ],
  '河岡': [
    { op:'buff', stat:'atk', amount:85, dur:4, target:'self' },
    { op:'buff', stat:'mag', amount:85, dur:4, target:'self' },
    { op:'buff', stat:'def', amount:65, dur:4, target:'self' },
    { op:'heal', power:280, scale:'mag' },
    { op:'damage', power:360, scale:'mag', hits:1, trueHit:true, pierce:0.3 },
  ],
};
export const SPECIAL_ULTIMATES = SPECIAL_NAME_KEYS.map(x => ({
  id:`ult_special_${SPECIAL_NAME_KEYS.indexOf(x)}`, name:x.ultimateName, element:x.element,
  cat:'奥義', mp:38, cd:4, gauge:ULTIMATE_GAUGE_MAX, fx:'ultimate',
  power:340, ultimate:true, special:x.key, tier:9, source:'evolution',
  desc:`「${x.label}」の名を宿す者だけが使える特別な奥義。ランク進化で威力と効果が強化される。`,
  parts:SPECIAL_ULT_PARTS[x.key],
}));
export const SPECIAL_ULTIMATE = Object.fromEntries(SPECIAL_NAME_KEYS.map((x,i) => [x.key, SPECIAL_ULTIMATES[i].id]));
export const ULTIMATE_SKILLS = [...JOB_ULTIMATES, GOD_ULTIMATE, ...SPECIAL_ULTIMATES];
export const ULTIMATE_IDS = new Set(ULTIMATE_SKILLS.map(u => u.id));

/* 神専用技（通常技として習得） */
const GOD_SKILLS = [
  { id:'sk_god_flash', name:'神閃', element:'light', cat:'神専用技', mp:16, cd:2, fx:'prism', power:230,
    parts:[{op:'damage',power:230,scale:'atk',hits:2,trueHit:true}], desc:'神の光が二度走る。' },
  { id:'sk_god_heal', name:'神癒', element:'light', cat:'神専用技', mp:20, cd:3, fx:'heal', power:0,
    parts:[{op:'heal',power:300,scale:'mag'},{op:'cleanse'}], desc:'全快に近い回復と状態解除。' },
  { id:'sk_god_nova', name:'神新星', element:'star', cat:'神専用技', mp:30, cd:4, fx:'nova', power:320,
    parts:[{op:'damage',power:320,scale:'mag',hits:1,trueHit:true},{op:'status',status:'stun',chance:50,dur:1}], desc:'星を裂く大魔法。' },
  { id:'sk_god_barrier', name:'神壁', element:'earth', cat:'神専用技', mp:22, cd:3, fx:'buff', power:0,
    parts:[{op:'shield',amount:420},{op:'buff',stat:'def',amount:70,dur:4,target:'self'}], desc:'絶対の防壁を張る。' },
  { id:'sk_god_judge', name:'神裁', element:'light', cat:'神専用技', mp:34, cd:4, fx:'holy', power:360,
    parts:[{op:'damage',power:360,scale:'atk',hits:1,trueHit:true,pierce:0.35}], desc:'裁きの一撃。' },
  { id:'sk_god_revive', name:'神息吹', element:'star', cat:'神専用技', mp:26, cd:4, fx:'prism', power:0,
    parts:[{op:'restoreMp',amount:80},{op:'status',status:'regen',chance:100,dur:4,target:'self'}], desc:'MPを満たし再生を付与。' },
].map(x => ({ ...x, tier:9, source:'god' }));

export const SKILLS = [...BASE_SKILLS, ...GOD_SKILLS, ...ULTIMATE_SKILLS];
export const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const SKILL_COUNT = SKILLS.length;
/** BP・技の書で習得できる技（奥義は進化／ギミック専用） */
export const LEARNABLE_SKILLS = SKILLS.filter(s => !s.ultimate && s.source !== 'god');
export const LEARNABLE_SKILL_COUNT = LEARNABLE_SKILLS.length;
export const WEAPON_TYPES = ['剣','銃','杖','斧','槍','弓','拳','短剣','特殊'];

/* -----------------------------------------------------------
   装備データ：6レアリティ × 各スロット。特殊効果付き
   ----------------------------------------------------------- */
const SLOT_INFO = {
  weapon: { name: '武器', icon: '⚔', stat: 'atk' },
  armor: { name: '防具', icon: '🛡', stat: 'def' },
  accessory: { name: 'アクセサリー', icon: '💍', stat: 'def' },
  ornament: { name: '装飾品', icon: '✧', stat: 'mp' },
};
export const SLOTS = Object.keys(SLOT_INFO);
export const SLOT_NAME = Object.fromEntries(Object.entries(SLOT_INFO).map(([k,v]) => [k,v.name]));

const BASES = {
  weapon: [
    { type:'剣', names:['旅人の剣','鋼の長剣','ルーンブレード','暁光の聖剣','神話剣アストラ','零式・無銘'] },
    { type:'銃', names:['旧式マスケット','精密銃','雷鳴の拳銃','星撃ちの連銃','神機銃ミュール','終焉銃ノクス'] },
    { type:'杖', names:['木の杖','魔導の杖','元素の枝','賢者の錫杖','天球杖オルビス','原初の杖'] },
    { type:'斧', names:['薪割り斧','戦斧','砕岩斧','竜牙の大斧','滅斧バハムート','世界斧エッジ'] },
    { type:'槍', names:['木槍','騎兵槍','風穿ちの槍','竜鱗槍','星槍グングニル','界槍エターナル'] },
    { type:'弓', names:['狩人の弓','複合弓','風読みの弓','月弓アルテミス','天弓アポロン','無弦の弓'] },
    { type:'拳', names:['革の篭手','鉄拳篭手','震撃の篭手','鬼神の拳','星砕きの拳','空拳ゼロ'] },
    { type:'短剣', names:['小刀','鋭利な短剣','影縫いの刃','夜叉の牙','神影クリス','虚無の刃'] },
    { type:'特殊', names:['護身の護符','練成リング','錬金式盤','浮遊魔方陣','星辰エンジン','因果の器'] },
  ],
  armor: [
    { type:'軽装', names:['布の服','旅人の革鎧','風軽の鎧','疾光の戦衣','天羽の羽衣','無重力の衣'] },
    { type:'重装', names:['鉄の胸当て','騎士の甲冑','砦の大鎧','不落の城壁','神鉄の巨鎧','絶対防壁アイギス'] },
    { type:'法衣', names:['見習いのローブ','魔導ローブ','元素の法衣','賢者の外套','星海のマント','原初のヴェール'] },
    { type:'忍装', names:['稽古着','闇の装束','影縫いの衣','月影の忍装','無音の黒衣','虚無の纏い'] },
  ],
  accessory: [
    { type:'指輪', names:['銅の指輪','敏捷の指輪','会心の指輪','王者の指輪','神代の指輪','∞の指輪'] },
    { type:'護符', names:['木の護符','守りの護符','浄化の護符','聖別の護符','龍脈の護符','世界樹の護符'] },
    { type:'眼飾り', names:['布の眼帯','狙撃眼','千里眼','真実の瞳','星読の瞳','全知の瞳'] },
    { type:'帯', names:['麻の帯','気合の帯','闘気の帯','剛毅の帯','神気の帯','無限の帯'] },
  ],
  ornament: [
    { type:'髪飾り', names:['木の髪留め','水晶の髪飾り','風のリボン','光冠のティアラ','星冠ディアデム','零の冠'] },
    { type:'マント', names:['古びたマント','旅のマント','魔除けのクローク','騎士のマント','神獣の毛皮','虚空の翅'] },
    { type:'紋章', names:['木の紋章','鍛冶の紋章','魔導紋章','英雄の紋章','神紋エンブレム','創世の紋章'] },
    { type:'宝珠', names:['硝子玉','魔力の宝珠','元素の珠','賢者の宝珠','星核オーブ','始源の珠'] },
  ],
};
const EFFECT_POOL = [
  { id:'crit', name:'会心強化', desc:'会心率+8%', value:8 },
  { id:'lifesteal', name:'吸血', desc:'与ダメージの8%回復', value:8 },
  { id:'mpRegen', name:'魔力循環', desc:'毎ターンMP+5', value:5 },
  { id:'hpRegen', name:'自動回復', desc:'毎ターンHP+3%', value:3 },
  { id:'counter', name:'反撃', desc:'被ダメの12%を反射', value:12 },
  { id:'firstStrike', name:'先制', desc:'初ターン与ダメ+20%', value:20 },
  { id:'ignoreDef', name:'貫通', desc:'防御を15%無視', value:15 },
  { id:'damageCut', name:'鉄壁', desc:'被ダメ-7%', value:7 },
  { id:'extraStrike', name:'追撃', desc:'攻撃時10%で追加打撃', value:10 },
  { id:'statusGuard', name:'状態耐性', desc:'状態異常を30%防ぐ', value:30 },
  { id:'expBonus', name:'賢者の加護', desc:'獲得EXP+10%', value:10 },
  { id:'coinBonus', name:'福運', desc:'獲得コイン+12%', value:12 },
  { id:'bpBonus', name:'闘志', desc:'獲得BP+10%', value:10 },
  { id:'critDamage', name:'会心威力', desc:'クリティカルダメージ+35%', value:35 },
  { id:'ultimatePower', name:'奥義強化', desc:'奥義威力+30%', value:30 },
  { id:'normalAttackPower', name:'通常攻撃強化', desc:'通常攻撃の威力+25%', value:25 },
  { id:'extraDamage', name:'追加打撃', desc:'攻撃時に固定追加ダメージ', value:45 },
  { id:'element_fire', name:'火属性強化', desc:'火属性の攻撃力+30%', value:30 },
  { id:'element_water', name:'水属性強化', desc:'水属性の攻撃力+30%', value:30 },
  { id:'element_wind', name:'風属性強化', desc:'風属性の攻撃力+30%', value:30 },
  { id:'element_earth', name:'土属性強化', desc:'土属性の攻撃力+30%', value:30 },
  { id:'element_thunder', name:'雷属性強化', desc:'雷属性の攻撃力+30%', value:30 },
  { id:'element_ice', name:'氷属性強化', desc:'氷属性の攻撃力+30%', value:30 },
  { id:'element_light', name:'光属性強化', desc:'光属性の攻撃力+30%', value:30 },
  { id:'element_dark', name:'闇属性強化', desc:'闇属性の攻撃力+30%', value:30 },
  { id:'element_star', name:'星属性強化', desc:'星属性の攻撃力+30%', value:30 },
];
export const EFFECTS = Object.fromEntries(EFFECT_POOL.map(e => [e.id, e]));

function buildEquipment() {
  const defs = [];
  for (const [slot, bases] of Object.entries(BASES)) {
    for (const base of bases) {
      RARITIES.forEach((r, ri) => {
        const id = `eq_${slot}_${base.type}_${r.id}`;
        const core = SLOT_INFO[slot].stat;
        const baseVal = slot === 'weapon' ? 9 : slot === 'armor' ? 11 : 6;
        const stats = { [core]: Math.round(baseVal * r.mult) };
        if (slot === 'weapon') stats.atk = (stats.atk || 0) + Math.round(1 * r.mult);
        if (slot === 'armor') { stats.hp = Math.round(18 * r.mult); stats.def = (stats.def || 0) + Math.round(2 * r.mult); }
        if (slot === 'accessory') { stats.hp = Math.round(5 * r.mult); stats.def = (stats.def || 0) + Math.round(1 * r.mult); }
        if (slot === 'ornament') { stats.mp = (stats.mp || 0) + Math.round(7 * r.mult); stats.atk = Math.round(1 * r.mult); }
        if (ri >= 2) {
          const eff = EFFECT_POOL[(bases.indexOf(base) * 3 + ri) % EFFECT_POOL.length];
          stats.effects = [{ id: eff.id, value: Math.round(eff.value * (1 + (ri - 2) * 0.35)) }];
        }
        if (ri >= 4) {
          const eff2 = EFFECT_POOL[(bases.indexOf(base) * 5 + ri + 4) % EFFECT_POOL.length];
          if (!stats.effects) stats.effects = [];
          stats.effects.push({ id: eff2.id, value: Math.round(eff2.value * 1.5) });
        }
        defs.push({
          id, slot, type: base.type, name: base.names[ri], rarity: r.id,
          stats, desc: `${base.type} / ${r.name}。${core === 'atk' ? '攻撃力' : core === 'def' ? '防御力' : core === 'hp' ? 'HP' : 'MP'}を高める。`,
          color: r.color, glow: r.glow,
        });
      });
    }
  }
  return defs;
}
export const EQUIPMENT = buildEquipment();
/** 神専用装備：通常のガチャ・交換・合成の排出プールには入れない */
export const GOD_EQUIPMENT = [
  { id:'eq_god_weapon', slot:'weapon', type:'特殊', name:'神器・創世の剣', rarity:'S', godOnly:true,
    stats:{ atk:230, hp:120, effects:[{id:'ultimatePower',value:60},{id:'critDamage',value:70},{id:'ignoreDef',value:30},{id:'element_star',value:45}] },
    desc:'神のみが扱える最上位の武器。', color:'#fff6d0', glow:'prism' },
  { id:'eq_god_armor', slot:'armor', type:'法衣', name:'神衣・天穹', rarity:'S', godOnly:true,
    stats:{ def:126, hp:420, mp:80, effects:[{id:'damageCut',value:18},{id:'hpRegen',value:8},{id:'statusGuard',value:60}] },
    desc:'神を包む天穹の衣。', color:'#fff6d0', glow:'prism' },
  { id:'eq_god_accessory', slot:'accessory', type:'指輪', name:'神環・∞', rarity:'S', godOnly:true,
    stats:{ def:28, atk:3, effects:[{id:'crit',value:25},{id:'critDamage',value:55},{id:'extraStrike',value:30}] },
    desc:'無限を刻む神の指輪。', color:'#fff6d0', glow:'prism' },
  { id:'eq_god_ornament', slot:'ornament', type:'宝珠', name:'神核・始源', rarity:'S', godOnly:true,
    stats:{ atk:76, mp:170, effects:[{id:'ultimatePower',value:55},{id:'element_light',value:50},{id:'mpRegen',value:12}] },
    desc:'始源の力を宿す宝珠。', color:'#fff6d0', glow:'prism' },
];
export const GOD_EQUIPMENT_IDS = GOD_EQUIPMENT.map(e => e.id);
export const EQUIP_BY_ID = Object.fromEntries([...EQUIPMENT, ...GOD_EQUIPMENT].map(e => [e.id, e]));

/* -----------------------------------------------------------
   アイテム / 素材
   ----------------------------------------------------------- */
export const ITEMS = [
  { id:'potion_s', name:'回復薬・小', kind:'consumable', icon:'🧪', price:80, sell:24, desc:'HPを80回復', battle:{op:'heal',value:80} },
  { id:'potion_m', name:'回復薬・中', kind:'consumable', icon:'🧪', price:240, sell:72, desc:'HPを220回復', battle:{op:'heal',value:220} },
  { id:'potion_l', name:'回復薬・大', kind:'consumable', icon:'⚗', price:620, sell:186, desc:'HPを500回復', battle:{op:'heal',value:500} },
  { id:'ether_s', name:'魔法の水', kind:'consumable', icon:'💧', price:150, sell:45, desc:'MPを35回復', battle:{op:'mp',value:35} },
  { id:'ether_l', name:'精霊の雫', kind:'consumable', icon:'💧', price:420, sell:126, desc:'MPを90回復', battle:{op:'mp',value:90} },
  { id:'antidote', name:'万能薬', kind:'consumable', icon:'🌿', price:130, sell:39, desc:'状態異常をすべて解除', battle:{op:'cleanse'} },
  { id:'stimulant', name:'気付け薬', kind:'consumable', icon:'✨', price:180, sell:54, desc:'攻撃力を2ターン+30%', battle:{op:'buff',stat:'atk',value:30} },
  { id:'elixir', name:'エリクシール', kind:'consumable', icon:'🏺', price:1500, sell:450, desc:'HP/MPを全回復', battle:{op:'full'} },
  { id:'mat_ore', name:'精錬鉱石', kind:'material', icon:'⛏', price:200, sell:60, desc:'装備強化に使う鉱石' },
  { id:'mat_crystal', name:'進化の結晶', kind:'material', icon:'💎', price:600, sell:180, desc:'覚醒・進化の触媒' },
  { id:'mat_stone', name:'覚醒石', kind:'material', icon:'🔷', price:900, sell:270, desc:'覚醒に必要な希少石' },
  { id:'mat_stardust', name:'星砂', kind:'material', icon:'🌌', price:1200, sell:360, desc:'高段階覚醒・合成に必要' },
  { id:'mat_catalyst', name:'合成触媒', kind:'material', icon:'⚙', price:700, sell:210, desc:'レア装備の合成に使う' },
  { id:'mat_proof', name:'強敵の証', kind:'material', icon:'🏅', price:0, sell:400, desc:'ボス撃破の証。特殊職の条件' },
  { id:'mat_rebirth', name:'転生の証', kind:'material', icon:'🕊', price:0, sell:800, desc:'転生に必要な証' },
  { id:'book_basic', name:'技の書・初級', kind:'book', icon:'📕', price:500, sell:150, desc:'ランダムな初級技を習得' },
  { id:'book_mid', name:'技の書・中級', kind:'book', icon:'📗', price:1400, sell:420, desc:'ランダムな中級技を習得' },
  { id:'book_high', name:'技の書・極意', kind:'book', icon:'📘', price:3200, sell:960, desc:'ランダムな上級技を習得' },
  { id:'book_secret', name:'禁断の書', kind:'book', icon:'📜', price:0, sell:1200, desc:'覚醒・必殺級の技を習得' },
];
// 進化素材 40 種（形状・装飾・発光が種類とランクごとに異なる）
ITEMS.push(...MATERIAL_ITEMS);
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const MATERIAL_ITEM_IDS = MATERIAL_ITEMS.map(m => m.id);

/* -----------------------------------------------------------
   CPU対戦相手 / ダンジョン
   ----------------------------------------------------------- */
const ENEMY_ARCHETYPES = [
  { key:'rookie', name:'見習い剣士 リィル', job:'fencer', style:'balanced', palette:{hair:'#7c5b3e',cloth:'#4c82c4',skin:'#f0c9a0',accent:'#e8d38a'}, tier:0 },
  { key:'guard', name:'鉄壁の兵 ガルド', job:'knight', style:'guard', palette:{hair:'#4a4640',cloth:'#8d8f96',skin:'#e6b98f',accent:'#d4af57'}, tier:0 },
  { key:'witch', name:'火花の魔女 ミナ', job:'mage', style:'magic', palette:{hair:'#c34c6e',cloth:'#8b5ab5',skin:'#f2cbb0',accent:'#ffb347'}, tier:0 },
  { key:'healer', name:'巡礼僧 ノエ', job:'priest', style:'guard', palette:{hair:'#e4d8b0',cloth:'#f0ead6',skin:'#f0c8a4',accent:'#f6d77a'}, tier:0 },
  { key:'bandit', name:'影盗贼 シェイド', job:'thief', style:'critical', palette:{hair:'#2c2f3d',cloth:'#384a42',skin:'#dbaf8b',accent:'#8ce6a8'}, tier:0 },
  { key:'hunter', name:'山狩り ヴェル', job:'archer', style:'speed', palette:{hair:'#6f8a4a',cloth:'#51704f',skin:'#e9bf94',accent:'#c8e08a'}, tier:0 },
  { key:'fist', name:'拳闘士 ドーガ', job:'monk', style:'power', palette:{hair:'#392b22',cloth:'#b2553c',skin:'#c98f66',accent:'#f0b27a'}, tier:0 },
  { key:'gunner', name:'雷銃使い リコ', job:'gunner', style:'critical', palette:{hair:'#6d7fa8',cloth:'#3b4c66',skin:'#edc3a0',accent:'#ffe066'}, tier:0 },
  { key:'sum', name:'幻獣使い セリ', job:'summoner', style:'magic', palette:{hair:'#9a76c9',cloth:'#57427e',skin:'#f0c9ae',accent:'#b6e3ff'}, tier:0 },
  { key:'alch', name:'調合師 カノ', job:'alchemist', style:'balanced', palette:{hair:'#4fa89a',cloth:'#315e5c',skin:'#e8c09a',accent:'#8fe0c6'}, tier:0 },
  { key:'ninja', name:'疾影 クオン', job:'ninja', style:'speed', palette:{hair:'#263354',cloth:'#2b3159',skin:'#e2b994',accent:'#9db4ff'}, tier:0 },
  { key:'sword', name:'剣聖 アーレンス', job:'swordmaster', style:'critical', palette:{hair:'#d8d3c0',cloth:'#274b78',skin:'#eec39e',accent:'#ffd77a'}, tier:1 },
  { key:'arch', name:'大魔導 イリス', job:'archmage', style:'magic', palette:{hair:'#7c5ea8',cloth:'#3d2a68',skin:'#f0c8ae',accent:'#d3a6ff'}, tier:1 },
  { key:'assa', name:'無音の刃 ゼロ', job:'assassin', style:'critical', palette:{hair:'#1c1c26',cloth:'#2a1c2e',skin:'#d9ad8e',accent:'#ff8fa8'}, tier:1 },
  { key:'drag', name:'竜騎士 グレン', job:'dragonknight', style:'power', palette:{hair:'#8c3a24',cloth:'#5c2f28',skin:'#dc9e72',accent:'#ffab6b'}, tier:1 },
  { key:'spell', name:'魔剣士 リーネ', job:'spellblade', style:'balanced', palette:{hair:'#4fa8c8',cloth:'#244b6b',skin:'#eec6a6',accent:'#9be9ff'}, tier:1 },
  { key:'apo', name:'使徒 セラフィナ', job:'apostle', style:'guard', palette:{hair:'#f0e0a0',cloth:'#efe6c8',skin:'#f2ccae',accent:'#fff0b8'}, tier:1 },
];
const BOSS_ARCHETYPES = [
  { key:'boss1', name:'塔の主・ヴァルガス', job:'destroyer', style:'power', palette:{hair:'#5e1f1f',cloth:'#3a1420',skin:'#c88762',accent:'#ff7b6b'}, tier:2, boss:true },
  { key:'boss2', name:'時空の番人 クロノス', job:'timeweaver', style:'magic', palette:{hair:'#3a7c86',cloth:'#173a4a',skin:'#d8b394',accent:'#8ff0e0'}, tier:2, boss:true },
  { key:'boss3', name:'星輝の守護者 エテル', job:'starguard', style:'balanced', palette:{hair:'#e8dcae',cloth:'#38416e',skin:'#ecc9a6',accent:'#ffe6a1'}, tier:2, boss:true },
  { key:'hidden', name:['？','虚無の王 ノクティス'], job:'timeweaver', style:'magic', palette:{hair:'#161028',cloth:'#1c1230',skin:'#b9a2c9',accent:'#c58cff'}, tier:3, boss:true, hidden:true },
];
/* -----------------------------------------------------------
   Google Drive「敵キャラ」の静止 PNG だけを登録する敵カタログ。
   -----------------------------------------------------------
   - ENEMY_KINDS の 1 種類 = 1 体の敵。全 180 ファイルは ASSET_FILES で
     いずれか 1 体へ必ず紐づく（js/enemyAssets.js の台帳を参照）。
   - 3D モデル・アニメーション・動画・生成画像は一切使わない。
   - 元 PNG は変換せず、CSS の表示サイズ / 向き / 接地 / 攻撃モーション /
     エフェクトだけを変える（js/enemyArt.js + css/style.css）。
   - 既存 31 体にも artId を割り当て、CPU 戦の敵画像をすべて Drive 素材へ
     統一する。能力値・報酬・並び順・セーブデータは変更しない。
   ----------------------------------------------------------- */
const DRIVE_JOB_RULES = [
  [/弓|矢|ボウ|アーチャー/, 'archer'],
  [/杖|魔法|呪|術|球|魔導|呪文|マジック/, 'mage'],
  [/槍|突|ランス|スピア/, 'fencer'],
  [/斧|棍棒|槌|大剣|剛|王/, 'warrior'],
  [/爪|牙|噛|翼|飛|浮遊/, 'monk'],
  [/盾|甲|兜|角|重|石/, 'knight'],
  [/鎌|影|死|霊|骸骨|幽|瞳/, 'assassin'],
  [/銃|砲|弾/, 'gunner'],
];
function driveJob(k) {
  const t = `${k.weapon || ''} ${k.features || ''} ${k.build || ''} ${k.move?.name || ''}`;
  for (const [re, id] of DRIVE_JOB_RULES) if (re.test(t) && JOB[id]) return id;
  return k.tier >= 3 ? 'timeweaver' : k.tier >= 1 ? 'spellblade' : 'warrior';
}
function driveStyle(k) {
  if (k.move?.status) return 'critical';
  if (k.move?.motion === 'cast' || k.move?.motion === 'gaze') return 'magic';
  if (k.tier >= 3) return 'guard';
  if (k.display?.float || k.build?.includes('小型')) return 'speed';
  if ((k.move?.hits || 1) > 1) return 'balanced';
  return 'power';
}
function appendDriveEnemies(list) {
  for (const k of ENEMY_KINDS) {
    const jobId = driveJob(k), job = JOB[jobId];
    const level = 4 + k.tier * 9 + Math.min(4, (k.fileIds?.length || 1) % 5);
    const mul = Number((0.88 + k.tier * 0.16).toFixed(2));
    const skillIds = [...job.skills];
    if (k.tier >= 1) skillIds.push('sk_ultimate');
    if (k.tier >= 3) skillIds.push('sk_greaterheal');
    const color = k.move?.color || '#a9b4c4';
    list.push({
      id: k.id, name: k.name, trueName: null,
      job: jobId, style: driveStyle(k),
      difficulty: ['ノーマル','強敵','上級','最上級','深淵'][k.tier] || '強敵',
      level, mul,
      palette: { hair:color, cloth:color, skin:'#e8c9a6', accent:color },
      tier: k.tier, boss:false, hidden:false,
      artId: k.id, assetKind: k.id,
      skills: [...new Set(skillIds)],
      equipment: RARITIES.slice(0, Math.min(6, 1 + k.tier)).map((r,i)=>({ slot:SLOTS[i], rarity:r.id })),
      desc: `${k.family} / ${k.build} / ${k.weapon} / ${k.move?.name || ''}`,
    });
  }
  // 既存 CPU も含め、全敵が必ずいずれかの Drive 素材を参照する
  list.forEach((en, i) => {
    if (en.artId) return;
    const tier = Math.min(4, en.tier || 0);
    const pool = ENEMY_KINDS.filter(k => k.tier === tier);
    const k = (pool.length ? pool : ENEMY_KINDS)[(i * 7 + tier * 3) % (pool.length || ENEMY_KINDS.length)];
    en.artId = k.id;
  });
  return list;
}
function buildEnemies() {
  const list = [];
  const add = (a, i, difficulty, level, mul, prefix = '') => {
    const job = JOB[a.job];
    const skillIds = [...job.skills];
    if (a.tier >= 1) skillIds.push('sk_ultimate', 'sk_greaterheal');
    if (a.boss) skillIds.push('sk_boss', 'sk_revive', 'sk_summon_dr');
    list.push({
      id: `${prefix}${a.key}_${i}`,
      name: Array.isArray(a.name) ? a.name[0] : `${prefix ? '' : ''}${a.name}`,
      trueName: Array.isArray(a.name) ? a.name[1] : null,
      job: a.job, style: a.style, difficulty, level, mul, palette: a.palette,
      tier: a.tier, boss: !!a.boss, hidden: !!a.hidden,
      skills: [...new Set(skillIds)],
      equipment: RARITIES.slice(0, Math.min(6, 1 + a.tier + (a.boss ? 1 : 0))).map((r, k) => ({ slot: SLOTS[k], rarity: r.id })),
      desc: `${job.name} / ${difficulty} / Lv.${level}`,
    });
  };
  ENEMY_ARCHETYPES.forEach((a, i) => {
    add(a, 0, 'ノーマル', 3 + Math.floor(i * 0.8), 0.85 + i * 0.015);
    if (a.tier >= 1 || i % 3 === 1) add(a, 1, '強敵', 14 + i, 1.05 + i * 0.02, 'ex_');
  });
  BOSS_ARCHETYPES.forEach((a, i) => {
    add(a, 0, a.hidden ? '隠しボス' : 'ボス', a.hidden ? 90 : 30 + i * 12, a.hidden ? 2.5 : 1.5 + i * 0.25);
  });
  return appendDriveEnemies(list);
}
export const ENEMIES = buildEnemies();
export const ENEMY = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

/* -----------------------------------------------------------
   ゲームのヒント：12 カテゴリ（静的な解説文）
   進行状況に応じた「現在値・次の目標・不足条件」は state.js の
   hintState() が実ゲームの判定関数から組み立てる。
   ----------------------------------------------------------- */
export const HINT_CATEGORIES = [
  { id:'create', icon:'🎨', name:'キャラクター作成',
    text:'街のホーム画面の「キャラクターを作成する」から開きます。名前・画像読み込み・拡大縮小・色彩調整を設定して「作成を完了する」で街へ戻ります。既存キャラは削除されません。' },
  { id:'growth', icon:'📈', name:'レベルアップと育成',
    text:'CPU対戦や修行で EXP を獲得するとレベルが上がり、HP・攻撃力・防御力・MP が上昇してステータスポイント +4 と全回復が発生します。育成の間で自由に振り分けできます。' },
  { id:'equipment', icon:'⚒', name:'武器・装備',
    text:'武器は主に攻撃力、防具は主に防御力と HP を上げます。高レアリティほど上昇幅が大きく、装備を外すと上昇分は消えます。工房の「装備」タブで付け替えます。' },
  { id:'gacha', icon:'✧', name:'ガチャ',
    text:'工房の「ガチャ」タブから引けます。ピックアップ・提供割合・独立天井・履歴があり、結果は演出開始前に確定してセーブされます。' },
  { id:'battle', icon:'🏛', name:'CPU対戦',
    text:'ターン制コマンドバトル。通常攻撃は MP 不要、技や奥義は MP を消費します。勝利でコイン・EXP・BP・素材を獲得します。' },
  { id:'materials', icon:'💠', name:'素材集め',
    text:'進化素材は CPU対戦・ダンジョン・クエスト・ガチャ10連・道具屋・素材合成で入手できます。8 種類 × 5 ランク = 40 種。' },
  { id:'evolution', icon:'✦', name:'ランク進化',
    text:'R → SR → SSR → UR → LR。レベル・コイン・素材が必要で、HP・攻撃力・防御力・MP すべてが大幅に上昇します。レベルや画像・職業・装備は維持されます。' },
  { id:'job', icon:'🔀', name:'役職変更',
    text:'ランクアップ時または転生時のみ可能です。「現在の役職を維持する」か「別の役職に変更する」かを選べます。育成画面などから自由には変更できません。' },
  { id:'rebirth', icon:'🔄', name:'転生',
    text:'レベル上限到達後に「転生の証」と 5,000 コインで実行。レベル上限 +10、永続ボーナス、ステータスポイント +15。このときも役職変更の機会があります。' },
  { id:'skills', icon:'✵', name:'技と奥義',
    text:'育成の間で技を習得・付け替えできます。LR 進化で各職業の専用奥義、R → SR 進化で指定名の特殊奥義を習得。専用ゲージが溜まると使用可能です。' },
  { id:'story', icon:'📜', name:'ストーリー',
    text:'街から「ストーリー」を開いて章を読むと進行します。読んだ章とクリア状況はセーブされ、やりこみ要素の解放条件にも使われます。' },
  { id:'endgame', icon:'🏆', name:'やりこみ要素',
    text:'覚醒・ダンジョン・隠しボス・図鑑コンプ・実績・称号・クエストなど、ランク進化の先にある目標です。' },
];
export const RANKS = [
  { name:'ブロンズ', min:0, reward:0 }, { name:'シルバー', min:120, reward:500 },
  { name:'ゴールド', min:350, reward:1200 }, { name:'プラチナ', min:750, reward:2500 },
  { name:'ダイヤモンド', min:1400, reward:5000 }, { name:'マスター', min:2400, reward:9000 },
  { name:'レジェンド', min:4000, reward:16000 }, { name:'神階', min:6500, reward:30000 },
];

/* -----------------------------------------------------------
   クエスト / 実績 / 称号 / 交換所
   ----------------------------------------------------------- */
export const QUESTS = [
  { id:'q_win3', name:'腕試し', desc:'CPU対戦に3回勝利する', type:'win', need:3, reward:{coins:600,bp:20,items:{mat_ore:2,evo_stone_R:2}}, daily:false },
  { id:'q_battle5', name:'修練の日々', desc:'対戦を5回行う', type:'battle', need:5, reward:{coins:400,exp:120,items:{evo_stone_R:1}}, daily:true },
  { id:'q_train3', name:'汗の結晶', desc:'修行を3回行う', type:'train', need:3, reward:{coins:350,items:{mat_crystal:1,awaken_crystal_R:1}}, daily:true },
  { id:'q_pull', name:'工房の賑わい', desc:'ガチャを1回引く', type:'pull', need:1, reward:{coins:300,bp:10,items:{weapon_ore_R:1}}, daily:true },
  { id:'q_skill', name:'技の探究', desc:'技を1つ習得する', type:'skill', need:1, reward:{bp:30,items:{book_basic:1}}, daily:false },
  { id:'q_awake', name:'眠れる力', desc:'覚醒を1段階進める', type:'awake', need:1, reward:{coins:1200,items:{mat_stardust:1}}, daily:false },
  { id:'q_boss', name:'強敵討伐', desc:'ボスを1体倒す', type:'boss', need:1, reward:{bp:80,items:{mat_proof:1,boss_core_SR:1}}, daily:false },
  { id:'q_dungeon', name:'迷宮踏破', desc:'ダンジョンを3階進む', type:'floor', need:3, reward:{coins:1500,bp:40,items:{mana_crystal_SR:1}}, daily:false },
  { id:'q_synth', name:'鍛冶の妙', desc:'装備を1回合成する', type:'synth', need:1, reward:{items:{mat_catalyst:2},coins:500}, daily:false },
  { id:'q_damage', name:'一撃必殺', desc:'累計10000ダメージを与える', type:'damage', need:10000, reward:{bp:100,items:{mat_stone:1,element_gem_SSR:1}}, daily:false },
  { id:'q_level', name:'成長の記録', desc:'レベルを10上げる', type:'level', need:10, reward:{coins:2000,exp:300}, daily:false },
  { id:'q_rebirth', name:'輪廻の果て', desc:'転生を1回行う', type:'rebirth', need:1, reward:{bp:300,items:{mat_rebirth:1,legend_mat_UR:1}}, daily:false },
];
export const ACHIEVEMENTS = [
  { id:'a_first', name:'はじめの一歩', desc:'初めて対戦に勝利', cond:s=>s.stats.wins>=1, reward:{coins:500,bp:20,items:{evo_stone_R:2}}, title:'駆け出しの挑戦者' },
  { id:'a_win10', name:'十連の猛者', desc:'対戦に10勝', cond:s=>s.stats.wins>=10, reward:{coins:1500,bp:60,items:{awaken_crystal_SR:2}}, title:'熟達の戦士' },
  { id:'a_win50', name:'百戦錬磨', desc:'対戦に50勝', cond:s=>s.stats.wins>=50, reward:{coins:6000,bp:200,items:{job_proof_SSR:1}}, title:'歴戦の英雄' },
  { id:'a_streak5', name:'連勝街道', desc:'5連勝を達成', cond:s=>s.bestStreak>=5, reward:{coins:1800,bp:80}, title:'無敗の疾風' },
  { id:'a_streak10', name:'不敗の証', desc:'10連勝を達成', cond:s=>s.bestStreak>=10, reward:{coins:5000,bp:180}, title:'不敗王' },
  { id:'a_lv30', name:'熟成の時', desc:'Lv.30に到達', cond:s=>maxLevel(s)>=30, reward:{coins:2000,items:{mat_stone:1}}, title:'努力の結晶' },
  { id:'a_lv60', name:'頂を望む', desc:'Lv.60に到達', cond:s=>maxLevel(s)>=60, reward:{coins:8000,items:{mat_rebirth:1}}, title:'極みの資格者' },
  { id:'a_awake3', name:'進化の光', desc:'覚醒IIIに到達', cond:s=>maxAwakening(s)>=3, reward:{bp:150,items:{mat_stardust:2}}, title:'覚醒せし者' },
  { id:'a_awake5', name:'極致の先へ', desc:'覚醒Vに到達', cond:s=>maxAwakening(s)>=5, reward:{bp:400,coins:12000}, title:'極致の超越者' },
  { id:'a_jobs', name:'万物の適性', desc:'8つの職業を経験する', cond:s=>s.characters.some(c=>Object.keys(c.jobLevels).length>=8), reward:{coins:4000,bp:100}, title:'万能の才' },
  { id:'a_alljobs', name:'全職制覇', desc:'全職業を経験する', cond:s=>s.characters.some(c=>Object.keys(c.jobLevels).length>=JOBS.length), reward:{coins:20000,bp:500}, title:'職業の覇者' },
  { id:'a_skills40', name:'技の収集家', desc:'技を40種集める', cond:s=>collectedSkills(s).length>=40, reward:{bp:150,items:{book_high:1}}, title:'技博覧' },
  { id:'a_allskills', name:'全技網羅', desc:'全ての技を集める', cond:s=>collectedSkills(s).filter(id=>!ULTIMATE_IDS.has(id)&&SKILL[id]?.source!=='god').length>=LEARNABLE_SKILL_COUNT, reward:{bp:1200,coins:30000}, title:'技の化身' },
  { id:'a_equip', name:'武具愛好家', desc:'装備を30種集める', cond:s=>s.catalog.equipment.length>=30, reward:{coins:2500,items:{mat_ore:5}}, title:'鑑定士' },
  { id:'a_secret', name:'虹の閃き', desc:'シークレット装備を入手', cond:s=>s.inventory.equipment.some(e=>e.rarity==='S'), reward:{bp:300,coins:8000}, title:'虹を掴みし者' },
  { id:'a_boss', name:'塔の征服者', desc:'ボスを3体倒す', cond:s=>s.stats.bossKills>=3, reward:{bp:250,items:{mat_proof:2,boss_core_UR:1}}, title:'征伐者' },
  { id:'a_hidden', name:'虚無を超えし者', desc:'隠しボスを撃破', cond:s=>s.stats.hiddenKills>=1, reward:{bp:600,coins:20000,items:{legend_mat_LR:1}}, title:'虚無の征服者' },
  { id:'a_dungeon', name:'迷宮の底', desc:'ダンジョン20階を踏破', cond:s=>s.dungeon.best>=20, reward:{bp:400,coins:15000}, title:'迷宮の主' },
  { id:'a_rebirth', name:'輪廻転生', desc:'転生を果たす', cond:s=>s.stats.rebirths>=1, reward:{bp:350,items:{mat_rebirth:1}}, title:'転生者' },
  { id:'a_rich', name:'金貨の山', desc:'累計50000コイン獲得', cond:s=>s.stats.coinsEarned>=50000, reward:{coins:10000}, title:'豪商' },
  { id:'a_pull100', name:'ガチャ百連', desc:'ガチャを100回引く', cond:s=>s.stats.pulls>=100, reward:{bp:200,items:{mat_catalyst:3}}, title:'運命の番人' },
  { id:'a_maxdmg', name:'桁違いの一撃', desc:'一撃で2000ダメージ', cond:s=>s.stats.maxDamage>=2000, reward:{bp:200,coins:5000}, title:'破壊の申し子' },
];
export const TITLES = [
  { id:'t_none', name:'なし', desc:'称号なし', bonus:{} },
  { id:'t_rookie', name:'駆け出しの挑戦者', desc:'攻撃+2', bonus:{atk:2} },
  { id:'t_veteran', name:'熟達の戦士', desc:'攻撃+5 防御+5', bonus:{atk:5,def:5} },
  { id:'t_hero', name:'歴戦の英雄', desc:'全能力+8', bonus:{hp:30,mp:10,atk:8,def:8,spd:8,mag:8} },
  { id:'t_wind', name:'無敗の疾風', desc:'防御力+12 回避+3', bonus:{def:12,dodge:3} },
  { id:'t_king', name:'不敗王', desc:'HP+80 攻撃+12', bonus:{hp:80,atk:12} },
  { id:'t_effort', name:'努力の結晶', desc:'EXP獲得+10%', bonus:{expBonus:10} },
  { id:'t_limit', name:'極みの資格者', desc:'全能力+12', bonus:{hp:50,mp:15,atk:12,def:12,spd:12,mag:12} },
  { id:'t_awake', name:'覚醒せし者', desc:'攻撃力+20 MP+20', bonus:{atk:20,mp:20} },
  { id:'t_trans', name:'極致の超越者', desc:'全能力+25', bonus:{hp:120,mp:40,atk:25,def:25,spd:25,mag:25} },
  { id:'t_allround', name:'万能の才', desc:'命中+10 回避+10', bonus:{acc:10,eva:10} },
  { id:'t_master', name:'職業の覇者', desc:'全能力+18', bonus:{hp:80,mp:25,atk:18,def:18,spd:18,mag:18} },
  { id:'t_skill', name:'技博覧', desc:'MP+30 攻撃力+10', bonus:{mp:30,atk:10} },
  { id:'t_allskill', name:'技の化身', desc:'全能力+30', bonus:{hp:150,mp:60,atk:30,def:30,spd:30,mag:30} },
  { id:'t_rainbow', name:'虹を掴みし者', desc:'会心+12%', bonus:{crit:12} },
  { id:'t_conquer', name:'征伐者', desc:'攻撃+15', bonus:{atk:15} },
  { id:'t_void', name:'虚無の征服者', desc:'全能力+35', bonus:{hp:200,mp:80,atk:35,def:35,spd:35,mag:35} },
  { id:'t_labyrinth', name:'迷宮の主', desc:'コイン獲得+20%', bonus:{coinBonus:20} },
  { id:'t_reborn', name:'転生者', desc:'EXP獲得+25%', bonus:{expBonus:25} },
  { id:'t_rich', name:'豪商', desc:'コイン獲得+15%', bonus:{coinBonus:15} },
  { id:'t_fate', name:'運命の番人', desc:'BP獲得+20%', bonus:{bpBonus:20} },
  { id:'t_destroy', name:'破壊の申し子', desc:'攻撃+30', bonus:{atk:30} },
];
export const TITLE = Object.fromEntries(TITLES.map(t => [t.id, t]));
export const EXCHANGE = [
  { id:'ex_awake1', name:'覚醒技・光翼裂斬', kind:'skill', skill:'sk_awaken1', cost:250, desc:'覚醒段階I以上で習得可能' },
  { id:'ex_awake2', name:'覚醒技・時空断絶', kind:'skill', skill:'sk_awaken2', cost:450, desc:'覚醒段階II以上で習得可能' },
  { id:'ex_awake3', name:'覚醒技・終焉の祈り', kind:'skill', skill:'sk_awaken3', cost:700, desc:'覚醒段階III以上で習得可能' },
  { id:'ex_secret', name:'禁忌・ゼロ・リバース', kind:'skill', skill:'sk_secret', cost:1200, desc:'覚醒段階Vで解放' },
  { id:'ex_book', name:'禁断の書', kind:'item', item:'book_secret', count:1, cost:180, desc:'必殺級の技をランダム習得' },
  { id:'ex_stone', name:'覚醒石 ×3', kind:'item', item:'mat_stone', count:3, cost:160, desc:'覚醒素材' },
  { id:'ex_star', name:'星砂 ×3', kind:'item', item:'mat_stardust', count:3, cost:220, desc:'高段階覚醒素材' },
  { id:'ex_rebirth', name:'転生の証', kind:'item', item:'mat_rebirth', count:1, cost:600, desc:'転生に必要' },
  { id:'ex_equip', name:'ミシック装備ランダム', kind:'equip', rarity:'M', cost:500, desc:'ミシック確定の装備' },
  { id:'ex_secret_eq', name:'シークレット装備', kind:'equip', rarity:'S', cost:1500, desc:'シークレット確定の装備' },
  { id:'ex_title', name:'称号「闘技場の星」', kind:'title', title:'t_rainbow', cost:300, desc:'会心+12%の称号' },
  { id:'ex_proof', name:'強敵の証', kind:'item', item:'mat_proof', count:1, cost:120, desc:'特殊職の解放条件' },
  { id:'ex_mat_ssr', name:'魔力結晶・SSR', kind:'item', item:'mana_crystal_SSR', count:1, cost:220, desc:'SSR進化素材' },
  { id:'ex_mat_ur', name:'ボスの核・UR', kind:'item', item:'boss_core_UR', count:1, cost:520, desc:'UR進化素材' },
  { id:'ex_mat_lr', name:'伝説の素材・LR', kind:'item', item:'legend_mat_LR', count:1, cost:1100, desc:'LR最終進化素材' },
  { id:'ex_god_eq', name:'神専用装備（ランダム）', kind:'godEquip', cost:1800, desc:'特殊役職「神」のみ装備可能。解放者だけ交換できる' },
];

/* -----------------------------------------------------------
   施設
   ----------------------------------------------------------- */
export const FACILITIES = [
  { id:'nurture', name:'育成の間', sub:'レベル・職業・技・覚醒', img:'assets/facility_nurture.jpg', icon:'✦', color:'#5ec8ff', tabs:['ステータス','職業','技','覚醒','進化'] },
  { id:'forge', name:'武器・装備工房', sub:'ガチャ・装備・強化・合成', img:'assets/facility_forge.jpg', icon:'⚒', color:'#ffb45e', tabs:['装備','ガチャ','強化','合成','ランク進化'] },
  { id:'training', name:'修行場', sub:'トレーニング・練習・クエスト', img:'assets/facility_training.jpg', icon:'⚔', color:'#8ce6a8', tabs:['トレーニング','技の練習','修行クエスト'] },
  { id:'guild', name:'冒険者ギルド', sub:'CPU対戦・ダンジョン・戦績', img:'assets/facility_guild.jpg', icon:'🏛', color:'#ffd77a', tabs:['CPU対戦','ダンジョン','クエスト','戦績・交換'] },
  { id:'shop', name:'道具屋', sub:'回復・素材・売却', img:'assets/facility_shop.jpg', icon:'🛒', color:'#e7a8ff', tabs:['購入','売却','素材'] },
];

/* ヘルパー（state 依存） */
export function maxLevel(s) { return Math.max(0, ...s.characters.map(c => c.level)); }
export function maxAwakening(s) { return Math.max(0, ...s.characters.map(c => c.awakening)); }
export function collectedSkills(s) {
  const set = new Set();
  s.characters.forEach(c => c.skills.forEach(k => set.add(k.id)));
  return [...set];
}
