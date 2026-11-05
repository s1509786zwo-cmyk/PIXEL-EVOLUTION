// ============ 武器・装備工房 ============
import { el, fmt, bus } from '../util.js?v=20261105b';
import { go, facilityScreen, charSummary, equipRow, equipStatLine, modal, toast, confirmModal, empty } from '../ui.js?v=20261105b';
import { S, activeChar, equipItem, unequipSlot, getEquip, doGacha, enhanceEquip, fuseEquips, sellEquip, persist, STAT_NAME } from '../state.js?v=20261105b';
import { JOB_MAP, WEAPON_TYPES } from '../data/jobs.js?v=20261105b';
import { RARITY, RARITIES, SLOTS, GACHA_RATES, GACHA_COST, GACHA_COST10, PITY_L, PITY_M, enhanceCost, MAX_ENHANCE, equipStat, equipPower, EFFECT_MAP } from '../data/equipment.js?v=20261105b';
import { ITEM_MAP } from '../data/items.js?v=20261105b';
import { sfx } from '../audio.js?v=20261105b';

export function renderForge(){
  const ch = activeChar();
  const body = el('div',{style:{maxWidth:'960px',margin:'0 auto'}});
  if(!ch) return facilityScreen({bg:'forge',title:'武器・装備工房',sub:'装備・ガチャ・強化・合成',active:'forge',body:empty('キャラクターを作成してください')});
  let tab='equip';
  const tabs=el('div',{class:'tabs'}), content=el('div',{});
  const TABS=[['equip','装備変更'],['gacha','ガチャ'],['enhance','強化'],['fuse','合成']];
  function render(){
    tabs.innerHTML='';content.innerHTML='';
    for(const [id,l] of TABS) tabs.append(el('button',{class:tab===id?'on':'',onclick:()=>{tab=id;sfx('click');render();}},l));
    content.append({equip:tabEquip,gacha:tabGacha,enhance:tabEnhance,fuse:tabFuse}[tab]());
  }
  bus.on('rerender',()=>{if(document.body.contains(body))render();});

  function tabEquip(){
    const j=JOB_MAP[ch.job];
    const slots=el('div',{class:'grid-cards'}, Object.keys(SLOTS).map(slot=>{
      const eq=getEquip(ch.equip[slot]);
      return el('div',{class:'equip-slot', onclick:()=>pickEquip(slot)},
        el('span',{class:'es-ico'},SLOTS[slot].ico),
        el('div',{class:'r-main'},
          el('div',{class:'r-name', style:{fontSize:'13px'}}, eq?el('span',{class:`rar-${eq.rarity}`},`${eq.name}${eq.lv?` +${eq.lv}`:''}`):el('span',{class:'txt-dim'},'未装備')),
          el('div',{class:'r-desc'}, eq?equipStatLine(eq):`${SLOTS[slot].name}スロット`)),
        eq?el('button',{class:'btn btn-sm btn-ghost', onclick:e=>{e.stopPropagation();unequipSlot(ch,slot);sfx('cancel');render();}},'外す'):null);
    }));
    const inv=S.equipment.filter(e=>!Object.values(ch.equip).includes(e.uid));
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'装備スロット'),
        el('p',{class:'hint mb8'},`装備可能な武器種: ${j.weapons.map(w=>WEAPON_TYPES[w].name).join('/')}`), slots),
      el('div',{class:'panel mt12'},
        el('div',{class:'flex-between'}, el('div',{class:'sec-title'},'所持装備'), el('span',{class:'badge'},`${S.equipment.length}個`)),
        inv.length?el('div',{class:'list'}, inv.sort((a,b)=>RARITIES.indexOf(b.rarity)-RARITIES.indexOf(a.rarity)).map(eq=>equipRow(eq,{
          onClick:()=>equipDetail(eq),
          right:[
            el('button',{class:'btn btn-sm btn-blue', onclick:e=>{e.stopPropagation();tryEquip(eq);}},'装備'),
            el('button',{class:'btn btn-sm btn-ghost', onclick:e=>{e.stopPropagation();confirmModal(`${eq.name} を売却しますか？(+${fmt(RARITY[eq.rarity].sell+eq.lv*40)}コイン)`,()=>{sellEquip(eq.uid);sfx('coin');render();});}},'売却')]}))):empty('装備がありません。ガチャを引きましょう！')));
  }
  function tryEquip(eq){
    if(eq.slot==='weapon'&&!JOB_MAP[ch.job].weapons.includes(eq.type)){toast(`この職業は${WEAPON_TYPES[eq.type].name}を装備できません`,'bad');return;}
    equipItem(ch,eq.uid);sfx('confirm');toast(`${eq.name} を装備した！`,'good');render();
  }
  function pickEquip(slot){
    const list=S.equipment.filter(e=>e.slot===slot);
    const m=modal(el('div',{}, el('h3',{},`${SLOTS[slot].name}を選択`),
      list.length?el('div',{class:'list'}, list.map(eq=>equipRow(eq,{onClick:()=>{
        if(eq.slot==='weapon'&&!JOB_MAP[ch.job].weapons.includes(eq.type)){toast('装備できない武器種です','bad');return;}
        equipItem(ch,eq.uid);sfx('confirm');m.close();render();}}))):empty('この部位の装備がありません')), {wide:true});
  }
  function equipDetail(eq){
    const lines=[];
    for(const k of ['atk','mag','def','hp','mp','spd','acc','eva']){const v=equipStat(eq,k);if(v)lines.push(`${STAT_NAME[k]} +${v}${k==='acc'||k==='eva'?'%':''}`);}
    modal(el('div',{},
      el('h3',{class:`rar-${eq.rarity}`},`${eq.name}${eq.lv?` +${eq.lv}`:''}`),
      el('div',{class:'center mb8'}, el('span',{class:`rar-tag rar-${eq.rarity}`},RARITY[eq.rarity].name), el('span',{class:'badge'},SLOTS[eq.slot].name), eq.type?el('span',{class:'badge'},WEAPON_TYPES[eq.type].name):null),
      el('div',{class:'list'}, lines.map(l=>el('div',{class:'row'},el('span',{class:'r-main r-name',style:{fontSize:'13px'}},l)))),
      eq.effects.length?el('div',{class:'mt12'}, el('div',{class:'sec-title'},'特殊効果'),
        el('div',{class:'list'}, eq.effects.map(e=>el('div',{class:'row'},el('span',{class:'r-ico'},'◆'),
          el('div',{class:'r-main'},el('div',{class:'r-name',style:{fontSize:'13px'}},EFFECT_MAP[e.key].name),el('div',{class:'r-desc'},EFFECT_MAP[e.key].desc.replace('{v}',e.val))))))):null,
      el('div',{class:'modal-actions'},
        el('button',{class:'btn btn-blue',onclick:()=>{document.querySelector('.modal-veil').remove();tryEquip(eq);}},'装備する'),
        el('button',{class:'btn btn-ghost',onclick:()=>{document.querySelector('.modal-veil').remove();tab='enhance';render();}},'強化へ'))));
  }

  function tabGacha(){
    const banner=(kind,title,desc)=>{
      const pity=S.pity[kind];
      return el('div',{class:'gacha-banner'},
        el('h4',{},title), el('p',{class:'txt-dim small mt8'},desc),
        el('div',{class:'pity-meter'},
          el('span',{},`天井まで: L+ ${Math.max(0,PITY_L-pity.l)}回 / M+ ${Math.max(0,PITY_M-pity.m)}回`),
          el('span',{},`累計 ${pity.total}回`)),
        el('div',{class:'flex mt12', style:{justifyContent:'center'}},
          el('button',{class:'btn btn-gold', onclick:()=>pull(kind,1)},`1回引く 🪙${fmt(GACHA_COST)}`),
          el('button',{class:'btn btn-gold', onclick:()=>pull(kind,10)},`10連 🪙${fmt(GACHA_COST10)} (E以上確定)`)),
        el('div',{class:'mt8'}, el('button',{class:'btn btn-sm btn-ghost', onclick:()=>ratesModal()},'排出確率を見る')));
    };
    return el('div',{},
      el('div',{class:'panel mb8'}, el('div',{class:'flex-between'}, el('span',{class:'sec-title',style:{margin:'0'}},'装備ガチャ'), el('span',{class:'res coins'},`🪙 ${fmt(S.coins)}`))),
      el('div',{class:'grid-cards'}, banner('weapon','⚔️ 武器ガチャ','剣・斧・槍・弓・銃・杖・特殊武器が排出'), banner('gear','🛡️ 装備ガチャ','防具・アクセサリー・装飾品が排出')),
      el('div',{class:'panel mt12'}, el('p',{class:'hint'},'※ゲーム内コインのみ使用します。実際のお金は一切かかりません。天井: '+PITY_L+'回以内にレジェンダリー以上、'+PITY_M+'回以内にミシック以上が確定。')));
  }
  function pull(kind,n){
    const res=doGacha(kind,n);
    if(!res){toast('コインが足りません','bad');sfx('cancel');return;}
    const best=res.reduce((a,e)=>RARITIES.indexOf(e.rarity)>RARITIES.indexOf(a)?e.rarity:a,'N');
    sfx(best==='S'?'secret':RARITIES.indexOf(best)>=3?'rare':'gacha');
    const grid=el('div',{class:'gacha-results'}, res.map((eq,i)=>el('div',{class:`gacha-item rar-border-${eq.rarity} rar-bg-${eq.rarity}`, style:{animationDelay:(i*0.07)+'s'}},
      el('div',{class:'gi-ico'},SLOTS[eq.slot].ico),
      el('div',{class:`gi-n rar-${eq.rarity}`},eq.name),
      el('div',{class:`gi-r rar-${eq.rarity}`},RARITY[eq.rarity].name))));
    modal(el('div',{}, el('h3',{},'ガチャ結果'), grid,
      el('div',{class:'modal-actions'}, el('button',{class:'btn btn-gold',onclick:()=>{document.querySelector('.modal-veil').remove();render();}},'受け取る'))), {wide:true});
  }
  function ratesModal(){
    modal(el('div',{}, el('h3',{},'排出確率'),
      el('div',{class:'list'}, GACHA_RATES.map(({r,rate})=>el('div',{class:'row'},
        el('span',{class:`rar-tag rar-${r}`},RARITY[r].name),
        el('span',{class:'r-main'}),
        el('span',{class:'num'},rate+'%')))),
      el('p',{class:'hint mt12'},`天井システム: ${PITY_L}回以内にレジェンダリー以上、${PITY_M}回以内にミシック以上が確定します。10連はエピック以上が1つ確定。`)));
  }

  function tabEnhance(){
    const list=S.equipment;
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'装備強化'),
        el('p',{class:'hint mb8'},`強化石とコインで装備を+1〜+${MAX_ENHANCE}まで強化。+11以上は上級強化石が必要。成功率100%。`),
        el('div',{class:'flex mb8'}, el('span',{class:'badge'},`🔩 強化石 ×${S.inventory.stone||0}`), el('span',{class:'badge'},`💎 上級強化石 ×${S.inventory.hi_stone||0}`), el('span',{class:'res coins'},`🪙 ${fmt(S.coins)}`)),
        list.length?el('div',{class:'list'}, list.map(eq=>{
          const c=enhanceCost(eq.lv);
          const maxed=eq.lv>=MAX_ENHANCE;
          return equipRow(eq,{right:[
            el('span',{class:'txt-dim small'}, maxed?'MAX':`🪙${fmt(c.coins)} ${c.stone?'🔩×'+c.stone:'💎×'+c.hiStone}`),
            el('button',{class:'btn btn-sm btn-green', disabled:maxed?'':null, onclick:()=>{
              const r=enhanceEquip(eq.uid);
              if(r.ok){sfx('confirm');toast(`${eq.name} +${eq.lv} に強化！`,'good');render();}
              else toast(r.msg||'強化できません','bad');
            }}, maxed?'MAX':'強化')]});
        })):empty('装備がありません')));
  }
  function tabFuse(){
    let sel=[];
    const wrap=el('div',{});
    const draw=()=>{
      wrap.innerHTML='';
      const groups={};
      for(const eq of S.equipment){const k=eq.slot+'|'+eq.rarity;(groups[k]=groups[k]||[]).push(eq);}
      wrap.append(el('div',{class:'panel'},
        el('div',{class:'sec-title'},'装備合成'),
        el('p',{class:'hint mb8'},'同じ部位・同じレアリティの装備を3つ選ぶと、1つ上のレアリティの装備に合成されます。シークレットが最高位。'),
        el('div',{class:'flex mb8'}, el('span',{class:'badge gold'},`選択中: ${sel.length}/3`),
          el('button',{class:'btn btn-sm btn-gold', disabled:sel.length===3?null:'', onclick:()=>{
            const r=fuseEquips(sel);
            if(r.ok){sfx('rare');sel=[];
              modal(el('div',{class:'center'}, el('h3',{},'合成成功！'),
                el('div',{style:{fontSize:'40px'}},SLOTS[r.eq.slot].ico),
                el('div',{class:`r-name rar-${r.eq.rarity}`,style:{fontSize:'18px'}},r.eq.name),
                el('div',{class:`rar-tag rar-${r.eq.rarity}`},RARITY[r.eq.rarity].name),
                el('div',{class:'modal-actions'},el('button',{class:'btn btn-gold',onclick:()=>{document.querySelector('.modal-veil').remove();render();}},'受け取る'))));
            } else toast(r.msg,'bad');
          }},'合成する'),
          el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{sel=[];draw();}},'リセット')),
        Object.keys(groups).length?el('div',{}, Object.entries(groups).map(([k,eqs])=>{
          const [slot,rar]=k.split('|');
          return el('div',{class:'mt12'},
            el('div',{class:'small txt-dim mb8'},`${SLOTS[slot].name} / ${RARITY[rar].name} (${eqs.length}個)`),
            el('div',{class:'list'}, eqs.map(eq=>{
              const on=sel.includes(eq.uid);
              return el('div',{class:`row clickable rar-border-${eq.rarity}`+(on?' rar-bg-'+eq.rarity:''), style:on?{boxShadow:'0 0 12px rgba(217,180,91,.4)'}:{}, onclick:()=>{
                if(on) sel=sel.filter(x=>x!==eq.uid);
                else { if(sel.length>=3){toast('3つまでです','bad');return;}
                  if(sel.length){const first=getEquip(sel[0]);if(first.slot!==eq.slot||first.rarity!==eq.rarity){toast('同じ部位・レアリティを選んでください','bad');return;}}
                  sel.push(eq.uid); }
                sfx('click');draw();
              }},
                el('span',{class:'r-ico'},on?'✅':SLOTS[eq.slot].ico),
                el('div',{class:'r-main'},el('div',{class:'r-name'},el('span',{class:`rar-${eq.rarity}`},eq.name+(eq.lv?` +${eq.lv}`:''))),el('div',{class:'r-desc'},equipStatLine(eq))));
            })));
        })):empty('装備がありません')));
    };
    draw();
    return wrap;
  }
  render();
  body.append(charSummary(ch,{compact:true}), el('div',{class:'mt12'},tabs), content);
  return facilityScreen({bg:'forge',title:'武器・装備工房',sub:'装備変更・ガチャ・強化・合成',active:'forge',body});
}
