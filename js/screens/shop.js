// ============ 道具屋 ============
import { el, fmt, bus } from '../util.js';
import { facilityScreen, charSummary, equipRow, toast, confirmModal, empty } from '../ui.js';
import { S, activeChar, buyItem, sellItem, sellEquip } from '../state.js';
import { ITEMS, ITEM_MAP } from '../data/items.js';
import { RARITY } from '../data/equipment.js';
import { sfx } from '../audio.js';

export function renderShop(){
  const ch=activeChar();
  const body=el('div',{style:{maxWidth:'960px',margin:'0 auto'}});
  let tab='buy';
  const tabs=el('div',{class:'tabs'}), content=el('div',{});
  const TABS=[['buy','購入'],['sell','売却']];
  function render(){
    tabs.innerHTML='';content.innerHTML='';
    for(const [id,l] of TABS) tabs.append(el('button',{class:tab===id?'on':'',onclick:()=>{tab=id;sfx('click');render();}},l));
    content.append(tab==='buy'?tabBuy():tabSell());
  }
  bus.on('rerender',()=>{if(document.body.contains(body))render();});
  function tabBuy(){
    const groups=[['回復・消費',['potion','hi_potion','ether','hi_ether','elixir','energy_drink','antidote']],
      ['強化・素材',['stone','hi_stone','awk_shard','awk_crystal','awk_orb','awk_core','awk_genesis']],
      ['技の書', ITEMS.filter(i=>i.kind==='book').map(i=>i.id)]];
    return el('div',{},
      el('div',{class:'panel mb8'}, el('div',{class:'flex-between'}, el('span',{class:'sec-title',style:{margin:'0'}},'道具屋'), el('span',{class:'res coins'},`🪙 ${fmt(S.coins)}`))),
      ...groups.map(([label,ids])=>el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},label),
        el('div',{class:'list'}, ids.map(id=>{
          const it=ITEM_MAP[id]; if(!it||!it.buy) return null;
          return el('div',{class:'row'},
            el('span',{class:'r-ico'},it.ico),
            el('div',{class:'r-main'}, el('div',{class:'r-name',style:{fontSize:'13px'}},it.name, el('span',{class:'txt-dim small',style:{marginLeft:'6px'}},`所持${S.inventory[id]||0}`)),
              el('div',{class:'r-desc'},it.desc)),
            el('div',{class:'r-side'},
              el('span',{class:'num txt-gold'},`🪙${fmt(it.buy)}`),
              el('button',{class:'btn btn-sm btn-gold', disabled:S.coins>=it.buy?null:'', onclick:()=>{if(buyItem(id,1)){sfx('coin');toast(`${it.name}を購入`,'good');render();}}},'買う'),
              el('button',{class:'btn btn-sm btn-ghost', disabled:S.coins>=it.buy*5?null:'', onclick:()=>{if(buyItem(id,5)){sfx('coin');toast(`${it.name}×5購入`,'good');render();}}},'×5')));
        })))));
  }
  function tabSell(){
    const owned=Object.keys(S.inventory).filter(id=>ITEM_MAP[id]&&S.inventory[id]>0);
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'アイテム売却'),
        owned.length?el('div',{class:'list'}, owned.map(id=>{
          const it=ITEM_MAP[id];
          return el('div',{class:'row'},
            el('span',{class:'r-ico'},it.ico),
            el('div',{class:'r-main'}, el('div',{class:'r-name',style:{fontSize:'13px'}},`${it.name} ×${S.inventory[id]}`), el('div',{class:'r-desc'},`売値 🪙${fmt(it.sell)}/個`)),
            el('div',{class:'r-side'},
              el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{if(sellItem(id,1)){sfx('coin');render();}}},'1個売る'),
              el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{if(sellItem(id,S.inventory[id])){sfx('coin');render();}}},'全部売る')));
        })):empty('売却できるアイテムがありません')),
      el('div',{class:'panel mt12'}, el('div',{class:'sec-title'},'装備売却'),
        S.equipment.length?el('div',{class:'list'}, S.equipment.map(eq=>equipRow(eq,{right:[
          el('span',{class:'num txt-gold'},`🪙${fmt(RARITY[eq.rarity].sell+eq.lv*40)}`),
          el('button',{class:'btn btn-sm btn-ghost', onclick:()=>confirmModal(`${eq.name}を売却しますか？`,()=>{sellEquip(eq.uid);sfx('coin');render();})},'売却')]}))):empty('装備がありません')));
  }
  render();
  if(ch) body.append(charSummary(ch,{compact:true}));
  body.append(el('div',{class:'mt12'},tabs), content);
  return facilityScreen({bg:'shop',title:'道具屋',sub:'回復アイテム・育成素材・覚醒素材・技の書',active:'shop',body});
}
