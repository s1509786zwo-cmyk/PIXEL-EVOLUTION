// ============ 戦闘エンジン(DOM非依存) ============
import { SKILL_MAP, ELEM_CHART, ELEMENTS } from './data/skills.js?v=20261105c';
import { DIFF_MAP } from './data/enemies.js?v=20261105c';
import { clamp } from './util.js?v=20261105c';

const JOB_ELEM = {fighter:'none',swordsman:'wind',knight:'light',mage:'fire',priest:'light',thief:'dark',
  archer:'wind',monk:'none',gunner:'bolt',summoner:'dark',alchemist:'none',ninja:'dark',berserker:'fire',
  paladin:'light',sage:'none',ranger:'wind',swordmaster:'light',archmage:'fire',assassin:'dark',dragoon:'fire',
  spellblade:'fire',divine:'light',destroyer:'dark',chronomancer:'dark'};
const STATUS_NAME = {poison:'毒',burn:'火傷',stun:'気絶',sleep:'睡眠',blind:'暗闇',silence:'沈黙',freeze:'凍結',regen:'再生',shield:'バリア',counter:'反撃',guard:'守護',dodge:'残影',focus:'心眼'};
const STAT_NAME = {atk:'攻撃',def:'防御',spd:'速度',mag:'魔力',acc:'命中',eva:'回避'};

function makeUnit(spec, isPlayer){
  return {
    name: spec.name, job: spec.job, level: spec.level, elem: JOB_ELEM[spec.job]||'none',
    stats: {...spec.stats}, maxHp: spec.stats.hp, maxMp: spec.stats.mp,
    hp: spec.hp!=null?spec.hp:spec.stats.hp, mp: spec.mp!=null?spec.mp:spec.stats.mp,
    gauge: spec.gauge||0, skills: spec.skills||[], skillLv: spec.skillLv||{},
    cds:{}, effects:[], isPlayer, sprite: spec.sprite||null, seed: spec.seed||spec.name,
    passives: spec.passives||{}, style: spec.style||'balance', awaken: spec.awaken||0,
    isBoss: !!spec.isBoss, diff: spec.diff||'normal',
  };
}

export class Battle {
  constructor(playerSpec, enemySpec, opts={}){
    this.units = [makeUnit(playerSpec,true), makeUnit(enemySpec,false)];
    this.rng = opts.rng || Math.random;
    this.bag = {...(opts.bag||{})};
    this.allowFlee = opts.allowFlee!==false && !enemySpec.isBoss;
    this.over = false; this.win = null; this.fled = false;
    this.round = 0; this.queue = []; this.turnCount = 0;
    this.aiLevel = (DIFF_MAP[enemySpec.diff]||{}).ai || 'normal';
    this.events = [];
  }
  emit(e){ this.events.push(e); return e; }
  drain(){ const e=this.events; this.events=[]; return e; }
  log(text){ this.emit({t:'log', text}); }

  start(){
    this.log(`⚔️ ${this.units[0].name} vs ${this.units[1].name} — 戦闘開始！`);
    for (const u of this.units){ if (u.passives.first) u.gauge = clamp(u.gauge+u.passives.first,0,100); }
    this.newRound();
    return this.drain();
  }
  newRound(){
    this.round++;
    const [a,b] = this.units;
    const sa = this.eff(a,'spd'), sb = this.eff(b,'spd');
    this.queue = sa===sb ? (this.rng()<.5?[0,1]:[1,0]) : (sa>sb?[0,1]:[1,0]);
    this.emit({t:'round', round:this.round});
    this.beginTurn();
  }
  beginTurn(){
    if (this.over) return;
    if (!this.queue.length){ this.newRound(); return; }
    const idx = this.queue[0];
    const u = this.units[idx];
    // クールダウン減算
    for (const k in u.cds) if(u.cds[k]>0) u.cds[k]--;
    u.gauge = clamp(u.gauge + 6*(1+(u.passives.gauge||0)/100), 0, 100);
    this.turnCount++;
    // 行動不能チェック
    const skip = u.effects.find(e=>['stun','sleep','freeze'].includes(e.s));
    if (skip){
      this.emit({t:'turn', unit:idx, round:this.round});
      this.log(`${u.name} は${STATUS_NAME[skip.s]}で動けない！`);
      this.emit({t:'skip', unit:idx, reason:skip.s});
      this.endTurn(idx);
      return;
    }
    this.emit({t:'turn', unit:idx, round:this.round});
  }
  current(){ return this.over?null:this.units[this.queue[0]]; }
  currentIndex(){ return this.queue[0]; }

  eff(u, stat){
    let v = u.stats[stat];
    let mult = 1, add = 0;
    for (const e of u.effects){
      if (e.kind==='stat' && e.s===stat){ if(stat==='acc'||stat==='eva') add+=e.pct; else mult+=e.pct/100; }
    }
    if (stat==='atk' && u.passives.berserk && u.hp<u.maxHp*0.3) mult += u.passives.berserk/100;
    if (stat==='eva' && this.has(u,'dodge')) add += 40;
    if (stat==='acc' && this.has(u,'blind')) add -= 30;
    return Math.max(1, v*mult+add);
  }
  has(u, s){ return u.effects.some(e=>e.s===s); }
  addEffect(u, eff){
    const ex = u.effects.find(e=>e.s===eff.s && e.kind===eff.kind);
    if (ex){ ex.dur = Math.max(ex.dur, eff.dur); ex.pct = eff.pct??ex.pct; ex.val = eff.val??ex.val; }
    else u.effects.push({...eff});
  }

  usableSkills(u){
    return u.skills.map(id=>SKILL_MAP[id]).filter(Boolean).filter(s=>{
      if ((u.cds[s.id]||0)>0) return false;
      const cost = this.mpCost(u,s);
      if (u.mp < cost) return false;
      if (s.gauge && u.gauge < s.gauge) return false;
      if (this.has(u,'silence') && ['magic','summon','heal'].includes(s.cat)) return false;
      return true;
    });
  }
  mpCost(u,s){ return Math.max(0, Math.round(s.mp*(1-(u.passives.mpSave||0)/100))); }

  submit(action){
    if (this.over) return this.drain();
    const idx = this.queue[0];
    const u = this.units[idx], foe = this.units[1-idx];
    if (action.type==='attack'){
      this.doAttack(u, foe, idx);
    } else if (action.type==='skill'){
      const s = SKILL_MAP[action.id];
      if (!s || !this.usableSkills(u).find(x=>x.id===s.id)){ this.log('その技は今は使えない！'); return this.drain(); }
      this.doSkill(u, foe, idx, s);
    } else if (action.type==='defend'){
      this.addEffect(u,{kind:'status',s:'guard',dur:2});
      u.gauge = clamp(u.gauge+10,0,100);
      this.emit({t:'defend', unit:idx});
      this.log(`${u.name} は身を守っている。`);
    } else if (action.type==='item'){
      this.useItem(u, idx, action.id);
    } else if (action.type==='flee'){
      if (!this.allowFlee){ this.log('この戦闘からは逃げられない！'); return this.drain(); }
      if (this.rng()<0.6){ this.fled=true; this.over=true; this.emit({t:'end', win:null, fled:true}); this.log('うまく逃げ切った！'); return this.drain(); }
      this.log('逃げられなかった！');
    }
    if (!this.over) this.endTurn(idx);
    return this.drain();
  }
  useItem(u, idx, id){
    if ((this.bag[id]||0)<1){ this.log('アイテムがない！'); return; }
    this.bag[id]--;
    let msg='';
    if (id==='potion'||id==='hi_potion'||id==='elixir'){
      const pctv = id==='potion'?35:id==='hi_potion'?70:100;
      const h = Math.round(u.maxHp*pctv/100); u.hp=clamp(u.hp+h,0,u.maxHp);
      this.emit({t:'heal', unit:idx, amount:h, fx:'heal'}); msg=`HPが${h}回復`;
    }
    if (id==='ether'||id==='hi_ether'||id==='elixir'){
      const pctv = id==='ether'?40:id==='hi_ether'?80:100;
      const m = Math.round(u.maxMp*pctv/100); u.mp=clamp(u.mp+m,0,u.maxMp); msg+=` MPが${m}回復`;
    }
    if (id==='antidote'||id==='elixir'){
      u.effects = u.effects.filter(e=>!['poison','burn','stun','sleep','blind','silence','freeze'].includes(e.s));
      msg+=' 状態異常治癒';
    }
    this.emit({t:'item', unit:idx, id});
    this.log(`${u.name} はアイテムを使った！${msg}`);
  }

  doAttack(u, foe, idx){
    const fake = {id:'_attack', name:'通常攻撃', cat:'phys', elem:'none', power:100, mp:0, cd:0, hits:1, fx: u.job==='monk'?'punch':'slash'};
    this.doSkill(u, foe, idx, fake, true);
  }
  doSkill(u, foe, idx, s, isBasic=false){
    const cost = this.mpCost(u,s);
    u.mp = clamp(u.mp-cost, 0, u.maxMp);
    if (s.gauge) u.gauge = clamp(u.gauge-s.gauge,0,100);
    if (s.cd) u.cds[s.id] = s.cd+1;
    if (s.gaugeGain) u.gauge = clamp(u.gauge+s.gaugeGain,0,100);
    const lv = u.skillLv[s.id]||1;
    const power = s.power*(1+0.04*(lv-1));
    const ev = {t:'action', unit:idx, skill:{id:s.id,name:s.name,cat:s.cat,elem:s.elem,fx:s.fx||'slash',hits:s.hits||1}, hits:[], heal:0, applied:[], selfEffects:[]};

    // 回復
    if (s.cat==='heal'){
      let h = s.healPct ? Math.round(u.maxHp*s.healPct/100) : Math.round(this.eff(u,'mag')*power/100 + u.level*2);
      u.hp = clamp(u.hp+h,0,u.maxHp); ev.heal=h;
      if (s.cure) u.effects = u.effects.filter(e=>!['poison','burn','stun','sleep','blind','silence','freeze'].includes(e.s));
      this.log(`${u.name} の「${s.name}」！ HPが${h}回復した！`);
    }
    // 自バフ
    if (s.b){ for (const [st,p,d] of s.b){ this.addEffect(u,{kind:'stat',s:st,pct:p,dur:d+1}); ev.selfEffects.push(`${STAT_NAME[st]}${p>0?'+':''}${p}%`); } }
    if (s.sb){ this.applyStatus(u,u,s.sb[0],s.sb[1],100,ev.selfEffects); }
    if (s.sb2){ this.applyStatus(u,u,s.sb2[0],s.sb2[1],100,ev.selfEffects); }
    // 攻撃系
    if (['phys','magic','summon','ultimate'].includes(s.cat) && s.power>0){
      const basedOn = (s.cat==='magic'||s.cat==='summon') ? 'mag' : (s.usesMag?'mag':'atk');
      let atk = this.eff(u, basedOn);
      let def = this.eff(foe,'def') * (basedOn==='mag'?0.55:1.15);
      def *= (1-(s.pr||0));
      const elemMult = this.elemMult(s.elem, foe.elem);
      const hits = s.hits||1;
      let totalDmg = 0;
      for (let h=0; h<hits; h++){
        // 命中判定
        const hitChance = clamp(this.eff(u,'acc') - this.eff(foe,'eva') + (s.cat==='magic'?8:0), 5, 100);
        if (this.rng()*100 >= hitChance){ ev.hits.push({dmg:0,miss:true,crit:false,eff:elemMult}); continue; }
        let dmg = atk * (power/100) * (100/(100+def));
        dmg *= elemMult;
        dmg *= 0.9 + this.rng()*0.2;
        if (s.elem!=='none') dmg *= 1+(u.passives.elem||0)/100;
        if (s.execute && foe.hp<foe.maxHp*0.3) dmg*=1.5;
        // 会心
        let critRate = 5 + (u.passives.crit||0) + (s.cr||0) + (this.has(u,'focus')?100:0);
        const crit = this.rng()*100 < critRate;
        if (crit) dmg*=1.6;
        // 防御系
        if (this.has(foe,'guard')) dmg*=0.4;
        if (foe.passives.guard) dmg*=1-foe.passives.guard/100;
        dmg = Math.max(1, Math.round(dmg));
        // バリア
        const shield = foe.effects.find(e=>e.s==='shield');
        if (shield){
          const absorbed = Math.min(shield.val, dmg); shield.val-=absorbed; dmg-=absorbed;
          if (shield.val<=0) foe.effects = foe.effects.filter(e=>e!==shield);
        }
        foe.hp = clamp(foe.hp-dmg,0,foe.maxHp);
        totalDmg += dmg;
        ev.hits.push({dmg, miss:false, crit, eff:elemMult, absorbed:0});
        u.gauge = clamp(u.gauge + 13*(1+(u.passives.gauge||0)/100),0,100);
        foe.gauge = clamp(foe.gauge + 9,0,100);
        // 吸収
        const drain = (s.dr||0) + (u.passives.drain||0)/100;
        if (drain>0){ const dh=Math.round(dmg*drain); u.hp=clamp(u.hp+dh,0,u.maxHp); ev.heal+=dh; }
        // 反撃
        if (this.has(foe,'counter') && s.cat!=='magic' && foe.hp>0){
          const cdmg = Math.round(dmg*0.5);
          u.hp = clamp(u.hp-cdmg,0,u.maxHp);
          this.emit({t:'counter', unit:1-idx, amount:cdmg, target:idx});
        }
        if (foe.hp<=0) break;
      }
      // 追加効果
      if (foe.hp>0){
        if (s.d){ for (const [st,p,d,c] of s.d){ if (this.rng()*100<c) { this.addEffect(foe,{kind:'stat',s:st,pct:p,dur:d+1}); ev.applied.push(`${STAT_NAME[st]}${p}%`);} } }
        if (s.st && s.st[0] && STAT_NAME[s.st[0]]===undefined){ this.applyStatus(foe,u,s.st[0],s.st[1],s.st[2],ev.applied); }
        if (s.coinSteal && totalDmg>0){ const c=Math.round(10+u.level*2); ev.coinSteal=c; }
      }
      const effTxt = elemMult>1?' 効果はバツグンだ！':elemMult<1?' いまひとつのようだ…':'';
      this.log(`${u.name} の「${s.name}」！${totalDmg>0?` ${totalDmg}ダメージ！${effTxt}`:' ミス！'}`);
      if (ev.coinSteal) this.log(`${u.name} はコインを${ev.coinSteal}奪い取った！`);
    } else if (s.cat==='buff' && !s.power){
      this.log(`${u.name} の「${s.name}」！ ${ev.selfEffects.join(' ')||'能力が上がった！'}`);
    } else if (s.cat==='debuff'){
      if (s.d){ for (const [st,p,d,c] of s.d){ if (this.rng()*100<c) { this.addEffect(foe,{kind:'stat',s:st,pct:p,dur:d+1}); ev.applied.push(`敵${STAT_NAME[st]}${p}%`);} } }
      if (s.st && s.st[0]){ this.applyStatus(foe,u,s.st[0],s.st[1],s.st[2],ev.applied); }
      this.log(`${u.name} の「${s.name}」！ ${ev.applied.join(' ')||'しかし効かなかった…'}`);
    } else if (s.cat==='guard'||s.cat==='counter'){
      this.log(`${u.name} の「${s.name}」！ ${ev.selfEffects.join(' ')||'構えをとった！'}`);
    }
    this.emit(ev);
    if (foe.hp<=0){ this.finish(idx===0); }
    else if (u.hp<=0){ this.finish(idx!==0); }
  }
  applyStatus(target, src, s, dur, chancePct, appliedList){
    const resist = target.passives.resist||0;
    if (this.rng()*100 >= chancePct - resist) return;
    if (s==='shield'){ this.addEffect(target,{kind:'status',s:'shield',dur:dur+1,val:Math.round(target.maxHp*0.25)}); }
    else this.addEffect(target,{kind:'status',s,dur:dur+1});
    if (appliedList) appliedList.push(STATUS_NAME[s]||s);
  }
  elemMult(atkElem, defElem){
    if (atkElem==='none'||defElem==='none') return 1;
    if (ELEM_CHART[atkElem]===defElem) return 1.3;
    if (ELEM_CHART[defElem]===atkElem) return 0.75;
    return 1;
  }
  endTurn(idx){
    const u = this.units[idx];
    // 継続ダメージ・回復
    for (const e of [...u.effects]){
      if (e.s==='poison'){ const d=Math.max(1,Math.round(u.maxHp*0.05)); u.hp=clamp(u.hp-d,0,u.maxHp); this.emit({t:'dot',unit:idx,kind:'poison',amount:d}); }
      if (e.s==='burn'){ const d=Math.max(1,Math.round(u.maxHp*0.06)); u.hp=clamp(u.hp-d,0,u.maxHp); this.emit({t:'dot',unit:idx,kind:'burn',amount:d}); }
      if (e.s==='regen'){ const h=Math.round(u.maxHp*0.06); u.hp=clamp(u.hp+h,0,u.maxHp); this.emit({t:'heal',unit:idx,amount:h,fx:'heal'}); }
      e.dur--;
    }
    if (u.passives.regen){ const h=Math.round(u.maxHp*u.passives.regen/100); u.hp=clamp(u.hp+h,0,u.maxHp); this.emit({t:'heal',unit:idx,amount:h,fx:'heal'}); }
    u.effects = u.effects.filter(e=>e.dur>0);
    if (u.hp<=0){ this.finish(idx!==0); return; }
    this.queue.shift();
    this.beginTurn();
  }
  finish(playerWin){
    if (this.over) return;
    this.over=true; this.win=playerWin;
    this.emit({t:'end', win:playerWin, fled:false});
    this.log(playerWin?`🎉 ${this.units[0].name} の勝利！`:`💀 ${this.units[1].name} の勝利…`);
  }

  // ---------- AI ----------
  aiChoose(u=this.units[1]){
    const foe = this.units[u.isPlayer?1:0];
    const usable = this.usableSkills(u);
    const heals = usable.filter(s=>s.cat==='heal');
    const dmg = usable.filter(s=>['phys','magic','summon','ultimate'].includes(s.cat)&&s.power>0);
    const buffs = usable.filter(s=>['buff','guard','counter'].includes(s.cat));
    const debuffs = usable.filter(s=>s.cat==='debuff');
    const hpPct = u.hp/u.maxHp;
    if (this.aiLevel==='simple'){
      if (dmg.length && this.rng()<0.7) return {type:'skill', id:this.pick(dmg).id};
      return {type:'attack'};
    }
    // 回復優先
    if (hpPct<0.45 && heals.length) return {type:'skill', id:heals.sort((a,b)=>(b.healPct||b.power)-(a.healPct||a.power))[0].id};
    // 必殺技
    const ults = dmg.filter(s=>s.gauge && u.gauge>=s.gauge);
    if (ults.length && (hpPct<0.6 || foe.hp<foe.maxHp*0.5 || this.rng()<0.5)) return {type:'skill', id:ults.sort((a,b)=>b.power-a.power)[0].id};
    // バフ
    if (buffs.length && this.round<=2 && this.rng()<0.6) return {type:'skill', id:this.pick(buffs).id};
    // デバフ
    if (debuffs.length && this.rng()<0.35) return {type:'skill', id:this.pick(debuffs).id};
    // 攻撃アイテム
    if (hpPct<0.3 && (this.bag.hi_potion||this.bag.potion)){ return {type:'item', id:this.bag.hi_potion?'hi_potion':'potion'}; }
    if (dmg.length){
      // 属性相性と威力で選択
      const scored = dmg.map(s=>({s, score: s.power*(s.hits||1)*this.elemMult(s.elem,foe.elem)*(1+(s.cr||0)/200)}));
      scored.sort((a,b)=>b.score-a.score);
      const best = this.aiLevel==='smart'?scored[0].s:this.pick(scored.slice(0,3)).s;
      return {type:'skill', id:best.id};
    }
    return {type:'attack'};
  }
  pick(arr){ return arr[Math.floor(this.rng()*arr.length)]; }
  aiAct(){
    const u = this.current();
    if (!u || u.isPlayer) return this.drain();
    return this.submit(this.aiChoose(u));
  }
}
