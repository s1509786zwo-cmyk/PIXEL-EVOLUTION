/* ===========================================================
   武器ガチャ：ピックアップ定義・提供割合・期間ローテーション
   - レアリティ排出確率（44.5/30/16/7/2/0.5）は一切変更しない
   - ピックアップ率は各レアリティの「内訳」として分離管理する
   - シークレットの正体は UI に渡さない（hiddenSummary 経由）
   =========================================================== */
import { RARITIES, RARITY, EQUIPMENT, EFFECTS, toCoreStats } from './data.js?v=2';

const DAY = 86400000;
export const PICKUP_PERIOD_DAYS = 7;
/** 各レアリティの排出率のうち、ピックアップ枠に割り当てる割合 */
export const PICKUP_SHARE = 0.5;

export const GACHA_BANNERS = [
  {
    id:'b_astral', name:'暁光の聖剣 ピックアップ', short:'暁光の聖剣',
    subtitle:'夜明けの光を纏う聖剣が、今だけ出現率アップ',
    tagline:'光が戦場を切り裂く。攻めの一手を、あなたの手に。',
    accent:'#ffd77a', accent2:'#c79bff',
    featured:['eq_weapon_剣_L','eq_weapon_杖_E','eq_weapon_弓_R'],
    hidden:['eq_weapon_剣_S'],
  },
  {
    id:'b_thunder', name:'雷鳴の連銃 ピックアップ', short:'星撃ちの連銃',
    subtitle:'雷と星を撃ち出す連銃と、影の刃が同時に強化',
    tagline:'引き金を引く間もなく、勝負は決まっている。',
    accent:'#65d9ff', accent2:'#ff8fa8',
    featured:['eq_weapon_銃_L','eq_weapon_短剣_E','eq_weapon_拳_R'],
    hidden:['eq_weapon_銃_S'],
  },
  {
    id:'b_star', name:'星槍グングニル ピックアップ', short:'星槍グングニル',
    subtitle:'ミシック級の星槍がピックアップ対象に',
    tagline:'星の軌道を槍先に宿し、一点を貫く。',
    accent:'#b98bff', accent2:'#68f7d4',
    featured:['eq_weapon_槍_M','eq_weapon_斧_E','eq_weapon_特殊_R'],
    hidden:['eq_weapon_槍_S'],
  },
  {
    id:'b_orbis', name:'天球杖オルビス ピックアップ', short:'天球杖オルビス',
    subtitle:'天体を巡らせる杖と、ルーンの刃を同時公開',
    tagline:'魔力が天球を描き、敵を包み込む。',
    accent:'#8ce6a8', accent2:'#ffd77a',
    featured:['eq_weapon_杖_M','eq_weapon_剣_E','eq_weapon_銃_R'],
    hidden:['eq_weapon_杖_S'],
  },
];

const WEAPONS = EQUIPMENT.filter(x => x.slot === 'weapon');
const byId = Object.fromEntries(WEAPONS.map(x => [x.id, x]));

/** 現在の日付から自動的にバナーを切り替える（期間終了で次のピックアップへ） */
export function currentBanner(now = Date.now()) {
  const day = Math.floor(now / DAY);
  const idx = Math.floor(day / PICKUP_PERIOD_DAYS) % GACHA_BANNERS.length;
  const startDay = day - (day % PICKUP_PERIOD_DAYS);
  const endDay = startDay + PICKUP_PERIOD_DAYS - 1;
  const label = d => new Date(d * DAY).toISOString().slice(0, 10).replace(/-/g, '/');
  return {
    banner:GACHA_BANNERS[idx], index:idx,
    startDay, endDay, startLabel:label(startDay), endLabel:label(endDay),
    remainingDays:endDay - day + 1, nextAt:(endDay + 1) * DAY,
  };
}

export function featuredDefs(banner) {
  return (banner?.featured || []).map(id => byId[id]).filter(Boolean);
}
/** シークレットの正体は UI に出さない。存在・個数・確率だけを返す */
export function hiddenSummary(banner) {
  const ids = banner?.hidden || [];
  const r = ids.map(id => byId[id]?.rarity).filter(Boolean)[0] || 'S';
  const rate = (RARITY[r]?.rate || 0.5) * PICKUP_SHARE;
  return { count:ids.length, rarity:r, rarityName:RARITY[r]?.name || 'シークレット', rate };
}
export function hiddenDefIds(banner) { return (banner?.hidden || []).filter(id => byId[id]); }

/** レアリティ別の提供割合。total の合計は常に 100% */
export function bannerRates(banner) {
  const all = [...(banner?.featured || []), ...(banner?.hidden || [])];
  return RARITIES.map(r => {
    const has = all.some(id => byId[id]?.rarity === r.id);
    const pickup = has ? Math.round(r.rate * PICKUP_SHARE * 1000) / 1000 : 0;
    const normal = Math.round((r.rate - pickup) * 1000) / 1000;
    return { ...r, total:r.rate, pickup, normal, hasPickup:has };
  });
}
export function rateTotals(banner) {
  const rows = bannerRates(banner);
  const r2 = a => Math.round(a * 100) / 100;
  const total = r2(rows.reduce((a,r)=>a+r.total,0));
  const pickup = r2(rows.reduce((a,r)=>a+r.pickup,0));
  return { total, pickup, normal:r2(total - pickup) };
}
/** そのレアリティのピックアップ枠（シークレット含む / 抽選用） */
export function pickupDefIds(banner, rarity) {
  return [...(banner?.featured || []), ...(banner?.hidden || [])]
    .filter(id => byId[id]?.rarity === rarity);
}
/** そのレアリティの通常枠（ピックアップ対象を除く） */
export function normalDefIds(rarity, exclude = []) {
  return WEAPONS.filter(x => x.rarity === rarity && !exclude.includes(x.id)).map(x => x.id);
}
export function allDefIds(rarity) {
  return WEAPONS.filter(x => x.rarity === rarity).map(x => x.id);
}
export function isPickup(banner, defId) {
  return [...(banner?.featured || []), ...(banner?.hidden || [])].includes(defId);
}
export function isHidden(banner, defId) { return (banner?.hidden || []).includes(defId); }
export function weaponDef(defId) { return byId[defId] || null; }

export const EFFECT_LABELS = {
  crit:'会心率', lifesteal:'吸血', mpRegen:'MP自動回復', hpRegen:'HP自動回復',
  counter:'反撃', firstStrike:'先制', ignoreDef:'防御貫通', damageCut:'被ダメ軽減',
  extraStrike:'追撃', statusGuard:'状態耐性', expBonus:'獲得EXP', coinBonus:'獲得コイン',
  bpBonus:'獲得BP',
};
export const USAGE_BY_TYPE = {
  '剣':'間合いを詰め、安定した連撃で押し切る近接戦向き。防御崩しから必殺技へ繋ぐのが基本。',
  '銃':'距離を保ちながら手数で削る遠距離戦向き。会心と追撃を重ねると一気に火力が伸びる。',
  '杖':'属性魔法で弱点を突く魔力型。MP回復系の効果と組わせて長期戦を制する。',
  '斧':'一撃の重みで敵を薙ぐパワー型。防御の高い相手に貫通効果が刺さる。',
  '槍':'リーチを活かした中距離型。攻撃力と会心系の特殊効果で主導権を握る。',
  '弓':'遠距離狙撃型。追加攻撃や属性攻撃の特殊効果で確実にダメージを通す。',
  '拳':'連撃と会心で畳みかける格闘型。追撃が乗ると手数が倍増する。',
  '短剣':'状態異常と会心で撹乱するトリッキー型。素早さを活かして弱点を突く。',
  '特殊':'錬成・方陣・因果を操る変則型。味方の補助と特殊効果の底上げが得意。',
};
export function weaponSummary(defId) {
  const d = byId[defId];
  if (!d) return null;
  const st = d.stats || {};
  const core = toCoreStats(st);   // 4 基本ステータスへ換算
  return {
    id:d.id, name:d.name, rarity:d.rarity, type:d.type, slot:d.slot,
    color:d.color, desc:d.desc,
    atk:Math.round(core.atk), def:Math.round(core.def),
    hp:Math.round(core.hp), mp:Math.round(core.mp),
    effects:(st.effects || []).map(x => ({
      id:x.id, label:EFFECTS[x.id]?.name || EFFECT_LABELS[x.id] || x.id,
      desc:EFFECTS[x.id]?.desc || '', value:x.value,
    })),
    usage:USAGE_BY_TYPE[d.type] || '様々な戦況で扱える万能型。',
  };
}
