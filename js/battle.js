/* ===========================================================
   ターン制 CPU 対戦エンジン
   =========================================================== */
import { enemyMove } from './enemyAssets.js?v=2';
import { SKILL, ELEMENTS, JOB, ITEM, charRankIndex, EFFECTS,
  ULTIMATE_GAUGE_MAX, ULTIMATE_GAUGE_GAIN, ULTIMATE_GAUGE_HIT_GAIN,
  ULTIMATE_IDS, GOD_JOB_ID, coreStatKey, STAT_NAMES } from './data.js?v=2';
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
  apostle:'light', destroyer:'fire', timeweaver:'star', starguard:'star', god:'star',
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
    this.autoMode = !!this.state.settings?.autoOn;
    this.autoSpeed = clamp(Number(this.state.settings?.autoSpeed) || 1, 1, 3);
    this.autoUltimate = this.state.settings?.autoUltimate !== false;
    this.autoPending = false;
    this.autoTimer = null;
    this.ultimateGauge = 0;
    this.finished = false;

    const ps = computeStats(this.char, this.state);
    const es = buildEnemyCombatant(this.enemyDef);
    this.player = {
      name: this.char.name, sprite: this.char.sprite, isPlayer:true,
      level:this.char.level, job:this.char.jobId, awakening:this.char.awakening, aura:this.char.aura,
      base:ps, hp:ps.hp, mp:ps.mp, maxHp:ps.hp, maxMp:ps.mp,
      element: JOB_ELEMENT[this.char.jobId] || 'none',
      effects: ps.effects || {}, statuses:[], buffs:[], cds:{}, shield:0, counter:null, guard:false,
      // 奥義は装備枠(8)に関係なく常に使用可能。重複を除いて追加する。
      skills: [...new Set([
        ...(this.char.equippedSkills.length ? this.char.equippedSkills : this.char.skills.slice(0,4).map(s=>s.id)),
        ...(this.char.ultimateSkills || []),
        ...this.char.skills.map(s => s.id).filter(id => ULTIMATE_IDS.has(id)),
      ])],
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
    // Google Drive「敵キャラ」1 種類ごとの専用技。状態異常・防御低下・
    // 自己強化・吸収・必中など、敵の特徴を戦闘効果として実際に発動する。
    this.enemyMoveSkill = buildEnemyMoveSkill(enemyMove(this.enemyDef));
    this.log(`【対戦開始】 ${this.player.name} Lv.${this.player.level} vs ${this.enemy.name} Lv.${this.enemy.level}`, 'system');
    this.log(`相手の戦闘スタイル：${JOB[this.enemy.job]?.name || '戦士'} / ${this.enemyDef.difficulty || 'CPU'}`, 'system');
    if (this.enemyMoveSkill) this.log(`相手の専用技：「${this.enemyMoveSkill.name}」 ${this.enemyMoveSkill.desc}`, 'system');
  }

  /* ---------- 表示用 ---------- */
  log(text, kind = 'info') {
    this.logs.push({ text, kind, turn:this.turn });
    if (this.logs.length > 60) this.logs.shift();
    this.onChange();
  }
  fx(o) { this.onFx(o); }
  changed() { this.onChange(); }
  /** AUTO 中だけ 1/2/3 倍速。最小ウェイトを残して演出・ログを読める速さに留める */
  get speedFactor() { return this.autoMode ? this.autoSpeed : 1; }
  delay(ms) { return sleep(Math.max(90, Math.round(ms / (this.anim * this.speedFactor)))); }
  queueAuto(ms = 380) {
    if (!this.autoMode || this.finished || this.phase !== 'player' || this.autoTimer) return;
    this.autoPending = true;
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null; this.autoPending = false;
      if (this.autoMode && !this.finished && this.phase === 'player') this.autoStep();
    }, Math.max(110, Math.round(ms / this.speedFactor)));
  }
  cancelAuto() {
    if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = null; }
    this.autoPending = false;
  }
  /**
   * 戦闘開始のキック。設定で AUTO が ON のまま新しい戦闘へ入った場合、
   * コンストラクタは autoMode を復元するだけでは自動進行が始まらないため、
   * ここで最初の AUTO ターンの予約を行う（ボタンを押し直す必要をなくす）。
   */
  start() {
    if (this.autoMode && !this.finished && this.phase === 'player') this.queueAuto(350);
    return this;
  }
  canUseUltimate(sk) {
    return !!(sk && sk.ultimate && this.ultimateGauge >= ULTIMATE_GAUGE_MAX
      && this.player.mp >= (sk.mp || 0) && (this.player.cds[sk.id] || 0) === 0 && this.canAct(this.player));
  }
  ultimateMultiplier(actor, skill) {
    const c = this.char;
    const ri = charRankIndex(c.rarity);
    let m = 1 + ri * 0.22;
    if (c.rarity === 'LR') m += 0.35;
    if (c.jobId === GOD_JOB_ID) m += 0.45;
    m += this.eff(actor, 'ultimatePower') / 100;
    m *= 1 + this.stat(actor, 'atk') / 1300; // 攻撃力・装備・ランクが奥義威力に反映
    if (skill.special) m *= 1 + ri * 0.28 + (c.jobId === GOD_JOB_ID ? 0.4 : 0); // 特殊奥義は進化で強化
    return m;
  }

  hpPct(side) { return Math.max(0, Math.min(100, side.hp / side.maxHp * 100)); }
  mpPct(side) { return Math.max(0, Math.min(100, side.mp / side.maxMp * 100)); }

  stat(side, key) {
    const base = side.base[key] || 0;
    let mul = 1, flat = 0;
    for (const b of side.buffs) if (b.stat === key) { if (b.pct) mul += b.amount/100; else flat += b.amount; }
    if (key === 'hit' || key === 'dodge' || key === 'crit') return clamp(base*mul + flat, 0, 260);
    return Math.max(1, base*mul + flat);
  }
  eff(side, id) { return side.effects[id] || 0; }

  /* ---------- 技リスト ---------- */
  actionList(side) {
    if (side === this.player) {
      const list = [{ id:'__attack', name:'通常攻撃', mp:0, cd:0, element:'none', cat:'基本', power:100, desc:'MPを消費しない基本攻撃' },
                    ...side.skills.map(id => SKILL[id]).filter(Boolean)];
      return list.map(s => ({ ...s,
        usable: side.mp >= (s.mp||0) && (side.cds[s.id]||0) === 0 && this.canAct(side)
          && (!s.ultimate || this.canUseUltimate(s)) }));
    }
    const list = side.skills.map(id => SKILL[id]).filter(Boolean);
    if (side === this.enemy && this.enemyMoveSkill) list.push(this.enemyMoveSkill);
    return list;
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
    if (side === this.player) {
      this.ultimateGauge = Math.min(ULTIMATE_GAUGE_MAX,
        this.ultimateGauge + ULTIMATE_GAUGE_GAIN * (this.char.rarity === 'LR' ? 1.2 : 1)
        + (this.char.jobId === GOD_JOB_ID ? 6 : 0));
    }
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
    // 物理・魔法を問わず攻撃力を基準にする（魔力は基本ステータスから廃止）
    const scale = 'atk';
    const magic = part.scale === 'mag';   // 旧データの魔法技は威力倍率で個性を維持
    const mastery = attacker.mastery?.[skill?.id] || 0;
    let power = (part.power || 100) * (1 + mastery*0.03);
    if (skill?.ultimate) power *= this.ultimateMultiplier(attacker, skill);
    if (magic) power *= 1.04;
    if (skill?.id === '__attack' || skill?.cat === '基本')
      power *= 1 + this.eff(attacker, 'normalAttackPower') / 100;
    if (skill?.element && skill.element !== 'none')
      power *= 1 + this.eff(attacker, `element_${skill.element}`) / 100;
    // 「地ならし」は地面を揺るがす全体攻撃。ボスに特に有効。
    if (skill?.special === 'すずそう' && defender === this.enemy && this.enemyDef.boss)
      power *= 1.65;
    // 命中・回避は基本ステータスではなく内部の特殊効果値で処理する
    const hitChance = clamp(this.stat(attacker,'hit') - this.stat(defender,'dodge')*0.55 + 10, 40, 99);
    if (!part.trueHit && !pct(hitChance)) {
      this.log(`${attacker.name} の攻撃は外れた！`, 'miss');
      this.fx({ type:'miss', side:sideKey });
      return 0;
    }
    const critRate = clamp(this.stat(attacker,'crit'), 0, 95);
    const crit = pct(critRate);
    const eMul = this.elementMult(skill?.element || part.element || 'none', defender.element);
    // 防御力が高いほど被ダメージが減る（物理・魔法共通）
    const pierce = Math.min(0.85, (part.pierce || 0) + this.eff(attacker,'ignoreDef')/100);
    const def = this.stat(defender, 'def') * (1 - pierce);
    const mit = 100 / (100 + Math.max(0,def) * 0.85);
    const buffAtk = 1 + (this.eff(attacker,'firstStrike') && this.turn === 1 ? 0.2 : 0);
    let dmg = this.stat(attacker, scale) * (power/100) * rnd(0.92,1.08) * mit * eMul * buffAtk;
    if (crit) dmg *= 1.65 + this.eff(attacker,'critDamage')/100;
    if (defender.guard) dmg *= 0.42;
    dmg *= 1 - Math.min(0.5, this.eff(defender,'damageCut')/100);
    // 攻撃時の追加ダメージ（複数ヒット時は分割して過剰にならないようにする）
    const flat = this.eff(attacker, 'extraDamage');
    if (flat) dmg += Math.max(1, Math.round(flat / (part.hits || 1)));
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
    if (skill.enemyMove) this.log(`✦ 専用技発動：${skill.enemyMove.desc}`, 'enemyAct');
    if (skill.special === 'すずそう') this.log('🌍 大地が唸り、戦場全体が揺れた！（ボスに特大ダメージ）', 'crit');
    if (skill.special === '河岡') this.log('💠 味方全体に大きな加護が満ち、敵へ光が走る！', 'buff');
    if (skill.ultimate) {
      this.log(`✦ 奥義発動！ ${skill.name} ✦`, 'crit');
      this.fx({ type:'ultimate', side:aKey, name:skill.name, element:skill.element || 'star',
        special:skill.special || '', job:actor.job });
      await this.delay(300); // 豪華だが短く（テンポを落とさない）
    } else {
      this.fx({ type:'skill', side:aKey, name:skill.name, fx:skill.fx || 'slash',
        element:skill.element || 'none', move: skill.enemyMove || null });
    }
    await this.delay(360);

    if (actor.statuses.some(s => s.id === 'confuse') && pct(35)) {
      const self = Math.round(actor.maxHp*0.05);
      actor.hp = Math.max(0, actor.hp - self);
      this.log(`${actor.name} は混乱して自らを傷つけた（${self}）`, 'status');
      this.fx({ type:'damage', side:aKey, value:self, fx:'dark' });
      await this.delay(250);
      return;
    }

    const parts = skill.parts || [{op:'damage',power:skill.power||100,scale:'atk',hits:1}];
    const specialBoost = skill.special ? 1 + charRankIndex(this.char.rarity) * 0.22 : 1;
    for (const rawPart of parts) {
      const part = specialBoost !== 1 && ['heal','buff','shield','restoreMp'].includes(rawPart.op)
        ? { ...rawPart, power:rawPart.power ? Math.round(rawPart.power*specialBoost) : rawPart.power,
            amount:rawPart.amount ? Math.round(rawPart.amount*specialBoost) : rawPart.amount } : rawPart;
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
          const v = Math.round((this.stat(actor,'mp') * 0.45 + this.stat(actor,'atk') * 0.35)
            * (part.power||100)/100 * rnd(0.95,1.08) + 18);
          actor.hp = Math.min(actor.maxHp, actor.hp + v);
          this.log(`${actor.name} のHPが ${v} 回復`, 'heal');
          this.fx({ type:'heal', side:aKey, value:v });
          break;
        }
        case 'restoreMp': actor.mp = Math.min(actor.maxMp, actor.mp + (part.amount||10)); this.log(`${actor.name} のMPが回復`, 'buff'); break;
        case 'drainMp': target.mp = Math.max(0, target.mp - (part.amount||10)); this.log(`${target.name} のMPを奪った`, 'status'); break;
        case 'buff': {
          const who = part.target === 'self' ? actor : target;
          const key = coreStatKey(part.stat);
          who.buffs.push({ stat:key, amount:part.amount, dur:part.dur||3, pct:true });
          this.log(`${who.name} の${effectStatName(key)}が上昇`, 'buff');
          this.fx({ type:'buff', side:who===this.player?'player':'enemy' });
          break;
        }
        case 'debuff': {
          const key = coreStatKey(part.stat);
          target.buffs.push({ stat:key, amount:-Math.abs(part.amount), dur:part.dur||3, pct:true });
          this.log(`${target.name} の${effectStatName(key)}が低下`, 'status');
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
          this.dealDamage(actor, target, {power:part.power||120, scale:'atk', hits:1}, {...skill, element:'star'});
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
    this.cancelAuto();   // 手動操作と AUTO が同じターンを二重に進めない
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
      if (sk.ultimate && !this.canUseUltimate(sk)) {
        this.log(`奥義ゲージが足りません（${Math.floor(this.ultimateGauge)} / ${ULTIMATE_GAUGE_MAX}）`, 'miss');
        this.phase = 'player'; this.changed(); return;
      }
      if (this.player.mp < (sk.mp||0)) { this.log('MPが足りません', 'miss'); this.phase='player'; this.changed(); return; }
      if (sk.ultimate) {
        this.ultimateGauge = 0;                       // 連続使用不可
        this.player.cds[sk.id] = Math.max(sk.cd || 0, 3);
        this.log(`奥義ゲージを消費（0 / ${ULTIMATE_GAUGE_MAX}）`, 'system');
      }
      await this.resolveAction(this.player, this.enemy, sk);
    }
    if (this.enemy.hp <= 0 || this.player.hp <= 0) { await this.finish(this.enemy.hp <= 0); return; }
    this.ultimateGauge = Math.min(ULTIMATE_GAUGE_MAX, this.ultimateGauge + ULTIMATE_GAUGE_HIT_GAIN);
    await this.enemyTurn();
    if (this.finished) return;
    if (this.enemy.hp <= 0 || this.player.hp <= 0) { await this.finish(this.enemy.hp <= 0); return; }
    this.turn++;
    this.phase = 'player';
    if (!await this.tickTurn(this.player)) return;
    this.log(`── ターン ${this.turn} ──`, 'system');
    this.changed();
    this.queueAuto(420);
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
    const usable = this.actionList(this.enemy)
      .filter(s => s && (s.mp || 0) <= this.enemy.mp && (this.enemy.cds[s.id] || 0) === 0);
    let pick = null;
    const lowHp = this.hpPct(this.enemy) < 38;
    const special = usable.find(s => s.enemyMove);
    if (lowHp) pick = usable.find(s => s.parts?.some(p => p.op === 'heal' || p.op === 'summon'));
    if (!pick && this.turn <= 2) pick = usable.find(s => s.parts?.some(p => p.op === 'buff' || p.op === 'shield'));
    // 専用技は 3 ターンごと / 劣勢 / プレイヤーにとどめを刺せる場面で優先
    if (!pick && special && (this.turn % 3 === 0 || lowHp || this.hpPct(this.player) < 45)) pick = special;
    if (!pick) {
      const damaging = usable.filter(s => s.parts?.some(p => p.op === 'damage' || p.op === 'summon'));
      pick = damaging.sort((a,b)=> (b.power||0)*(b.parts?.[0]?.hits||1) - (a.power||0)*(a.parts?.[0]?.hits||1))[Math.min(1, damaging.length-1)] || usable[0];
    }
    pick = pick || basicAttack();
    await this.resolveAction(this.enemy, this.player, pick);
  }

  /* ---------- AUTO ---------- */
  async autoStep() {
    if (this.finished || this.phase !== 'player' || !this.autoMode) return;
    const list = this.actionList(this.player).filter(s => s.usable && s.id !== '__attack');
    let choice = '__attack';
    const healItem = this.usableItems().find(i => i.battle?.op === 'heal' || i.battle?.op === 'full');
    const healSkill = list.find(s => s.parts?.some(p => p.op === 'heal'));
    const finisher = this.autoUltimate
      ? list.find(s => s.ultimate && this.canUseUltimate(s)) : null;
    const score = s => (s.power || 0) * (s.parts?.[0]?.hits || 1)
      * (s.ultimate ? 1.6 : 1) * (1 + (this.eff(this.player, `element_${s.element}`) || 0) / 300);
    const damaging = list.filter(s => s.parts?.some(p => p.op === 'damage' || p.op === 'summon') || s.power)
      .sort((a,b) => score(b) - score(a));
    if (this.hpPct(this.player) < 35 && healItem) choice = '__item:' + healItem.id;
    else if (this.hpPct(this.player) < 50 && healSkill) choice = healSkill.id;
    else if (finisher) choice = finisher.id;                    // 設定に応じて奥義を自動使用
    else if (this.hpPct(this.player) < 25 && !healItem && !healSkill) choice = '__guard';
    else if (this.mpPct(this.player) < 18 && damaging.length === 0) choice = '__guard';
    else if (damaging.length) choice = damaging[0].id;
    else if (list.length) choice = list[0].id;
    await this.act(choice);
  }
  toggleAuto() {
    this.autoMode = !this.autoMode;
    this.state.settings.autoOn = this.autoMode;
    if (!this.autoMode) { this.cancelAuto(); this.autoSpeed = 1; this.state.settings.autoSpeed = 1; }
    this.log(this.autoMode ? 'AUTO：ON' : 'AUTO：OFF（通常速度）', 'system');
    this.changed();
    this.queueAuto(350);
  }
  setAutoSpeed(n) {
    this.autoSpeed = clamp(Number(n) || 1, 1, 3);
    this.state.settings.autoSpeed = this.autoSpeed;
    this.log(`AUTO 戦闘速度：${this.autoSpeed}倍速`, 'system');
    this.changed();   // 戦闘は停止しない。次の delay から反映される
  }
  setAutoUltimate(on) {
    this.autoUltimate = !!on;
    this.state.settings.autoUltimate = !!on;
    this.log(`AUTO 奥義自動使用：${on ? 'ON' : 'OFF'}`, 'system');
    this.changed();
  }

  /* ---------- 決着 ---------- */
  async finish(won) {
    if (this.finished) return;
    this.finished = true; this.phase = 'end'; this.autoMode = false; this.autoPending = false; this.cancelAuto();
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

/** 敵 1 種類の move 定義を、戦闘エンジンが実際に解決できる技へ変換する */
export function buildEnemyMoveSkill(mv) {
  if (!mv || !mv.id) return null;
  const parts = [{
    op:'damage', power: mv.power || 100, scale:'atk', hits: mv.hits || 1,
    trueHit: !!mv.trueHit, drain: Number(mv.drain) || 0,
  }];
  if (mv.status) parts.push({ op:'status', status:mv.status, chance:42, dur:2 });
  if (Number(mv.debuff)) parts.push({ op:'debuff', stat:'def', amount:Math.abs(Number(mv.debuff)), dur:2 });
  if (Number(mv.selfBuff)) parts.push({ op:'buff', stat:'atk', amount:Math.abs(Number(mv.selfBuff)), dur:2, target:'self' });
  return {
    id: mv.id, name: mv.name, mp:0, cd:2,
    element: mv.element || 'none', cat:'専用技', power: mv.power || 100,
    desc: mv.desc || '', fx: mv.motion || 'slash',
    enemyMove: mv, parts,
  };
}

function sfxUltimate() {
  try {
    const w = globalThis.window;
    const Ctx = w && (w.AudioContext || w.webkitAudioContext);
    if (!Ctx || !w.__OCF_ULTIMATE_SFX__) return;
    w.__OCF_ULTIMATE_SFX__();
  } catch (err) { /* 音が出せない環境では無視 */ }
}

function effectStatName(k) {
  return STAT_NAMES[k] || ({ hit:'命中', dodge:'回避', crit:'会心' })[k] || k;
}

function basicAttack() {
  return { id:'__attack', name:'通常攻撃', mp:0, cd:0, element:'none', cat:'基本', power:100,
    parts:[{op:'damage',power:100,scale:'atk',hits:1}], fx:'slash', desc:'MPを消費しない基本攻撃' };
}
