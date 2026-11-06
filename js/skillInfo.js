/* ============================================================
   技情報の一元管理 / SINGLE SOURCE OF SKILL INFO
   ------------------------------------------------------------
   すべての技選択・技確認画面は、このモジュールの skillInfo() /
   skillBadge() / skillDetailHTML() だけを参照する。
   画面側に「威力 ○○」「MP ○○」のような数値を直書きしない。

   数値の出所（固定のダミー数値は一切使わない）
   ・攻撃力 / 回復量 / 効果量 … SKILL[id].parts の各 op.power（× hits）
     └ js/battle.js の resolveAction()/dealDamage() が実際に使う値と同じ。
       一部の特殊技・奥義は top-level の sk.power が 0 なので、
       sk.power ではなく必ず parts から算出する。
   ・消費 MP … SKILL[id].mp（js/battle.js が actor.mp -= (skill.mp||0) で消費）
     └ MP 0 の技も「MP：0」と明示する。
   ・通常攻撃 … js/battle.js の basicAttack() と同じ power 100 / mp 0。
   ・敵の専用技 … js/battle.js の buildEnemyMoveSkill() をそのまま使う。

   これは表示専用の改善であり、技威力・MP・習得条件・戦闘計算・
   AUTO の選択ロジック・セーブデータは 1 つも変更しない。
   ============================================================ */
import { SKILL, ELEMENTS, ENEMIES, STAT_NAMES } from './data.js?v=2';
import { ENEMY_KINDS } from './enemyAssets.js?v=2';
import { fmt, computeStats, activeChar, buildEnemyCombatant } from './state.js?v=2';
import { buildEnemyMoveSkill } from './battle.js?v=2';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/** js/battle.js の basicAttack() と完全一致する通常攻撃の情報 */
export const BASIC_ATTACK = Object.freeze({
  id:'__attack', name:'通常攻撃', mp:0, cd:0, element:'none', cat:'基本',
  power:100, parts:[{ op:'damage', power:100, scale:'atk', hits:1 }],
  desc:'MPを消費しない基本攻撃',
});

/* 敵の専用技を「同じ生成器」から引くための台帳（SKILL には入っていない） */
const ENEMY_MOVE_BY_ID = new Map(
  (ENEMY_KINDS || []).filter(k => k?.move?.id).map(k => [k.move.id, k.move]));

/** 技 ID → 技データ。通常技・通常攻撃・敵専用技のすべてをここで解決する */
export function resolveSkill(id, fallback = null) {
  if (!id) return fallback;
  if (id === BASIC_ATTACK.id) return BASIC_ATTACK;
  if (SKILL[id]) return SKILL[id];
  const mv = ENEMY_MOVE_BY_ID.get(id);
  if (mv) return buildEnemyMoveSkill(mv);
  return fallback;
}

const STAT_LABEL = { ...STAT_NAMES, mag:'魔力', spd:'素早さ', hit:'命中',
  eva:'回避', dodge:'回避', crit:'会心', acc:'命中' };
const STATUS_LABEL = { poison:'毒', burn:'火傷', freeze:'凍結', paralysis:'麻痺',
  sleep:'睡眠', confuse:'混乱', curse:'呪い', regen:'再生', blind:'暗闇', stun:'気絶' };
const statLabel = k => STAT_LABEL[k] || k || '能力';
const statusLabel = k => STATUS_LABEL[k] || k || '状態異常';
const n = v => fmt(Number(v) || 0);

/**
 * 技 1 件の表示用情報を、実際の技データ（parts / mp）から導出する。
 * 戻り値は全画面共通。数値を画面側で上書きしてはならない。
 */
export function skillInfo(sk) {
  const s = sk || {};
  const parts = (Array.isArray(s.parts) && s.parts.length)
    ? s.parts
    : [{ op:'damage', power:Number(s.power) || 100, scale:'atk', hits:1 }];
  const mp = Math.max(0, Number(s.mp) || 0);          // 0 も 「MP：0」 として残す
  let power = 0, basePower = 0, hits = 0, heal = 0;
  const targets = new Set();
  const effects = [];      // 技の効果（本文向け・やや丁寧）
  const extras = [];       // 追加効果（本文向け）
  const shorts = [];       // バッジ向けの短い効果ラベル

  for (const p of parts) {
    const pv = Number(p.power) || 0;
    const h = Math.max(1, Number(p.hits) || 1);
    switch (p.op) {
      case 'damage':
      case 'summon': {
        const real = pv || (p.op === 'summon' ? 120 : 100);   // battle.js の || フォールバックと同じ
        power += real * h;
        hits += h;
        if (!basePower) basePower = real;
        targets.add('enemy');
        effects.push(p.op === 'summon'
          ? `星の力で召喚攻撃（威力 ${n(real)}）`
          : `敵に威力 ${n(real)} の打撃を ${h} 回繰り出す`);
        if (p.trueHit) extras.push('必中：回避されません');
        if (Number(p.pierce)) extras.push(`相手の防御を ${Math.round(Number(p.pierce) * 100)}% 無視`);
        if (Number(p.drain)) extras.push(`与えたダメージの ${Math.round(Number(p.drain) * 100)}% を吸収`);
        break;
      }
      case 'heal': {
        const real = pv || 100;
        heal += real;
        targets.add('self');
        effects.push(`自分のHPを回復（回復威力 ${n(real)}）`);
        break;
      }
      case 'restoreMp': {
        const a = Number(p.amount) || 10;
        targets.add('self');
        extras.push(`自分のMPを ${n(a)} 回復`); shorts.push(`MP+${n(a)}`); break;
      }
      case 'drainMp': {
        const a = Number(p.amount) || 10;
        targets.add('enemy');
        extras.push(`相手のMPを ${n(a)} 奪う`); shorts.push(`敵MP-${n(a)}`); break;
      }
      case 'buff': {
        const a = Number(p.amount) || 0;
        targets.add(p.target === 'self' ? 'self' : 'enemy');
        extras.push(`${p.target === 'self' ? '自分' : '相手'}の${statLabel(p.stat)}を +${n(a)}%（${Number(p.dur)||3}ターン）`);
        shorts.push(`${statLabel(p.stat)}+${n(a)}%`); break;
      }
      case 'debuff': {
        const a = Math.abs(Number(p.amount) || 0);
        targets.add('enemy');
        extras.push(`相手の${statLabel(p.stat)}を -${n(a)}%（${Number(p.dur)||3}ターン）`);
        shorts.push(`敵${statLabel(p.stat)}-${n(a)}%`); break;
      }
      case 'status': {
        const chance = p.chance === undefined ? 100 : Number(p.chance);
        targets.add(p.target === 'self' ? 'self' : 'enemy');
        extras.push(`${p.target === 'self' ? '自分' : '相手'}に${statusLabel(p.status)}を付与（成功 ${n(chance)}%）`);
        shorts.push(`${statusLabel(p.status)}付与`); break;
      }
      case 'shield': {
        const a = Number(p.amount) || 60;
        targets.add('self');
        extras.push(`バリアを ${n(a)} 張る`); shorts.push(`バリア+${n(a)}`); break;
      }
      case 'counter': {
        const a = Number(p.amount) || 1;
        targets.add('self');
        extras.push(`反撃の構え（受けたダメージの ×${a} を跳ね返す）`);
        shorts.push(`反撃×${a}`); break;
      }
      case 'cleanse':
        targets.add('self');
        extras.push('自分の状態異常を解除'); shorts.push('状態解除'); break;
      case 'drainSelf': {
        const r = Number(p.ratio) || 0.15;
        targets.add('self');
        extras.push(`代償として最大HPの ${Math.round(r * 100)}% を失う`);
        shorts.push(`HP-${Math.round(r*100)}%`); break;
      }
      default: break;
    }
  }

  const kind = power > 0 ? (heal > 0 ? 'mixed' : 'attack')
    : (heal > 0 ? 'heal' : 'support');
  const isArea = /範囲|全体/.test(String(s.cat || ''));
  const targetBase = (targets.has('enemy') && targets.has('self')) ? '敵単体・自分'
    : targets.has('enemy') ? '敵単体'
    : targets.has('self') ? '自分' : '対象なし';
  if (isArea) effects.push('範囲攻撃の演出がありますが、戦闘では敵 1 体に命中します');
  const targetText = (hits > 1 ? `${targetBase}（${hits}連撃）` : targetBase)
    + (isArea ? '（範囲攻撃）' : '');
  const shortEffect = shorts.length
    ? shorts[0] + (shorts.length > 1 ? ` 他${shorts.length - 1}` : '')
    : (kind === 'support' ? (s.cat || '補助') : '—');
  const el = ELEMENTS[s.element] || ELEMENTS.none;
  return {
    id:s.id || '', name:s.name || '技', cat:s.cat || '技',
    element:s.element || 'none', elementName:el?.name || '無',
    elementColor:el?.color || '#9bb4d8',
    desc:s.desc || '', mp, cd:Number(s.cd) || 0,
    kind, power, basePower, hits, heal, effectShort:shortEffect,
    targetText,
    effects, extras, parts,
    ultimate: !!s.ultimate, special: !!s.special,
  };
}

/** 技固有の威力と「実際に出そうなダメージ」を分けて算出する表示専用の目安。
    戦闘計算そのものには一切影響しない（dealDamage と同じ基礎式だけを使う）。 */
export function predictDamage(sk, ctx) {
  const info = skillInfo(sk);
  if (!info.power || !ctx || !Number.isFinite(Number(ctx.atk))) return null;
  const atk = Math.max(1, Number(ctx.atk));
  const def = Math.max(0, Number(ctx.def) || 0);
  const mastery = Math.max(0, Number(ctx.mastery) || 0);
  const masteryMul = 1 + mastery * 0.03;                  // battle.js の熟練補正
  const mit = 100 / (100 + def * 0.85);                    // battle.js の防御軽減
  return Math.max(1, Math.round(atk * (info.power * masteryMul / 100) * mit));
}

/** 予測ダメージの小さい表示（会心・属性・バフ・乱数は含めない目安） */
export function skillForecastHTML(sk, ctx) {
  const d = predictDamage(sk, ctx);
  if (d === null) return '';
  return `<span class="sk-forecast">予測ダメージ：<b>約 ${n(d)}</b><small>（会心・属性・バフ除く目安）</small></span>`;
}

/** 技名の横に並べるコンパクトなバッジ。全画面でこの 1 関数だけを使う。
    例）炎の斬撃　⚔ 攻撃力：250　✦ MP：30 */
export function skillBadge(sk, opts = {}) {
  if (!sk) return '';
  const i = skillInfo(sk);
  const out = [];
  if (i.power > 0) {
    const multi = i.hits > 1
      ? `<em>（${n(i.basePower)}×${i.hits}）</em>` : '';
    out.push(`<span class="sk-metric sk-power" title="技固有の威力・戦闘計算の基準値（熟練度・会心などの補正前）"><span class="sk-ico" aria-hidden="true">⚔</span>攻撃力：<b>${n(i.power)}</b>${multi}</span>`);
  }
  if (i.heal > 0)
    out.push(`<span class="sk-metric sk-heal" title="回復技の威力・実際の回復量はステータスで変動"><span class="sk-ico" aria-hidden="true">✚</span>回復量：<b>${n(i.heal)}</b></span>`);
  if (i.power === 0 && i.heal === 0)
    out.push(`<span class="sk-metric sk-effect" title="補助技の効果量"><span class="sk-ico" aria-hidden="true">✧</span>効果：<b>${esc(i.effectShort)}</b></span>`);
  out.push(`<span class="sk-metric sk-mp" title="実際に消費するMP"><span class="sk-ico" aria-hidden="true">✦</span>MP：<b>${n(i.mp)}</b></span>`);
  if (opts.cd !== false && i.cd > 0)
    out.push(`<span class="sk-metric sk-cd"><span class="sk-ico" aria-hidden="true">⟳</span>CD：<b>${n(i.cd)}</b></span>`);
  return `<span class="skill-metrics" aria-label="${esc(i.name)} の技情報">${out.join('')}</span>`;
}

/** クリック／タップで詳細を開く小さい ⓘ ボタン（入れ子にならない場所で使う） */
export function skillInfoButton(id, label = 'ⓘ') {
  if (!id) return '';
  return `<button type="button" class="sk-info-btn" data-action="skillInfo" data-skill="${esc(id)}" title="技の詳細を見る" aria-label="技の詳細を見る">${esc(label)}</button>`;
}

/** 技名 ＋ バッジ ＋ 詳細ボタン。技一覧の共通行 */
export function skillHead(sk, opts = {}) {
  if (!sk) return '';
  return `<span class="sk-head"><b class="sk-name">${esc(sk.name)}</b>${skillBadge(sk, opts)}${opts.info === false ? '' : skillInfoButton(sk.id)}</span>`;
}

/** 技詳細・AUTO確認・戦闘前確認で使う 1 行（全情報が同じ source から出る） */
export function skillInfoLine(sk, opts = {}) {
  if (!sk) return '';
  const i = skillInfo(sk);
  return `<div class="skill-info-line">${skillHead(sk, { ...opts, cd:false })}
    <small>${esc(i.cat)} ／ 対象 ${esc(i.targetText)}${i.cd ? ` ／ 再使用 ${n(i.cd)} ターン` : ''}${i.desc ? ` ／ ${esc(i.desc)}` : ''}</small>
    ${skillForecastHTML(sk, opts.ctx)}</div>`;
}

/** 初心者にも分かる短い詳細（クリック／タップで表示） */
export function skillDetailHTML(sk, opts = {}) {
  if (!sk) return '';
  const i = skillInfo(sk);
  const ctx = opts.ctx || null;
  const forecast = predictDamage(sk, ctx);
  const valueLabel = i.kind === 'heal' ? '回復量'
    : i.kind === 'support' ? '効果量' : '攻撃力';
  const valueText = i.kind === 'heal' ? `回復量：${n(i.heal)}`
    : i.kind === 'support' ? `効果：${i.effectShort}`
    : i.kind === 'mixed' ? `攻撃力：${n(i.power)} ／ 回復量：${n(i.heal)}`
    : `攻撃力：${n(i.power)}${i.hits > 1 ? `（${n(i.basePower)} × ${i.hits} 連撃）` : ''}`;
  const rows = [
    ['技の名前', `<b class="sd-name">${esc(i.name)}</b>`],
    ['種別', `<b>${esc(i.cat)}</b> <span class="sd-element" style="--sdc:${esc(i.elementColor)}">${esc(i.elementName)}属性</span>`],
    [valueLabel, `<b>${esc(valueText)}</b>`],
    ['消費MP', `<b class="sd-mp">MP：${n(i.mp)}</b>`],
    ['攻撃対象', `<b>${esc(i.targetText)}</b>`],
  ];
  if (forecast !== null)
    rows.push(['予測ダメージ', `<b class="sd-forecast">約 ${n(forecast)}</b><small> ／ ${esc(ctx?.label || '現在の戦闘')}</small>`]);
  if (i.cd) rows.push(['再使用まで', `<b>${n(i.cd)} ターン</b>`]);
  return `<div class="skill-detail">
    <div class="sd-title"><span class="sd-kicker">SKILL DETAIL / 技の詳細</span>
      <h3>${esc(i.name)}</h3>${skillBadge(sk, { cd:false })}</div>
    <div class="sd-grid">${rows.map(([k, v]) => `<div class="sd-row"><span>${esc(k)}</span><div>${v}</div></div>`).join('')}</div>
    <h4>技の効果</h4>
    <p class="sd-desc">${esc(i.desc || (i.effects[0] || '—'))}</p>
    ${i.effects.length ? `<ul class="sd-list">${i.effects.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <h4>追加効果</h4>
    ${i.extras.length ? `<ul class="sd-list sd-extra">${i.extras.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
      : '<p class="sd-none">追加効果はありません</p>'}
    <div class="hint-box small sd-note">⚔ <b>${esc(valueLabel)}</b>は技に固有の威力（戦闘計算の基準値）です。実際に出るダメージは使うキャラの攻撃力・相手の防御力・属性相性・熟練度・会心・バフで変わります。回復量もステータスで変動します。消費MPは表示どおり実際に消費されます。</div>
  </div>`;
}

/* ---------------- 予測ダメージの文脈（全画面共通） ---------------- */
export function selectedSkillCheckEnemy(app) {
  return ENEMIES.find(x => x.id === app?.skillCheckEnemy) || ENEMIES[0] || null;
}
/** 戦闘前の技確認で使う「自キャラの攻撃力」と「相手の防御力」 */
export function skillCheckContext(app, s) {
  const c = activeChar(s);
  if (!c) return null;
  const en = selectedSkillCheckEnemy(app);
  const ps = computeStats(c, s) || {};
  const es = en ? buildEnemyCombatant(en) : { def:0 };
  return { atk:Number(ps.atk) || 0, def:Number(es.def) || 0, mastery:0,
    enemy:en, label:en ? `${en.name}（防御 ${n(es.def || 0)}）` : '標準的な相手' };
}
/** 詳細モーダルの文脈。戦闘中は実際の敵、その他は技確認の選択相手を使う */
export function forecastContext(app, s, skillId) {
  if (app?.screen === 'battle' && app.battle) {
    const b = app.battle;
    try {
      const atk = b.stat(b.player, 'atk');
      const def = b.stat(b.enemy, 'def');
      const mastery = Number(b.player?.mastery?.[skillId]) || 0;
      return { atk, def, mastery, label:`${b.enemy?.name || '相手'}（防御 ${n(def)}）` };
    } catch (_) { /* 戦闘終了直後などは下の共通文脈へ */ }
  }
  return skillCheckContext(app, s);
}

/** renderScreen() の末尾に 1 つだけ差し込む詳細モーダル */
export function skillDetailModal(app, s) {
  const id = app?.skillDetail;
  if (!id) return '';
  const sk = resolveSkill(id);
  if (!sk) return '';
  const ctx = forecastContext(app, s, id);
  return `<div class="modal-backdrop skill-detail-backdrop" data-action="skillInfoClose" data-backdrop="1">
    <div class="modal-card skill-detail-modal" role="dialog" aria-modal="true" aria-label="技の詳細">
      <button type="button" class="modal-close" data-action="skillInfoClose" aria-label="閉じる">✕</button>
      ${skillDetailHTML(sk, { ctx })}
      <div class="row-btns mt"><button type="button" class="btn btn-ghost btn-mini" data-action="skillInfoClose">閉じる</button></div>
    </div></div>`;
}

/** 戦闘前 / AUTO で使う技の確認画面（数値はすべて skillInfo() 由来） */
export function skillCheckScreenData(app, s) {
  const c = activeChar(s);
  if (!c) return null;
  const ctx = skillCheckContext(app, s);
  const equipped = (c.equippedSkills || []).map(id => SKILL[id]).filter(Boolean);
  const all = [BASIC_ATTACK, ...equipped];
  // AUTO の候補は装備中の全技（攻撃・回復・補助・奥義）。Battle.autoStep() と同じ母集合。
  const auto = equipped;
  return { c, ctx, all, equipped, auto };
}
