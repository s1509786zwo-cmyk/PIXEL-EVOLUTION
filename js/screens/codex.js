// ============ 図鑑・実績・称号 ============
import { el, fmt, bus, pct, esc } from '../util.js?v=20261105b';
import { go, topbar, bottomNav, modal, toast, skillRow, empty } from '../ui.js?v=20261105b';
import { S, activeChar, persist, claimCodexMilestone } from '../state.js?v=20261105b';
import { JOBS, JOB_MAP, TIER_NAME, WEAPON_TYPES } from '../data/jobs.js?v=20261105b';
import { SKILLS, SKILL_MAP, ELEMENTS, CAT_NAME, skillDesc } from '../data/skills.js?v=20261105b';
import { RARITIES, RARITY, SLOTS, WEAPON_NAMES, ARMOR_NAMES, ACCESSORY_NAMES, ORNAMENT_NAMES, SPECIAL_EQUIPS } from '../data/equipment.js?v=20261105b';
import { ACHIEVEMENTS, TITLES, TITLE_MAP, CODEX_MILESTONES } from '../data/meta.js?v=20261105b';
import { OPPONENT_NAMES, BOSSES } from '../data/enemies.js?v=20261105b';
import { sfx } from '../audio.js?v=20261105b';

export function renderCodex(){
  const body=el('div',{style:{maxWidth:'980px',margin:'0 auto'}});
  let tab='skills', filter='all', search='';
  const tabs=el('div',{class:'tabs'}), content=el('div',{});
  const TABS=[['jobs','職業'],['skills','技'],['equip','武器・装備'],['enemies','敵'],['ach','実績'],['titles','称号'],['collect','収集報酬']];
  function render(){
    tabs.innerHTML='';content.innerHTML='';
    for(const [id,l] of TABS) tabs.append(el('button',{class:tab===id?'on':'',onclick:()=>{tab=id;sfx('click');render();}},l));
    content.append({jobs:tabJobs,skills:tabSkills,equip:tabEquip,enemies:tabEnemies,ach:tabAch,titles:tabTitles,collect:tabCollect}[tab]());
  }
  function tabJobs(){
    const owned=S.codex.jobs;
    return el('div',{},
      prog(Object.keys(owned).length, JOBS.length, '職業コレクション'),
      el('div',{class:'grid-cards'}, JOBS.map(j=>{
        const has=!!owned[j.id];
        return el('div',{class:'mini-card'+(has?'':' locked')},
          el('h4',{},`${j.ico} ${j.name} `, el('span',{class:'badge',style:{fontSize:'9px'}},TIER_NAME[j.tier])),
          el('p',{},has?j.style:'未解放'),
          el('p',{class:'small txt-dim mt8'},`武器: ${j.weapons.map(w=>WEAPON_TYPES[w].name).join('/')}`));
      })));
  }
  function tabSkills(){
    const owned=S.codex.skills;
    const list=SKILLS.filter(s=>{
      if(filter!=='all'&&s.elem!==filter&&s.cat!==filter) return false;
      if(search&&!s.name.includes(search)) return false;
      return true;
    });
    return el('div',{},
      prog(Object.keys(owned).length, SKILLS.length, '技コレクション'),
      el('div',{class:'panel mb8'},
        el('div',{class:'flex'},
          el('input',{type:'text', placeholder:'技名で検索', value:search, style:{flex:'1',padding:'8px 12px',borderRadius:'7px',background:'#131a30',border:'1px solid #3d4a75',color:'#fff'},
            oninput:e=>{search=e.target.value;render();}}),
          el('div',{class:'seg'}, [['all','全て'],...Object.entries(ELEMENTS).map(([k,v])=>[k,v.ico+v.name]),['heal','回復'],['ultimate','必殺']].map(([k,l])=>
            el('button',{class:filter===k?'on':'', onclick:()=>{filter=k;render();}},l))))),
      el('div',{class:'list'}, list.map(s=>{
        const has=!!owned[s.id];
        return el('div',{class:'row', style:{opacity:has?1:.5}},
          el('span',{class:'r-ico',style:{color:ELEMENTS[s.elem].color}},ELEMENTS[s.elem].ico),
          el('div',{class:'r-main'},
            el('div',{class:'r-name'}, has?s.name:'？？？', el('span',{class:'badge',style:{marginLeft:'6px'}},CAT_NAME[s.cat])),
            el('div',{class:'r-desc'}, has?skillDesc(s):'未習得')),
          has?el('span',{class:'badge green'},'習得済'):null);
      })));
  }
  function tabEquip(){
    const owned=S.codex.equip;
    const all=[];
    for(const t of Object.keys(WEAPON_NAMES)) for(let r=0;r<6;r++) all.push({key:`weapon:${t}:${RARITIES[r]}`, name:WEAPON_NAMES[t][r], slot:'weapon', rar:RARITIES[r], type:t});
    for(let r=0;r<6;r++){
      all.push({key:`armor::${RARITIES[r]}`, name:ARMOR_NAMES[r], slot:'armor', rar:RARITIES[r]});
      all.push({key:`accessory::${RARITIES[r]}`, name:ACCESSORY_NAMES[r], slot:'accessory', rar:RARITIES[r]});
      all.push({key:`ornament::${RARITIES[r]}`, name:ORNAMENT_NAMES[r], slot:'ornament', rar:RARITIES[r]});
    }
    for(const sp of SPECIAL_EQUIPS) all.push({key:`special:${sp.id}`, name:sp.name, slot:sp.slot, rar:sp.rarity, special:true});
    return el('div',{},
      prog(Object.keys(owned).length, all.length, '装備コレクション'),
      el('div',{class:'grid-cards'}, all.map(e=>{
        const has=!!owned[e.key];
        return el('div',{class:`mini-card rar-border-${e.rar}`+(has?` rar-bg-${e.rar}`:' locked')},
          el('h4',{class:has?`rar-${e.rar}`:''},`${SLOTS[e.slot].ico} ${has?e.name:'？？？'}`),
          el('p',{},el('span',{class:`rar-tag rar-${e.rar}`},RARITY[e.rar].name), e.type?` ${WEAPON_TYPES[e.type].name}`:'', e.special?' ★特別':''));
      })));
  }
  function tabEnemies(){
    const owned=S.codex.enemies;
    const names=[...new Set([...OPPONENT_NAMES, ...BOSSES.map(b=>b.name)])];
    return el('div',{},
      prog(Object.keys(owned).length, names.length, '敵コレクション'),
      el('div',{class:'grid-cards'}, names.map(n=>{
        const has=!!owned[n];
        const boss=BOSSES.find(b=>b.name===n);
        return el('div',{class:'mini-card'+(has?'':' locked')},
          el('h4',{},`${boss?boss.ico:'👤'} ${has?n:'？？？'}`),
          el('p',{},has?(boss?'ボス':'CPUファイター'):'未遭遇'));
      })));
  }
  function tabAch(){
    const done=Object.keys(S.achievements).length;
    return el('div',{},
      prog(done, ACHIEVEMENTS.length, '実績'),
      el('div',{class:'list'}, ACHIEVEMENTS.map(a=>{
        const has=!!S.achievements[a.id];
        const rw=[]; if(a.reward.coins)rw.push(`🪙${a.reward.coins}`); if(a.reward.points)rw.push(`🏆${a.reward.points}`);
        for(const [m,n] of Object.entries(a.reward.mats||{})) rw.push(`${m}×${n}`);
        if(a.title) rw.push(`称号「${TITLE_MAP[a.title].name}」`);
        return el('div',{class:'row'+(has?' ach-done':'')},
          el('span',{class:'r-ico'},has?'🏅':'🔒'),
          el('div',{class:'r-main'}, el('div',{class:'r-name',style:{fontSize:'13px'}},a.name), el('div',{class:'r-desc'},`${a.desc} / 報酬: ${rw.join(' ')}`)),
          has?el('span',{class:'badge green'},'達成'):null);
      })));
  }
  function tabTitles(){
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'称号'),
        el('p',{class:'hint mb8'},'称号は実績・交換所・ランクで獲得。1つ装備すると効果が適用されます。'),
        el('div',{}, TITLES.map(t=>{
          const has=S.titles.includes(t.id), on=S.activeTitle===t.id;
          return el('span',{class:'title-chip'+(on?' on':''), style:{opacity:has?1:.4}, title:`${t.desc} (${t.from})`,
            onclick:()=>{ if(!has){toast('まだ獲得していません','bad');return;} S.activeTitle=t.id; persist(); sfx('confirm'); render(); }},
            `${on?'✦':''} ${t.name}`);
        })),
        el('div',{class:'divider'}),
        el('div',{class:'small txt-dim'},'現在の称号: ', el('span',{class:'txt-gold'},TITLE_MAP[S.activeTitle]?.name||'なし'),
          ' — ', TITLE_MAP[S.activeTitle]?.desc||'')));
  }
  function tabCollect(){
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'図鑑コレクション報酬'),
        el('div',{class:'list'}, CODEX_MILESTONES.map(m=>{
          const cur=Object.keys(S.codex[m.kind]).length;
          const done=cur>=m.need, claimed=S.codexClaimed.includes(m.id);
          const kindName={skills:'技',equip:'装備',jobs:'職業',enemies:'敵'}[m.kind];
          const rw=[]; if(m.reward.coins)rw.push(`🪙${m.reward.coins}`); if(m.reward.points)rw.push(`🏆${m.reward.points}`);
          return el('div',{class:'row'+(done&&!claimed?' quest-claimable':'')},
            el('span',{class:'r-ico'},claimed?'✅':'📚'),
            el('div',{class:'r-main'}, el('div',{class:'r-name',style:{fontSize:'13px'}},`${kindName} ${m.need}種収集`),
              el('div',{class:'r-desc'},`${Math.min(cur,m.need)}/${m.need} / 報酬: ${rw.join(' ')}`)),
            el('div',{class:'r-side'}, claimed?el('span',{class:'badge green'},'受取済'):
              el('button',{class:'btn btn-sm btn-gold', disabled:done?null:'', onclick:()=>{if(claimCodexMilestone(m.id)){sfx('rare');toast('報酬獲得！','gold');render();}}},'受取')));
        }))));
  }
  function prog(cur,total,label){
    return el('div',{class:'panel mb8'},
      el('div',{class:'flex-between'}, el('span',{class:'sec-title',style:{margin:'0'}},label), el('span',{class:'num txt-gold'},`${cur} / ${total}`)),
      el('div',{class:'bar xp mt8'}, el('i',{style:{width:pct(cur,total)+'%'}})));
  }
  render();
  body.append(tabs, content);
  return el('div',{class:'screen'},
    el('div',{class:'screen-bg', style:{backgroundImage:'url(assets/bg/guild.jpg)'}}),
    topbar('図鑑'),
    el('div',{class:'screen-body'}, body),
    bottomNav('codex'));
}
