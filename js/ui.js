// ============ 共通UI・ルーター ============
import { el, $, fmt, bus, pct } from './util.js';
import { S, activeChar, charStats, charPower, regenStamina, STAM_MAX, persist, STAT_NAME, allocate } from './state.js';
import { JOB_MAP } from './data/jobs.js';
import { SKILL_MAP, ELEMENTS, skillDesc, CAT_NAME } from './data/skills.js';
import { RARITY, SLOTS, equipStat, equipPower } from './data/equipment.js';
import { ITEM_MAP } from './data/items.js';
import { rankOf } from './data/meta.js';
import { sfx, playBGM } from './audio.js';

const screens = {};
let current = null;
export function register(name, fn){ screens[name]=fn; }
export async function go(name, params={}){
  const app = $('#app');
  const fn = screens[name];
  if (!fn){ console.error('unknown screen', name); return; }
  current = name;
  app.innerHTML='';
  const node = await fn(params);
  app.append(node);
  bus.emit('screen', name);
}
export function currentScreen(){ return current; }

// ---- トップバー ----
export function topbar(title){
  regenStamina();
  const rank = rankOf(S.rp);
  const coins = el('span',{class:'res coins', title:'コイン'}, el('span',{class:'ico'},'🪙'), el('b',{},fmt(S.coins)));
  const points = el('span',{class:'res points', title:'対戦ポイント'}, el('span',{class:'ico'},'🏆'), el('b',{},fmt(S.points)));
  const rp = el('span',{class:'res rp', title:`ランク: ${rank.name}`}, el('span',{class:'ico'},rank.ico), el('b',{},fmt(S.rp)));
  const stam = el('span',{class:'res stam', title:'スタミナ(2分に1回復)'}, el('span',{class:'ico'},'⚡'), el('b',{},`${S.stamina}/${STAM_MAX}`));
  const bar = el('div',{class:'topbar'},
    el('span',{class:'tb-title'}, title), coins, points, rp, stam,
    el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{sfx('click');go('hub');}},'🏠 拠点'));
  const update = ()=>{
    if (!document.body.contains(bar)) return;
    regenStamina();
    coins.querySelector('b').textContent = fmt(S.coins);
    points.querySelector('b').textContent = fmt(S.points);
    rp.querySelector('b').textContent = fmt(S.rp);
    stam.querySelector('b').textContent = `${S.stamina}/${STAM_MAX}`;
  };
  bus.on('state:changed', update);
  return bar;
}

// ---- 下部ナビ ----
export function bottomNav(active){
  const items = [
    ['hub','🏠','拠点'], ['hall','🔮','育成'], ['forge','⚒️','工房'],
    ['dojo','⛩️','修行'], ['guild','⚔️','ギルド'], ['shop','🧪','道具屋'],
    ['codex','📖','図鑑'],
  ];
  return el('div',{class:'bottom-nav'},
    items.map(([id,ico,label])=>el('button',{class:active===id?'on':'', onclick:()=>{sfx('click');go(id);}},
      el('span',{class:'ni'},ico), label)));
}

// ---- 施設スクリーン枠 ----
export function facilityScreen({bg, title, sub, active, body}){
  return el('div',{class:'screen'},
    el('div',{class:'screen-bg', style:{backgroundImage:`url(assets/bg/${bg}.jpg)`}}),
    topbar(title),
    el('div',{class:'facility-hero'}, el('h2',{},title), el('p',{},sub)),
    el('div',{class:'screen-body'}, body),
    bottomNav(active),
  );
}

// ---- モーダル ----
export function modal(content, {wide=false, onClose=null}={}){
  const root = $('#modal-root');
  const veil = el('div',{class:'modal-veil'});
  const box = el('div',{class:'modal'+(wide?' wide':'')},
    el('button',{class:'modal-close', onclick:()=>close()}, '✕'), content);
  veil.append(box);
  veil.addEventListener('click', e=>{ if(e.target===veil) close(); });
  root.append(veil);
  function close(){ veil.remove(); onClose&&onClose(); }
  return {close, box};
}
export function confirmModal(msg, onYes, {yes='はい', no='いいえ'}={}){
  const m = modal(el('div',{},
    el('h3',{},'確認'),
    el('p',{class:'center', style:{whiteSpace:'pre-wrap'}}, msg),
    el('div',{class:'modal-actions'},
      el('button',{class:'btn btn-gold', onclick:()=>{m.close();sfx('confirm');onYes();}}, yes),
      el('button',{class:'btn btn-ghost', onclick:()=>{m.close();sfx('cancel');}}, no))));
  return m;
}

// ---- トースト ----
export function toast(msg, type=''){
  const root = $('#toast-root');
  const t = el('div',{class:'toast '+type}, msg);
  root.append(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),320); }, 2600);
}
bus.on('achievement', a=>{ toast(`🏅 実績達成「${a.name}」`, 'gold'); sfx('rare'); });
bus.on('levelup', ({ch,ups})=>{
  sfx('levelup');
  const b = el('div',{class:'lvup-burst'}, el('span',{},`LEVEL UP!  Lv${ch.level}`));
  document.body.append(b); setTimeout(()=>b.remove(),1700);
});
bus.on('awaken', ({stage})=>{ sfx('awaken'); toast(`✨ ${stage.name} に覚醒した！`, 'gold'); });

// ---- キャラクターサマリー ----
export function charSummary(ch, {compact=false}={}){
  if (!ch) return el('div',{class:'empty-note'},'キャラクターがいません。作成しましょう！');
  const {stats} = charStats(ch);
  const j = JOB_MAP[ch.job];
  const hp = ch.hp==null?stats.hp:ch.hp, mp = ch.mp==null?stats.mp:ch.mp;
  const xpN = ch.level>=100?1:Math.max(1,require_xp(ch.level));
  return el('div',{class:'panel ornate'},
    el('div',{class:'char-head'},
      el('div',{class:'char-sprite-box'+(ch.awaken>0?' awakened':'')}, el('img',{class:'pixel', src:ch.sprite, alt:ch.name})),
      el('div',{style:{flex:'1',minWidth:'180px'}},
        el('div',{class:'char-name'}, ch.name),
        el('div',{class:'char-sub'},
          el('span',{class:'badge gold'},`Lv${ch.level}`),
          el('span',{class:'badge'},`${j.ico} ${j.name}`),
          ch.awaken>0?el('span',{class:'badge purple'},`覚醒${'壱弐参肆極'[ch.awaken-1]}`):null,
          ch.rebirth>0?el('span',{class:'badge red'},`転生${ch.rebirth}`):null),
        el('div',{class:'mt8'},
          barRow('HP', hp, stats.hp, 'hp'),
          barRow('MP', mp, stats.mp, 'mp'),
          barRow('XP', ch.level>=100?1:ch.xp, xpN, 'xp')),
      ),
      !compact?el('div',{class:'center'},
        el('div',{class:'txt-dim small'},'戦力'),
        el('div',{class:'num txt-gold', style:{fontSize:'24px'}}, fmt(charPower(ch)))):null,
    ));
}
function require_xp(lv){ return Math.round(40*Math.pow(lv,1.6)+60*lv); }
export function barRow(label, v, max, cls){
  return el('div',{style:{display:'flex',alignItems:'center',gap:'7px',margin:'3px 0'}},
    el('span',{style:{width:'26px',fontSize:'10px',fontWeight:'800',color:'#9aa3bd'}},label),
    el('div',{class:'bar '+cls, style:{flex:'1'}},
      el('i',{style:{width:pct(v,max)+'%'}}),
      el('span',{},`${fmt(v)} / ${fmt(max)}`)));
}

// ---- ステータスグリッド ----
export function statGrid(ch, {allocate:alloc=false}={}){
  const {stats, passives} = charStats(ch);
  const grid = el('div',{class:'stat-grid'});
  for (const k of ['hp','mp','atk','def','spd','mag','acc','eva']){
    const isPct = k==='acc'||k==='eva';
    grid.append(el('div',{class:'stat-row'},
      el('span',{class:'sn'}, STAT_NAME[k]),
      el('span',{class:'sv num'}, isPct?stats[k]+'%':fmt(stats[k])),
      el('span',{class:'sb txt-dim small'}, alloc?`振分:${ch.alloc[k]||0}`:''),
      alloc?el('button',{class:'stat-plus', disabled:ch.statPoints<1?'':null,
        onclick:()=>{ if(allocate(ch,k)){ sfx('confirm'); bus.emit('rerender'); } }},'+'):null));
  }
  return grid;
}

// ---- 装備行 ----
export function equipRow(eq, {onClick=null, right=null, showStats=true}={}){
  const r = RARITY[eq.rarity];
  const slot = SLOTS[eq.slot];
  const main = el('div',{class:'r-main'},
    el('div',{class:'r-name'}, el('span',{class:`rar-${eq.rarity}`},`${eq.name}${eq.lv>0?` +${eq.lv}`:''}`)),
    showStats?el('div',{class:'r-desc'}, equipStatLine(eq)):null);
  return el('div',{class:`row rar-border-${eq.rarity} rar-bg-${eq.rarity}`+(onClick?' clickable':''), onclick:onClick?()=>onClick(eq):null},
    el('span',{class:'r-ico'}, slot.ico), main,
    el('div',{class:'r-side'},
      el('span',{class:`rar-tag rar-${eq.rarity}`}, r.name),
      right||null));
}
export function equipStatLine(eq){
  const parts=[];
  for (const k of ['atk','mag','def','hp','mp','spd','acc','eva']){
    const v = equipStat(eq,k); if(v) parts.push(`${STAT_NAME[k]}+${v}${k==='acc'||k==='eva'?'%':''}`);
  }
  for (const e of eq.effects){ parts.push(`◆${e.key}`); }
  return parts.join(' / ');
}

// ---- 技チップ/行 ----
export function skillRow(id, {right=null, onClick=null, ch=null}={}){
  const s = SKILL_MAP[id]; if(!s) return el('span');
  const e = ELEMENTS[s.elem];
  const lv = ch?(ch.skillLv[id]||1):null;
  return el('div',{class:'row'+(onClick?' clickable':''), onclick:onClick?()=>onClick(s):null},
    el('span',{class:'r-ico', style:{color:e.color}}, e.ico),
    el('div',{class:'r-main'},
      el('div',{class:'r-name'}, s.name, lv?el('span',{class:'badge', style:{marginLeft:'6px'}},`Lv${lv}`):null,
        s.gauge?el('span',{class:'badge purple', style:{marginLeft:'4px'}},'必殺'):null),
      el('div',{class:'r-desc'}, skillDesc(s))),
    right?el('div',{class:'r-side'},right):null);
}

// ---- 空状態 ----
export const empty = msg => el('div',{class:'empty-note'}, msg);

// ---- 再描画ヘルパ ----
export function rerenderOn(fn){
  const h = ()=>fn();
  bus.on('rerender', h);
}
