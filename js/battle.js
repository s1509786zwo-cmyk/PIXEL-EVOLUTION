/* ===========================================================
   ターン制 CPU 対戦エンジン
   =========================================================== */
import { SKILL, ELEMENTS, JOB, ITEM } from './data.js?v=2';
import {
  computeStats, buildEnemyCombatant, battleRewards, advanceDungeon, removeItem,
  addCatalog, logEvent, restoreFull, rankInfo, clamp,
} from './state.js?v=2';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a,b) => a + Math.random()*(b-a);
const pct = p => Math.random()*100 < p;

const JOB_ELEMENT = {
  warrior:'none', fencer:'wind', knight:'earth', mage:'fire', priest:'light', thief:'dark',
  archer:'wind', monk:'earth', gunner:'thunder', summoner:'star', alchemist:'water', ninja:'dark',
  swordmaster:'light', archmage:'fire', assassin:'dark', dragonknight:'fire', spellblade:'thunder',
  apostle:'light', destroyer:'fire', timeweaver:'star', starguard:'star',
};

export class Battle {
  constructor(opts) {
    this.state = opts.state;
    this.char = opts.char;
    this.enemyDef = opts.enemy;
    this.mode = opts.mode || 'cpu';       // cpu / dungeon / hidden / boss
    this.floor = opts.floor || 0;
    this.onChange = opts.onChange || (() => {});
    this.onFx = opts.onFx || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.anim = Math.max(0.25, this.state.settings.animSpeed || 1);
    this.turn = 1;
    this.phase = 'player';
    this.logs = [];
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.autoMode = false;
    this.finished = false;

    const ps = computeStats(this.char, this.state);
    const es = buildEnemyCombatant(this.enemyDef);
    this.player = {
      name: this.char.name, sprite: this.char.sprite, isPlayer:true,
      level:this.char.level, job:this.char.jobId, awakening:this.char.awakening, aura:this.char.aura,
      base:ps, hp:ps.hp, mp:ps.mp, maxHp:ps.hp, maxMp:ps.mp,
      element: JOB_ELEMENT[this.char.jobId] || 'none',
      effects: ps.effects || {}, statuses:[], buffs:[], cds:{}, shield:0, counter:null, guard:false,
      skills: this.char.equippedSkills.length ? [...this.char.equippedSkills] : this.char.skills.slice(0,4).map(s=>s.id),
      mastery: Object.fromEntries(this.char.skills.map(s=>[s.id,s.mastery||0])),
    };
    this.enemy = {
      name: this.enemyDef.trueName || this.enemyDef.name, sprite: null, isPlayer:false,
      level:this.enemyDef.level, job:this.enemyDef.job, awakening:this.enemyDef.boss?3:0, aura:this.enemyDef.hidden?'void':'gold',
      base:es, hp:es.hp, mp:es.mp, maxHp:es.hp, maxMp:es.mp,
      element: JOB_ELEMENT[this.enemyDef.job] || 'none',
      effects: es.effects || {}, statuses:[], buffs:[], cds:{}, shield:0, counter:null, guard:false,
      skills: [...(this.enemyDef.skills || [])], mastery:{},
    };
    this.log(`【対戦開始】 ${this.player.name} Lv.${this.player.level} vs ${this.enemy.name} Lv.${this.enemy.level}`, 'system');
    this.log(`相手の戦闘スタイル：${JOB[this.enemy.job]?.name || '戦士'} / ${this.enemyDef.difficulty || 'CPU'}`, 'system');
  }

  /* ---------- 表示用 ---------- */
  log(text, kind = 'info') {
    this.logs.push({ text, kind, turn:this.turn });
    if (this.logs.length > 60) this.logs.shift();
    this.onChange();
  }
  fx(o) { this.onFx(o); }
  changed() { this.onChange(); }
  delay(ms) { return sleep(Math.max(60, Math.round(ms / this.anim))); }

  hpPct(side) { return Math.max(0, Math.min(100, side.hp / side.maxHp * 100)); }
  mpPct(side) { return Math.max(0, Math.min(100, side.mp / side.maxMp * 100)); }

  stat(side, key) {
    const base = side.base[key] || 0;
    let mul = 1, flat = 0;
    for (const b of side.buffs) if (b.stat === key) { if (b.pct) mul += b.amount/100; else flat += b.amount; }
    if (key === 'acc' || key === 'eva') return clamp(base*mul + flat, 0, 260);
    return Math.max(1, base*mul + flat);
  }
  eff(side, id) { return side.effects[id] || 0; }

  /* ---------- 技リスト ---------- */
  actionList(side) {
    if (side === this.player) {
      const list = [{ id:'__attack', name:'通常攻撃', mp:0, cd:0, element:'none', cat:'基本', power:100, desc:'MPを消費しない基本攻撃' },
                    ...side.skills.map(id => SKILL[id]).filter(Boolean)];
      return list.map(s => ({ ...s, usable: side.mp >= (s.mp||0) && (side.cds[s.id]||0) === 0 && this.canAct(side) }));
    }
    return side.skills.map(id => SKILL[id]).filter(Boolean);
  }
  usableItems() {
    return Object.entries(this.state.inventory.items)
      .filter(([id,n]) => n > 0 && ITEM[id]?.kind === 'consumable')
      .map(([id,n]) => ({ id, n, ...ITEM[id] }));
  }
  canAct(side) {
    return !side.statuses.some(s => ['freeze','sleep','paralysis'].includes(s.id));
  }
  statusLabel(side) {
    return side.statuses.map(s => ({ poison:'毒', burn:'火傷', freeze:'凍結', paralysis:'麻痺', sleep:'睡眠',
      regen:'再生', curse:'呪い', confuse:'混乱', stun:'気絶' })[s.id] || s.id).join('・');
  }

  /* ---------- ターン開始処理 ---------- */
  async tickTurn(side) {
    side.guard = false;
    for (const k of Object.keys(side.cds)) if (side.cds[k] > 0) side.cds[k]--;
    for (const b of side.buffs) b.dur--;
    side.buffs = side.buffs.filter(b => b.dur > 0);
    side.counter = side.counter && side.counter.dur > 1 ? { ...side.counter, dur:side.counter.dur-1 } : null;
    let dot = 0, hot = 0;
    for (const st of side.statuses) {
      if (st.id === 'poison') dot += Math.round(side.maxHp * 0.045);
      if (st.id === 'burn') dot += Math.round(side.maxHp * 0.065);
      if (st.id === 'regen') hot += Math.round(side.maxHp * 0.055);
      st.dur--;
    }
    if (this.eff(side,'hpRegen')) hot += Math.round(side.maxHp * this.eff(side,'hpRegen')/100);
    side.mp = Math.min(side.maxMp, side.mp + (this.eff(side,'mpRegen') || 0));
    side.statuses = side.statuses.filter(s => s.dur > 0);
    if (dot) {
      side.hp = Math.max(0, side.hp - dot);
      this.log(`${side.name} は状態異常で ${dot} ダメージ`, 'status');
      this.fx({ type:'statusDamage', side: side===this.player?'player':'enemy', value:dot });
    }
    if (hot) {
      side.hp = Math.min(side.maxHp, side.hp + hot);
      this.log(`${side.name} は ${hot} 回復した`, 'heal');
      this.fx({ type:'heal', side: side===this.player?'player':'enemy', value:hot });
    }
    this.changed();
    if (dot || hot) await this.delay(260);
    if (side.hp <= 0) { await this.finish(side === this.enemy); return false; }
    return true;
  }

  /* ---------- ダメージ解決 ---------- */
  dealDamage(attacker, defender, part, skill) {
    const sideKey = defender === this.player ? 'player' : 'enemy';
    const aKey = attacker === this.player ? 'player' : 'enemy';
    const scale = part.scale === 'mag' ? 'mag' : 'atk';
    const mastery = attacker.mastery?.[skill?.id] || 0;
    const power = (part.power || 100) * (1 + mastery*0.03);
    const hitChance = clamp(this.stat(attacker,'acc') - this.stat(defender,'eva')*0.55 + 42, 30, 99);
    if (!part.trueHit && !pct(hitChance)) {
      this.log(`${attacker.name} の攻撃は外れた！`, 'miss');
      this.fx({ type:'miss', side:sideKey });
      return 0;
    }
    const critRate = 6 + this.eff(attacker,'crit') + Math.max(0, (this.stat(attacker,'acc')-90)*0.15);
    const crit = pct(critRate);
    const eMul = this.elementMult(skill?.element || part.element || 'none', defender.element);
    const def = this.stat(defender,'def') * (1 - (part.pierce || this.eff(attacker,'ignoreDef')/100 || 0));
    const mit = 100 / (100 + Math.max(0,def) * 0.62);
    const buffAtk = 1 + (this.eff(attacker,'firstStrike') && this.turn === 1 ? 0.2 : 0);
    let dmg = this.stat(attacker, scale) * (power/100) * rnd(0.92,1.08) * mit * eMul * buffAtk;
    if (crit) dmg *= 1.65;
    if (defender.guard) dmg *= 0.42;
    dmg *= 1 - Math.min(0.5, this.eff(defender,'damageCut')/100);
    dmg = Math.max(1, Math.round(dmg));
    // シールド
    if (defender.shield > 0) {
      const absorbed = Math.min(defender.shield, dmg);
      defender.shield -= absorbed; dmg -= absorbed;
      if (absorbed) this.log(`${defender.name} のバリアが ${absorbed} を防いだ`, 'shield');
    }
    defender.hp = Math.max(0, defender.hp - dmg);
    if (attacker === this.player) this.damageDealt += dmg; else this.damageTaken += dmg;
    this.log(`${attacker.name} → ${defender.name} に ${dmg} ダメージ${crit?'（会心！）':''}${eMul>1.05?'（属性有利）':''}`, crit?'crit':'damage');
    this.fx({ type:'damage', side:sideKey, value:dmg, crit, element: skill?.element || 'none', fx: skill?.fx || 'slash' });
    this.state.stats.damageDealt += dmg;
    this.state.stats.maxDamage = Math.max(this.state.stats.maxDamage, dmg);
    // 吸血・反撃・カウンター
    const ls = this.eff(attacker,'lifesteal');
    if (ls) {
      const heal = Math.round(dmg * ls/100);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      this.fx({ type:'heal', side:aKey, value:heal });
    }
    if (part.drain) {
      const heal = Math.round(dmg * part.drain);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      this.log(`${attacker.name} は ${heal} 吸収した`, 'heal');
    }
    if (defender.counter && defender.counter.dur > 0) {
      const back = Math.round(dmg * defender.counter.amount);
      attacker.hp = Math.max(0, attacker.hp - back);
      this.log(`${defender.name} のカウンター！ ${back} を跳ね返した`, 'counter');
      this.fx({ type:'damage', side:aKey, value:back, crit:false, fx:'impact' });
    } else if (this.eff(defender,'counter') && pct(Math.min(70,this.eff(defender,'counter')))) {
      const back = Math.round(dmg * this.eff(defender,'counter')/100);
      attacker.hp = Math.max(0, attacker.hp - back);
      this.log(`${defender.name} の反撃で ${back} ダメージ`, 'counter');
      this.fx({ type:'damage', side:aKey, value:back, crit:false, fx:'impact' });
    }
    // 追撃
    if (attacker === this.player && this.eff(attacker,'extraStrike') && pct(this.eff(attacker,'extraStrike'))) {
      const extra = Math.round(dmg*0.35);
      defender.hp = Math.max(0, defender.hp - extra);
      this.log(`追撃が発動！ +${extra} ダメージ`, 'crit');
      this.fx({ type:'damage', side:sideKey, value:extra, crit:false, fx:'slash' });
    }
    return dmg;
  }

  elementMult(atkEl, defEl) {
    if (!atkEl || !defEl || atkEl === 'none') return 1;
    if (ELEMENTS[atkEl]?.beats === defEl) return 1.3;
    if (ELEMENTS[defEl]?.beats === atkEl) return 0.82;
    return 1;
  }

  applyStatus(target, st) {
    if (!st?.status) return;
    if (pct(this.eff(target,'statusGuard') || 0)) {
      this.log(`${target.name} は状態異常を防いだ`, 'shield'); return;
    }
    if (!pct(st.chance ?? 100)) return;
    if (target.statuses.some(x => x.id === st.status)) return;
    target.statuses.push({ id:st.status, dur:st.dur || 3 });
    const label = ({poison:'毒',burn:'火傷',freeze:'凍結',paralysis:'麻痺',sleep:'睡眠',confuse:'混乱',curse:'呪い',regen:'再生'})[st.status] || st.status;
    this.log(`${target.name} は「${label}」になった`, 'status');
  }

  /* ---------- 行動の解決 ---------- */
  async resolveAction(actor, target, action) {
    const aKey = actor === this.player ? 'player':'enemy';
    const tKey = target === this.player ? 'player':'enemy';
    const skill = typeof action === 'string' ? (SKILL[action] || (action === '__attack' ? basicAttack() : null)) : action;
    if (!skill) return;
    if (actor.mp < (skill.mp||0)) { this.log('MPが足りない！', 'miss'); return; }
    actor.mp -= (skill.mp||0);
    if (skill.cd) actor.cds[skill.id] = skill.cd;
    this.log(`▶ ${actor.name}：「${skill.name}」`, aKey === 'player'?'playerAct':'enemyAct');
    this.fx({ type:'skill', side:aKey, name:skill.name, fx:skill.fx || 'slash', element:skill.element || 'none' });
    await this.delay(360);

    if (actor.statuses.some(s => s.id === 'confuse') && pct(35)) {
      const self = Math.round(actor.maxHp*0.05);
      actor.hp = Math.max(0, actor.hp - self);
      this.log(`${actor.name} は混乱して自らを傷つけた（${self}）`, 'status');
      this.fx({ type:'damage', side:aKey, value:self, fx:'dark' });
      await this.delay(250);
      return;
    }

    for (const part of (skill.parts || [{op:'damage',power:skill.power||100,scale:'atk',hits:1}])) {
      switch (part.op) {
        case 'damage': {
          const hits = part.hits || 1;
          for (let i=0;i<hits;i++) {
            this.dealDamage(actor, target, part, skill);
            this.changed();
            if (target.hp <= 0) break;
            if (hits > 1) await this.delay(170);
          }
          break;
        }
        case 'heal': {
          const v = Math.round(this.stat(actor,'mag') * (part.power||100)/100 * rnd(0.95,1.08) + 18);
          actor.hp = Math.min(actor.maxHp, actor.hp + v);
          this.log(`${actor.name} のHPが ${v} 回復`, 'heal');
          this.fx({ type:'heal', side:aKey, value:v });
          break;
        }
        case 'restoreMp': actor.mp = Math.min(actor.maxMp, actor.mp + (part.amount||10)); this.log(`${actor.name} のMPが回復`, 'buff'); break;
        case 'drainMp': target.mp = Math.max(0, target.mp - (part.amount||10)); this.log(`${target.name} のMPを奪った`, 'status'); break;
        case 'buff': {
          const who = part.target === 'self' ? actor : target;
          who.buffs.push({ stat:part.stat, amount:part.amount, dur:part.dur||3, pct:true });
          this.log(`${who.name} の${({atk:'攻撃',def:'防御',spd:'速度',mag:'魔力',acc:'命中',eva:'回避'})[part.stat]}が上昇`, 'buff');
          this.fx({ type:'buff', side:who===this.player?'player':'enemy' });
          break;
        }
        case 'debuff': {
          target.buffs.push({ stat:part.stat, amount:-Math.abs(part.amount), dur:part.dur||3, pct:true });
          this.log(`${target.name} の${({atk:'攻撃',def:'防御',spd:'速度',mag:'魔力'})[part.stat]}が低下`, 'status');
          break;
        }
        case 'status': this.applyStatus(part.target === 'self' ? actor : target, part); break;
        case 'shield': {
          actor.shield += (part.amount||60);
          this.log(`${actor.name} にバリア（${part.amount||60}）`, 'shield');
          this.fx({ type:'shield', side:aKey });
          break;
        }
        case 'counter': actor.counter = { amount:part.amount||1, dur:(part.dur||2)+1 }; this.log(`${actor.name} は反撃の構え`, 'buff'); break;
        case 'cleanse': {
          actor.statuses = []; actor.buffs = actor.buffs.filter(b=>b.amount>0);
          this.log(`${actor.name} の状態異常を解除`, 'heal'); break;
        }
        case 'summon': {
          this.fx({ type:'summon', side:aKey, fx:'summon' });
          await this.delay(240);
          this.dealDamage(actor, target, {power:part.power||120, scale:'mag', hits:1}, {...skill, element:'star'});
          break;
        }
        case 'drainSelf': {
          const v = Math.round(actor.maxHp * (part.ratio||0.15));
          actor.hp = Math.max(1, actor.hp - v);
          this.log(`${actor.name} は ${v} の代償を払った`, 'status');
          this.fx({ type:'damage', side:aKey, value:v, fx:'dark' });
          break;
        }
        default: break;
      }
      this.changed();
      if (target.hp <= 0 || actor.hp <= 0) break;
      await this.delay(150);
    }
    await this.delay(220);
  }

  /* ---------- プレイヤー行動 ---------- */
  async act(actionId) {
    if (this.finished || this.phase !== 'player') return;
    this.phase = 'busy'; this.changed();
    if (actionId === '__guard') {
      this.player.guard = true;
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 14);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp*0.03));
      this.log('▶ 防御：被ダメージ軽減 / MP+14 / HP少回復', 'playerAct');
      this.fx({ type:'shield', side:'player' });
      await this.delay(320);
    } else if (actionId.startsWith('__item:')) {
      const id = actionId.slice(7);
      if (!removeItem(this.state, id, 1)) { this.log('アイテムがありません', 'miss'); }
      else {
        const it = ITEM[id], b = it.battle || {};
        const v = b.value || 0;
        if (b.op === 'heal') { this.player.hp = Math.min(this.player.maxHp, this.player.hp+v); this.fx({type:'heal',side:'player',value:v}); }
        if (b.op === 'mp') { this.player.mp = Math.min(this.player.maxMp, this.player.mp+v); this.fx({type:'buff',side:'player'}); }
        if (b.op === 'cleanse') this.player.statuses = [];
        if (b.op === 'buff') this.player.buffs.push({stat:b.stat,amount:b.value,dur:2,pct:true});
        if (b.op === 'full') { this.player.hp=this.player.maxHp; this.player.mp=this.player.maxMp; this.fx({type:'heal',side:'player',value:'全回復'}); }
        this.log(`▶ ${it.name} を使用`, 'playerAct');
      }
      this.changed();
      await this.delay(320);
    } else if (!this.canAct(this.player)) {
      this.log(`${this.player.name} は状態異常で動けない！`, 'status');
      this.fx({ type:'stun', side:'player' });
      await this.delay(420);
    } else {
      const sk = actionId === '__attack' ? basicAttack() : SKILL[actionId];
      if (!sk) { this.phase='player'; this.changed(); return; }
      if (this.player.mp < (sk.mp||0)) { this.log('MPが足りません', 'miss'); this.phase='player'; this.changed(); return; }
      await this.resolveAction(this.player, this.enemy, sk);
    }
    if (this.enemy.hp <= 0 || this.player.hp <= 0) { await this.finish(this.enemy.hp <= 0); return; }
    await this.enemyTurn();
    if (this.finished) return;
    if (this.enemy.hp <= 0 || this.player.hp <= 0) { await this.finish(this.enemy.hp <= 0); return; }
    this.turn++;
    this.phase = 'player';
    if (!await this.tickTurn(this.player)) return;
    this.log(`── ターン ${this.turn} ──`, 'system');
    this.changed();
    if (this.autoMode) setTimeout(() => this.autoStep(), 420);
  }

  /* ---------- CPU思考 ---------- */
  async enemyTurn() {
    this.phase = 'cpu'; this.changed();
    if (!await this.tickTurn(this.enemy)) return;
    await this.delay(300);
    if (this.enemy.statuses.some(s => ['freeze','sleep','paralysis'].includes(s.id))) {
      this.log(`${this.enemy.name} は動けない！`, 'status');
      this.fx({ type:'stun', side:'enemy' });
      await this.delay(360);
      return;
    }
    const usable = this.enemy.skills.map(id => SKILL[id]).filter(s => s && s.mp <= this.enemy.mp && (this.enemy.cds[s.id]||0) === 0);
    let pick = null;
    const lowHp = this.hpPct(this.enemy) < 38;
    if (lowHp) pick = usable.find(s => s.parts?.some(p => p.op === 'heal' || p.op === 'summon'));
    if (!pick && this.turn <= 2) pick = usable.find(s => s.parts?.some(p => p.op === 'buff' || p.op === 'shield'));
    if (!pick) {
      const damaging = usable.filter(s => s.parts?.some(p => p.op === 'damage' || p.op === 'summon'));
      pick = damaging.sort((a,b)=> (b.power||0)*(b.parts?.[0]?.hits||1) - (a.power||0)*(a.parts?.[0]?.hits||1))[Math.min(1, damaging.length-1)] || usable[0];
    }
    pick = pick || basicAttack();
    await this.resolveAction(this.enemy, this.player, pick);
  }

  /* ---------- おまかせ ---------- */
  async autoStep() {
    if (this.finished || this.phase !== 'player' || !this.autoMode) return;
    const list = this.actionList(this.player).filter(s => s.usable && s.id !== '__attack');
    let choice = '__attack';
    if (this.hpPct(this.player) < 35 && this.usableItems().find(i => i.battle?.op === 'heal')) {
      choice = '__item:' + this.usableItems().find(i => i.battle?.op === 'heal').id;
    } else if (list.length) {
      const damaging = list.filter(s => s.parts?.some(p => p.op === 'damage') || s.power);
      const pool = damaging.length ? damaging : list;
      const sorted = pool.sort((a,b)=> (b.power||0) - (a.power||0));
      choice = sorted[0].id;
    }
    await this.act(choice);
  }
  toggleAuto() {
    this.autoMode = !this.autoMode;
    this.log(this.autoMode ? 'おまかせ戦闘：ON' : 'おまかせ戦闘：OFF', 'system');
    this.changed();
    if (this.autoMode && this.phase === 'player') setTimeout(() => this.autoStep(), 350);
  }

  /* ---------- 決着 ---------- */
  async finish(won) {
    if (this.finished) return;
    this.finished = true; this.phase = 'end'; this.autoMode = false;
    this.log(won ? `★ ${this.player.name} の勝利！` : `… ${this.player.name} の敗北`, won?'win':'lose');
    this.fx({ type: won?'victory':'defeat', side:'player' });
    this.changed();
    await this.delay(500);
    addCatalog(this.state.catalog.enemies, this.enemyDef.id);
    const mode = this.mode;
    const isDungeon = mode === 'dungeon';
    const rewards = battleRewards(this.state, this.char, this.enemyDef, won, {
      damage:this.damageDealt, dungeon:isDungeon, floor:this.floor,
    });
    if (isDungeon) advanceDungeon(this.state, won, this.state.dungeon.hard);
    logEvent(this.state, `対戦終了：${this.enemy.name} に${won?'勝利':'敗北'}（${this.turn}ターン / 与ダメージ${this.damageDealt}）`, won?'win':'lose');
    restoreFull(this.state, this.char);
    this.onEnd({ won, turns:this.turn, damage:this.damageDealt, taken:this.damageTaken, rewards, enemy:this.enemyDef, mode, floor:this.floor });
  }

  /* ---------- 降参 ---------- */
  async surrender() {
    if (this.finished) return;
    this.log('降参した。', 'lose');
    await this.finish(false);
  }
}

function basicAttack() {
  return { id:'__attack', name:'通常攻撃', mp:0, cd:0, element:'none', cat:'基本', power:100,
    parts:[{op:'damage',power:100,scale:'atk',hits:1}], fx:'slash', desc:'MPを消費しない基本攻撃' };
}
