// ============ ゲーム状態・育成・装備・報酬ロジック ============
import { JOBS, JOB_MAP } from './data/jobs.js?v=20261105b';
import { SKILLS, SKILL_MAP } from './data/skills.js?v=20261105b';
import { ITEMS, ITEM_MAP, AWAKEN_STAGES, MAX_LEVEL, MAX_JOB_LEVEL, xpNeed, jobXpNeed } from './data/items.js?v=20261105b';
import { RARITIES, RARITY, makeEquip, enhanceCost, MAX_ENHANCE, GACHA_COST, GACHA_COST10, PITY_L, PITY_M, SPECIAL_EQUIPS, equipStat } from './data/equipment.js?v=20261105b';
import { DIFF_MAP, BOSS_MAP } from './data/enemies.js?v=20261105b';
import { ACHIEVEMENTS, ACH_MAP, TITLES, TITLE_MAP, DAILY_QUESTS, POINT_SHOP, CODEX_MILESTONES, RANKS, rankOf } from './data/meta.js?v=20261105b';
import { uid, bus, todayStr, nowStr, clamp } from './util.js?v=20261105b';
import { saveGame } from './save.js?v=20261105b';

export const STAT_KEYS = ['hp','mp','atk','def','spd','mag','acc','eva'];
export const STAT_NAME = {hp:'HP', mp:'MP', atk:'攻撃力', def:'防御力', spd:'速度', mag:'魔力', acc:'命中率', eva:'回避率'};
export const ALLOC_GAIN = {hp:10, mp:5, atk:1.5, def:1.5, spd:1.2, mag:1.5, acc:0.5, eva:0.4};
export const STYLES = [
  {id:'balance', name:'バランス', desc:'全能力+2%。安定した戦い方。'},
  {id:'attack', name:'攻撃型', desc:'攻撃+8%。火力で押し切る。'},
  {id:'defense', name:'防御型', desc:'防御+8% HP+5%。鉄壁の構え。'},
  {id:'speed', name:'速攻型', desc:'速度+8% 回避+3。先手必勝。'},
  {id:'magic', name:'魔力型', desc:'魔力+8% MP+5%。魔法で殲滅。'},
];

export function defaultState(){
  return {
    version: 1,
    coins: 600, points: 0, rp: 0, streak: 0,
    stamina: 50, staminaTs: Date.now(),
    characters: [], activeCharId: null, draft: null,
    inventory: {potion:3, ether:1, stone:2},
    equipment: [],
    pity: {weapon:{l:0,m:0,total:0}, gear:{l:0,m:0,total:0}},
    codex: {jobs:{}, skills:{}, equip:{}, enemies:{}},
    achievements: {}, titles: ['novice'], activeTitle: 'novice',
    quests: {date: todayStr(), counters:{}, claimed:{}},
    dungeons: {}, bosses: {},
    records: [],
    counters: {wins:0,losses:0,battles:0,bestStreak:0,trains:0,skillUses:0,gacha:0,fuses:0,enhances:0,maxEnhance:0,bossKills:0,rebirth:0,mythic:0,secret:0,floors:0},
    rankClaimed: [], codexClaimed: [], pointShopBought: {},
    settings: {bgm:0.5, sfx:0.7, shake:true, dmgNumbers:true, autoBattle:false, speed:1},
    createdAt: Date.now(),
  };
}
export let S = defaultState();
export function setState(s){ S = s; }
export function activeChar(){ return S.characters.find(c=>c.id===S.activeCharId) || S.characters[0] || null; }

let _saveTimer = null;
export function persist(){
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(()=>{ saveGame(S).catch(e=>console.error(e)); }, 400);
  bus.emit('state:changed');
}
export async function persistNow(){ clearTimeout(_saveTimer); await saveGame(S); }

export function record(text, type='normal'){
  S.records.unshift({t:nowStr(), text, type});
  if (S.records.length>250) S.records.length = 250;
}
export function markCodex(kind, id){ if(!S.codex[kind][id]){ S.codex[kind][id] = Date.now(); } }

// ---------- スタミナ ----------
export const STAM_MAX = 50;
export function regenStamina(){
  const now = Date.now();
  const gained = Math.floor((now - S.staminaTs)/120000); // 2分に1
  if (gained>0){ S.stamina = clamp(S.stamina+gained, 0, STAM_MAX); S.staminaTs = now - ((now-S.staminaTs)%120000); }
}

// ---------- キャラクター ----------
export function createCharacter({name, job, style, sprite, source, imageEdit, weaponType, alloc}){
  const j = JOB_MAP[job];
  const ch = {
    id: uid(), name, job, style,
    level:1, xp:0, statPoints:10,
    alloc: alloc || {hp:0,mp:0,atk:0,def:0,spd:0,mag:0,acc:0,eva:0},
    jobData: {[job]:{lv:1,xp:0}},
    skills: [], skillLv:{}, skillXp:{}, slots: [],
    awaken:0, rebirth:0, bossKills:0,
    equip: {weapon:null,armor:null,accessory:null,ornament:null},
    source, sprite, imageEdit: imageEdit||null,
    wins:0, losses:0, createdAt: Date.now(),
    hp:null, mp:null,
  };
  // 初期武器
  const wt = weaponType || j.weapons[0];
  const w = makeEquip('weapon','N',wt);
  S.equipment.push(w); ch.equip.weapon = w.uid; markCodex('equip', w.template);
  // 初期技
  const first = j.learn[0]; if (first) learnSkill(ch, first.id, true);
  learnSkill(ch, 'first_aid', true);
  ch.slots = ch.skills.slice(0,4);
  S.characters.push(ch);
  S.activeCharId = ch.id;
  markCodex('jobs', job);
  record(`${name} が ${j.name} として旅立った！`, 'gold');
  checkAchievements();
  persist();
  return ch;
}

export function titleBonus(){
  const t = TITLE_MAP[S.activeTitle];
  return t ? t.bonus : {};
}
export function charStats(ch){
  const j = JOB_MAP[ch.job];
  const st = {};
  for (const k of STAT_KEYS) st[k] = j.base[k] + j.growth[k]*(ch.level-1);
  for (const k of STAT_KEYS) st[k] += (ch.alloc[k]||0)*ALLOC_GAIN[k];
  // スタイル補正
  const sty = {balance:{all:.02}, attack:{atk:.08}, defense:{def:.08,hp:.05}, speed:{spd:.08}, magic:{mag:.08,mp:.05}}[ch.style]||{};
  // 装備
  const effects = [];
  for (const slot of Object.keys(ch.equip)){
    const eq = S.equipment.find(e=>e.uid===ch.equip[slot]);
    if (!eq) continue;
    for (const k of STAT_KEYS) st[k] += equipStat(eq,k);
    effects.push(...eq.effects);
  }
  const tb = titleBonus();
  const awk = ch.awaken>0 ? AWAKEN_STAGES[ch.awaken-1].bonus : 0;
  const reb = 1 + ch.rebirth*0.05;
  const allMult = (1+awk)*reb*(1+(sty.all||0)+(tb.all||0));
  for (const k of STAT_KEYS){
    let km = allMult + (sty[k]||0) + (tb[k]||0);
    st[k] = st[k]*km;
  }
  if (ch.style==='speed') st.eva += 3; // 速攻型: 回避+3(固定値)
  st.hp = Math.round(st.hp); st.mp = Math.round(st.mp);
  st.atk = Math.round(st.atk); st.def = Math.round(st.def);
  st.spd = Math.round(st.spd); st.mag = Math.round(st.mag);
  st.acc = Math.round(clamp(st.acc, 50, 160)); st.eva = Math.round(clamp(st.eva, 0, 60));
  // パッシブ集計
  const pas = {crit:0, drain:0, elem:0, regen:0, mpSave:0, gauge:0, guard:0, berserk:0, resist:0, first:0};
  for (const e of effects){ pas[e.key] = (pas[e.key]||0) + e.val; }
  pas.crit += tb.crit||0;
  return {stats:st, passives:pas, coinBonus:tb.coin||0, xpBonus:tb.xp||0, pointBonus:tb.point||0};
}
export function charPower(ch){
  const {stats:s} = charStats(ch);
  return Math.round(s.hp*0.3 + s.mp*0.2 + (s.atk+s.mag)*3 + s.def*2.5 + s.spd*2 + s.acc + s.eva*2);
}
export function maxSkillSlots(ch){ return Math.min(8, 4 + (ch.level>=15?1:0) + (ch.level>=30?1:0) + (ch.level>=50?1:0) + (ch.level>=70?1:0)); }

export function addXp(ch, amt){
  amt = Math.round(amt*(1+(titleBonus().xp||0)));
  ch.xp += amt;
  let ups = 0; const learned = [];
  while (ch.level < MAX_LEVEL && ch.xp >= xpNeed(ch.level)){
    ch.xp -= xpNeed(ch.level); ch.level++; ups++; ch.statPoints += 3;
    const j = JOB_MAP[ch.job];
    for (const l of j.learn){ if (l.lv<=ch.level && !ch.skills.includes(l.id)){ learnSkill(ch, l.id, true); learned.push(l.id); } }
    ch.hp = null; ch.mp = null; // 全回復
  }
  if (ch.level>=MAX_LEVEL) ch.xp = Math.min(ch.xp, xpNeed(MAX_LEVEL));
  if (ups>0){
    record(`${ch.name} が Lv${ch.level} に上がった！${learned.length?` 新技${learned.length}種習得！`:''}`, 'gold');
    bus.emit('levelup', {ch, ups, learned});
  }
  return {ups, learned, gained:amt};
}
export function addJobXp(ch, amt){
  const jd = ch.jobData[ch.job] || (ch.jobData[ch.job]={lv:1,xp:0});
  jd.xp += amt;
  let ups = 0; const learned = [];
  const j = JOB_MAP[ch.job];
  while (jd.lv < MAX_JOB_LEVEL && jd.xp >= jobXpNeed(jd.lv)){
    jd.xp -= jobXpNeed(jd.lv); jd.lv++; ups++;
    for (const l of j.jlearn){ if (l.jl<=jd.lv && !ch.skills.includes(l.id)){ learnSkill(ch, l.id, true); learned.push(l.id); } }
  }
  if (ups>0) record(`${ch.name} の ${j.name} 熟練度が Lv${jd.lv} に！`, 'purple');
  return {ups, learned};
}
export function allocate(ch, stat, n=1){
  if (ch.statPoints<n) return false;
  ch.statPoints -= n; ch.alloc[stat] = (ch.alloc[stat]||0)+n;
  persist(); return true;
}
export function learnSkill(ch, id, silent=false){
  if (ch.skills.includes(id)) return false;
  ch.skills.push(id); ch.skillLv[id]=1; ch.skillXp[id]=0;
  markCodex('skills', id);
  if (ch.slots.length < maxSkillSlots(ch)) ch.slots.push(id);
  if (!silent) record(`${ch.name} が「${SKILL_MAP[id].name}」を習得！`, 'purple');
  return true;
}
export function availableSkills(ch){
  const out = [];
  const j = JOB_MAP[ch.job];
  const jl = (ch.jobData[ch.job]||{lv:1}).lv;
  for (const l of j.learn){ if (l.lv<=ch.level && !ch.skills.includes(l.id)) out.push({id:l.id, src:'レベル'}); }
  for (const l of j.jlearn){ if (l.jl<=jl && !ch.skills.includes(l.id)) out.push({id:l.id, src:'熟練度'}); }
  for (const s of SKILLS){
    if (ch.skills.includes(s.id)) continue;
    if (s.req?.lv && ch.level>=s.req.lv && !ch.skills.includes(s.id)) out.push({id:s.id, src:'レベル'});
    if (s.req?.awaken && ch.awaken>=s.req.awaken && !ch.skills.includes(s.id)) out.push({id:s.id, src:'覚醒'});
  }
  return out;
}
export function jobLevel(ch, jobId=ch.job){ return (ch.jobData[jobId]||{lv:0}).lv||0; }
export function maxJobLevel(ch){ return Math.max(0, ...Object.values(ch.jobData).map(j=>j.lv)); }
export function unlockedJobs(ch){
  return JOBS.filter(j=>{
    if (!j.unlock) return true;
    const u = j.unlock;
    const ok = (jobLevel(ch,u.job)>=u.jl) || (u.alt && jobLevel(ch,u.alt.job)>=u.alt.jl);
    return ok && ch.level>=u.level && ch.awaken>=(u.awaken||0);
  });
}
export function changeJob(ch, jobId){
  if (!unlockedJobs(ch).find(j=>j.id===jobId)) return false;
  ch.job = jobId;
  if (!ch.jobData[jobId]) ch.jobData[jobId]={lv:1,xp:0};
  markCodex('jobs', jobId);
  // 新職の習得済みレベル技を付与
  const j = JOB_MAP[jobId];
  for (const l of j.learn){ if (l.lv<=ch.level) learnSkill(ch, l.id, true); }
  const jl = jobLevel(ch, jobId);
  for (const l of j.jlearn){ if (l.jl<=jl) learnSkill(ch, l.id, true); }
  record(`${ch.name} は ${j.name} にジョブチェンジした！`, 'gold');
  persist(); return true;
}
export function awakenReq(ch){
  const next = AWAKEN_STAGES[ch.awaken];
  if (!next) return null;
  return {
    ...next,
    okLevel: ch.level>=next.level,
    okJl: maxJobLevel(ch)>=next.jl,
    okBoss: S.counters.bossKills>=next.bosses,
    okMats: Object.entries(next.mats).every(([id,n])=>(S.inventory[id]||0)>=n),
  };
}
export function doAwaken(ch){
  const r = awakenReq(ch);
  if (!r || !r.okLevel || !r.okJl || !r.okBoss || !r.okMats) return false;
  for (const [id,n] of Object.entries(r.mats)) S.inventory[id]-=n;
  ch.awaken++;
  learnSkill(ch, r.skill, true);
  ch.hp = null; ch.mp = null;
  record(`${ch.name} が ${r.name} に覚醒した！！`, 'gold');
  bus.emit('awaken', {ch, stage:r});
  checkAchievements();
  persist(); return true;
}
export function doRebirth(ch){
  if (ch.level<MAX_LEVEL) return false;
  const refund = Object.values(ch.alloc).reduce((a,b)=>a+b,0);
  ch.rebirth++; ch.level=1; ch.xp=0;
  ch.statPoints = 10 + refund;
  ch.alloc = {hp:0,mp:0,atk:0,def:0,spd:0,mag:0,acc:0,eva:0};
  ch.hp=null; ch.mp=null;
  S.counters.rebirth++;
  addItem('rebirth_proof',1);
  record(`${ch.name} は転生した！(${ch.rebirth}回目) 永久に全能力+5%`, 'gold');
  checkAchievements();
  persist(); return true;
}

// ---------- アイテム ----------
export function addItem(id, n=1){ S.inventory[id]=(S.inventory[id]||0)+n; if(S.inventory[id]<=0) delete S.inventory[id]; }
export function buyItem(id, n=1){
  const it = ITEM_MAP[id]; if(!it||!it.buy) return false;
  const cost = it.buy*n;
  if (S.coins<cost) return false;
  S.coins-=cost; addItem(id,n); persist(); return true;
}
export function sellItem(id, n=1){
  const it = ITEM_MAP[id]; if(!it||(S.inventory[id]||0)<n) return false;
  S.coins += it.sell*n; addItem(id,-n); persist(); return true;
}
export function sellEquip(uidv){
  const i = S.equipment.findIndex(e=>e.uid===uidv); if(i<0) return false;
  const eq = S.equipment[i];
  for (const c of S.characters){ for(const s in c.equip) if(c.equip[s]===uidv) c.equip[s]=null; }
  S.coins += RARITY[eq.rarity].sell + eq.lv*40;
  S.equipment.splice(i,1); persist(); return true;
}
export function useItem(ch, id){
  const it = ITEM_MAP[id]; if(!it||(S.inventory[id]||0)<1) return {ok:false};
  if (it.kind==='book'){
    if (ch.skills.includes(it.skill)) return {ok:false, msg:'すでに習得済みです'};
    addItem(id,-1); learnSkill(ch, it.skill); persist();
    return {ok:true, msg:`「${SKILL_MAP[it.skill].name}」を習得した！`};
  }
  if (it.kind!=='consume') return {ok:false};
  const e = it.effect;
  if (e.stamina){ regenStamina(); S.stamina=clamp(S.stamina+e.stamina,0,STAM_MAX); }
  else {
    const {stats} = charStats(ch);
    const hp = ch.hp==null?stats.hp:ch.hp, mp = ch.mp==null?stats.mp:ch.mp;
    if (e.healPct) ch.hp = clamp(hp + stats.hp*e.healPct/100, 0, stats.hp);
    if (e.mpPct) ch.mp = clamp(mp + stats.mp*e.mpPct/100, 0, stats.mp);
    if (e.cure){ /* 状態異常は戦闘内のみ */ }
  }
  addItem(id,-1); persist();
  return {ok:true, msg:`${it.name}を使った`};
}

// ---------- 装備 ----------
export function equipItem(ch, uidv){
  const eq = S.equipment.find(e=>e.uid===uidv); if(!eq) return false;
  if (eq.slot==='weapon' && !JOB_MAP[ch.job].weapons.includes(eq.type)) return false;
  // 同じ装備を他キャラが使用中なら外す
  for (const c of S.characters){ if(c!==ch) for(const s in c.equip) if(c.equip[s]===uidv) c.equip[s]=null; }
  ch.equip[eq.slot]=uidv; persist(); return true;
}
export function unequipSlot(ch, slot){ ch.equip[slot]=null; persist(); }
export function getEquip(uidv){ return S.equipment.find(e=>e.uid===uidv); }

export function rollGachaRarity(pity){
  pity.l++; pity.m++; pity.total++;
  let r;
  if (pity.m>=PITY_M){ r = Math.random()<0.15?'S':'M'; }
  else if (pity.l>=PITY_L){ r = Math.random()<0.12?'M':'L'; }
  else {
    const roll = Math.random()*100; let acc=0;
    for (const rr of RARITIES){ acc+=RARITY[rr].weight; if(roll<acc){ r=rr; break; } }
    r = r||'N';
  }
  if (RARITIES.indexOf(r)>=3) pity.l=0;
  if (RARITIES.indexOf(r)>=4) pity.m=0;
  return r;
}
export function doGacha(kind, count){
  const cost = count===10?GACHA_COST10:GACHA_COST*count;
  if (S.coins<cost) return null;
  S.coins-=cost;
  const pity = S.pity[kind];
  const results = [];
  for (let i=0;i<count;i++){
    let r = rollGachaRarity(pity);
    if (count===10 && i===9 && results.every(e=>RARITIES.indexOf(e.rarity)<2)) r='E'; // 10連E以上保証
    const slot = kind==='weapon'?'weapon':(['armor','accessory','ornament'][Math.floor(Math.random()*3)]);
    const type = slot==='weapon'?Object.keys({sword:1,axe:1,spear:1,bow:1,gun:1,staff:1,special:1})[Math.floor(Math.random()*7)]:null;
    const eq = makeEquip(slot, r, type);
    S.equipment.push(eq); results.push(eq);
    markCodex('equip', eq.template);
    if (r==='M') S.counters.mythic++;
    if (r==='S') S.counters.secret++;
    if (RARITIES.indexOf(r)>=3) record(`ガチャで ${eq.name}(${RARITY[r].name}) を入手！`, 'gold');
  }
  S.counters.gacha += count;
  trackDaily('gacha', count);
  checkAchievements();
  persist();
  return results;
}
export function enhanceEquip(uidv){
  const eq = getEquip(uidv); if(!eq||eq.lv>=MAX_ENHANCE) return {ok:false};
  const c = enhanceCost(eq.lv);
  if (S.coins<c.coins || (c.stone&&(S.inventory.stone||0)<c.stone) || (c.hiStone&&(S.inventory.hi_stone||0)<c.hiStone)) return {ok:false, msg:'素材かコインが足りません'};
  S.coins-=c.coins;
  if(c.stone) addItem('stone',-c.stone);
  if(c.hiStone) addItem('hi_stone',-c.hiStone);
  eq.lv++;
  S.counters.enhances++; S.counters.maxEnhance=Math.max(S.counters.maxEnhance, eq.lv);
  if (eq.lv>=10) record(`${eq.name} が +${eq.lv} に強化された！`, 'gold');
  checkAchievements(); persist();
  return {ok:true, eq};
}
export function fuseEquips(uids){
  const eqs = uids.map(getEquip).filter(Boolean);
  if (eqs.length!==3) return {ok:false, msg:'3つ選択してください'};
  const slot = eqs[0].slot, rar = eqs[0].rarity;
  if (!eqs.every(e=>e.slot===slot&&e.rarity===rar)) return {ok:false, msg:'同じ部位・同じレアリティを3つ選んでください'};
  if (rar==='S') return {ok:false, msg:'シークレットはこれ以上合成できません'};
  const next = RARITIES[RARITIES.indexOf(rar)+1];
  for (const c of S.characters){ for(const s in c.equip) if(uids.includes(c.equip[s])) c.equip[s]=null; }
  S.equipment = S.equipment.filter(e=>!uids.includes(e.uid));
  const type = slot==='weapon'?eqs[0].type:null;
  const eq = makeEquip(slot, next, type);
  S.equipment.push(eq); markCodex('equip', eq.template);
  S.counters.fuses++;
  if (next==='M') S.counters.mythic++;
  if (next==='S') S.counters.secret++;
  record(`合成で ${eq.name}(${RARITY[next].name}) が誕生！`, 'gold');
  checkAchievements(); persist();
  return {ok:true, eq};
}

// ---------- 戦闘報酬 ----------
export function battleRewards(ch, enemy, win, opts={}){
  const d = DIFF_MAP[enemy.diff]||DIFF_MAP.normal;
  const lv = enemy.level;
  const {passives, coinBonus, xpBonus, pointBonus} = charStats(ch);
  let coins = Math.round((60 + lv*14) * d.reward * (win?1:0.25) * (1+coinBonus));
  let xp = Math.round((40 + lv*16) * d.reward * (win?1:0.35) * (1+xpBonus));
  let points = Math.round((8 + lv*0.5) * d.reward * (win?1:0.3) * (1+pointBonus));
  let rp = win ? Math.round(18*d.reward) : -Math.round(8*d.reward);
  let jobXp = Math.round((20 + lv*2.5) * (win?1:0.4));
  let streakBonus = 0;
  if (win){
    S.streak++;
    S.counters.wins++; ch.wins++;
    S.counters.bestStreak = Math.max(S.counters.bestStreak, S.streak);
    streakBonus = Math.min(100, (S.streak-1)*10);
    coins = Math.round(coins*(1+streakBonus/100));
    xp = Math.round(xp*(1+streakBonus/200));
    if (enemy.isBoss){ S.counters.bossKills++; ch.bossKills++; }
  } else {
    S.streak=0; S.counters.losses++; ch.losses++;
    rp = Math.max(-40, rp); // 大きくは下がらない
  }
  S.counters.battles++;
  S.coins += coins; S.points += points; S.rp = Math.max(0, S.rp+rp);
  trackDaily('battles',1); if(win) trackDaily('wins',1);
  const lvres = addXp(ch, xp);
  const jres = addJobXp(ch, jobXp);
  // 素材ドロップ
  const drops = [];
  if (win){
    const roll = Math.random();
    if (enemy.isBoss && opts.bossId && BOSS_MAP[opts.bossId]){
      const b = BOSS_MAP[opts.bossId];
      if (!S.bosses[opts.bossId]){
        S.bosses[opts.bossId]=1;
        // ボス技習得
        const bs = SKILLS.find(s=>s.req?.boss===opts.bossId);
        if (bs) learnSkill(ch, bs.id);
        coins += b.reward.coins; S.coins += b.reward.coins;
        points += b.reward.points; S.points += b.reward.points;
        for (const [m,n] of Object.entries(b.reward.mats||{})){ addItem(m,n); drops.push(`${ITEM_MAP[m]?.name||m}×${n}`); }
        record(`${b.name} を撃破！初回討伐報酬を獲得！`, 'gold');
      } else {
        S.bosses[opts.bossId]++;
        const bonusC = Math.round(b.reward.coins*0.3); coins+=bonusC; S.coins+=bonusC;
        if (Math.random()<0.5){ const m=Object.keys(b.reward.mats||{})[0]; if(m){addItem(m,1); drops.push(`${ITEM_MAP[m]?.name||m}×1`);} }
      }
    } else {
      if (roll<0.10){ addItem('stone',1); drops.push('強化石×1'); }
      else if (roll<0.16){ addItem('potion',1); drops.push('回復ポーション×1'); }
      if (lv>=40 && Math.random()<0.06){ addItem('hi_stone',1); drops.push('上級強化石×1'); }
      if (lv>=60 && Math.random()<0.04){ addItem('awk_orb',1); drops.push('覚醒の宝玉×1'); }
    }
  }
  markCodex('enemies', enemy.name);
  checkAchievements();
  persist();
  return {coins, xp:lvres.gained, points, rp, jobXp, streakBonus, drops, levels:lvres.ups, learned:lvres.learned, jobUps:jres.ups, win};
}

// ---------- 修行 ----------
export function train(ch, stat){
  regenStamina();
  const cost = 10, coin = 80 + ch.level*8;
  if (S.stamina<cost || S.coins<coin) return {ok:false, msg:'スタミナかコインが足りません'};
  S.stamina-=cost; S.coins-=coin;
  ch.alloc[stat]=(ch.alloc[stat]||0)+1;
  const xp = 30 + ch.level*13, jxp = 14 + ch.level*2;
  const r = addXp(ch, xp); addJobXp(ch, jxp);
  S.counters.trains++; trackDaily('trains',1);
  checkAchievements(); persist();
  return {ok:true, xp:r.gained, jxp, stat, coin};
}
export function skillXpNeed(lv){ return Math.round(50*Math.pow(lv,1.35)); }
export function practiceSkill(ch, skillId){
  regenStamina();
  if (!ch.skills.includes(skillId)) return {ok:false};
  const lv = ch.skillLv[skillId]||1;
  if (lv>=10) return {ok:false, msg:'この技は最大レベルです'};
  if (S.stamina<8) return {ok:false, msg:'スタミナが足りません'};
  S.stamina-=8;
  ch.skillXp[skillId]=(ch.skillXp[skillId]||0)+25;
  let ups=0;
  while ((ch.skillLv[skillId]||1)<10 && ch.skillXp[skillId]>=skillXpNeed(ch.skillLv[skillId])){
    ch.skillXp[skillId]-=skillXpNeed(ch.skillLv[skillId]); ch.skillLv[skillId]++; ups++;
  }
  addJobXp(ch, 8);
  persist();
  return {ok:true, ups, lv:ch.skillLv[skillId]};
}

// ---------- クエスト・実績・図鑑 ----------
export function trackDaily(counter, n=1){
  const t = todayStr();
  if (S.quests.date!==t) S.quests={date:t, counters:{}, claimed:{}};
  S.quests.counters[counter]=(S.quests.counters[counter]||0)+n;
}
export function claimQuest(id){
  const q = DAILY_QUESTS.find(x=>x.id===id); if(!q) return false;
  if (S.quests.claimed[id] || (S.quests.counters[q.counter]||0)<q.need) return false;
  S.quests.claimed[id]=true;
  grantReward(q.reward);
  record(`クエスト「${q.name}」達成！`, 'gold');
  persist(); return true;
}
export function grantReward(r){
  if (r.coins) S.coins+=r.coins;
  if (r.points) S.points+=r.points;
  for (const [m,n] of Object.entries(r.mats||{})) addItem(m,n);
  if (r.title && !S.titles.includes(r.title)) S.titles.push(r.title);
}
export function checkAchievements(){
  for (const a of ACHIEVEMENTS){
    if (!S.achievements[a.id] && a.check(S)){
      S.achievements[a.id]=Date.now();
      grantReward(a.reward);
      if (a.title && !S.titles.includes(a.title)) S.titles.push(a.title);
      record(`実績「${a.name}」達成！`, 'gold');
      bus.emit('achievement', a);
    }
  }
}
export function claimRankRewards(){
  let got = [];
  for (const r of RANKS){
    if (S.rp>=r.rp && !S.rankClaimed.includes(r.id) && r.rp>0){
      S.rankClaimed.push(r.id); grantReward(r.reward); got.push(r);
    }
  }
  if (got.length){ record(`ランク報酬を受け取った！`, 'gold'); persist(); }
  return got;
}
export function claimCodexMilestone(id){
  const m = CODEX_MILESTONES.find(x=>x.id===id); if(!m||S.codexClaimed.includes(id)) return false;
  const count = Object.keys(S.codex[m.kind]).length;
  if (count<m.need) return false;
  S.codexClaimed.push(id); grantReward(m.reward);
  record(`図鑑コレクション報酬を獲得！`, 'gold');
  persist(); return true;
}
export function buyPointShop(id){
  const p = POINT_SHOP.find(x=>x.id===id); if(!p) return {ok:false};
  if ((p.kind==='skill'||p.kind==='title') && S.pointShopBought[id]) return {ok:false, msg:'交換済みです'};
  if (S.points<p.cost) return {ok:false, msg:'対戦ポイントが足りません'};
  const ch = activeChar();
  if (p.kind==='skill'){
    if (!ch) return {ok:false, msg:'キャラクターが必要です'};
    if (ch.skills.includes(p.skill)) return {ok:false, msg:'すでに習得済みです'};
    S.points-=p.cost; S.pointShopBought[id]=1; learnSkill(ch, p.skill);
  } else if (p.kind==='item'){
    S.points-=p.cost; addItem(p.item,1);
  } else if (p.kind==='title'){
    S.points-=p.cost; S.pointShopBought[id]=1;
    if(!S.titles.includes(p.title)) S.titles.push(p.title);
  } else if (p.kind==='equip'){
    const sp = SPECIAL_EQUIPS.find(e=>e.id===id);
    S.points-=p.cost;
    const eq = makeEquip(sp.slot, sp.rarity, sp.type, {special:true});
    eq.name = sp.name; eq.template = 'special:'+sp.id;
    S.equipment.push(eq); markCodex('equip', eq.template); S.counters.secret++;
  }
  record('交換所で報酬を獲得した！', 'gold');
  checkAchievements(); persist();
  return {ok:true};
}

// ---------- 戦闘ユニット構築 ----------
export function buildPlayerUnit(ch){
  const {stats, passives} = charStats(ch);
  const skills = (ch.slots.length?ch.slots:ch.skills.slice(0,4)).filter(id=>SKILL_MAP[id]);
  return {
    name: ch.name, job: ch.job, level: ch.level,
    stats: {...stats}, hp: ch.hp==null?stats.hp:Math.min(ch.hp,stats.hp), mp: ch.mp==null?stats.mp:Math.min(ch.mp,stats.mp),
    skills, skillLv: {...ch.skillLv}, isPlayer:true, sprite: ch.sprite,
    passives, style: ch.style, awaken: ch.awaken, gauge: passives.first||0,
  };
}
export function syncCharVitals(ch, unit){
  ch.hp = unit.hp<=0 ? null : unit.hp; // 倒れたら全回復扱い(次回満タン)
  ch.mp = unit.mp;
}
