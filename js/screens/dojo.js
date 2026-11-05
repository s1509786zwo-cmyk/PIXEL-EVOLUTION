// ============ 修行場 ============
import { el, fmt, bus, pct } from '../util.js?v=20261105b';
import { facilityScreen, charSummary, skillRow, toast, empty } from '../ui.js?v=20261105b';
import { S, activeChar, train, practiceSkill, skillXpNeed, regenStamina, STAM_MAX, persist, STAT_NAME } from '../state.js?v=20261105b';
import { SKILL_MAP } from '../data/skills.js?v=20261105b';
import { makeEnemy } from '../data/enemies.js?v=20261105b';
import { JOB_MAP } from '../data/jobs.js?v=20261105b';
import { startBattle } from '../battle-ui.js?v=20261105b';
import { sfx } from '../audio.js?v=20261105b';

const TRAIN_QUESTS = [
  {id:'q_basic', name:'基礎修行', ico:'🎯', desc:'Lvを少し下げた相手と2連戦。修行の基本。', waves:2, lvOff:-2, mult:0.9, stamina:15,
    reward:{coins:350, xp:150, items:{stone:1}}},
  {id:'q_renzo', name:'連続修行', ico:'🔥', desc:'同格の相手と3連戦。HP/MPは引き継ぎ。', waves:3, lvOff:0, mult:1.0, stamina:22,
    reward:{coins:900, xp:350, items:{hi_stone:1}, points:30}},
  {id:'q_limit', name:'限界修行', ico:'💀', desc:'格上の強敵とアイテム禁止の1戦。', waves:1, lvOff:5, mult:1.45, stamina:30, noItems:true,
    reward:{coins:1600, xp:600, items:{awk_shard:1}, points:60}},
];

export function renderDojo(){
  const ch=activeChar();
  const body=el('div',{style:{maxWidth:'960px',margin:'0 auto'}});
  if(!ch) return facilityScreen({bg:'dojo',title:'修行場',sub:'トレーニング・技の練習・修行クエスト',active:'dojo',body:empty('キャラクターを作成してください')});
  let tab='train', selStat='atk', selSkill=ch.skills[0]||null;
  const tabs=el('div',{class:'tabs'}), content=el('div',{});
  const TABS=[['train','トレーニング'],['practice','技の練習'],['quest','修行クエスト']];
  function render(){
    tabs.innerHTML='';content.innerHTML='';
    for(const [id,l] of TABS) tabs.append(el('button',{class:tab===id?'on':'',onclick:()=>{tab=id;sfx('click');render();}},l));
    content.append({train:tabTrain,practice:tabPractice,quest:tabQuest}[tab]());
  }
  bus.on('rerender',()=>{if(document.body.contains(body))render();});

  function tabTrain(){
    regenStamina();
    const coin=80+ch.level*8;
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'flex-between'}, el('div',{class:'sec-title'},'基礎トレーニング'),
          el('span',{class:'res stam'},`⚡ ${S.stamina}/${STAM_MAX}`)),
        el('p',{class:'hint mb8'},`鍛える能力を選んでトレーニング。スタミナ10 + 🪙${fmt(coin)} 消費。経験値・職業熟練度に加え、選んだ能力の振分ポイントが+1されます。`),
        el('div',{class:'grid-cards'}, ['hp','mp','atk','def','spd','mag','acc','eva'].map(k=>
          el('div',{class:'mini-card'+(selStat===k?' sel':''), onclick:()=>{selStat=k;sfx('click');render();}},
            el('h4',{},STAT_NAME[k]), el('p',{},`現在の振分: ${ch.alloc[k]||0}`)))),
        el('button',{class:'btn btn-gold btn-lg btn-block mt12', disabled:(S.stamina>=10&&S.coins>=coin)?null:'',
          onclick:()=>{
            const r=train(ch,selStat);
            if(r.ok){sfx('confirm');toast(`${STAT_NAME[selStat]}+1 / EXP+${fmt(r.xp)} 獲得！`,'good');render();}
            else toast(r.msg,'bad');
          }},'🏋️ トレーニングする')));
  }
  function tabPractice(){
    if(!selSkill||!ch.skills.includes(selSkill)) selSkill=ch.skills[0]||null;
    const lv=selSkill?(ch.skillLv[selSkill]||1):1;
    const xp=selSkill?(ch.skillXp[selSkill]||0):0;
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'sec-title'},'技の練習'),
        el('p',{class:'hint mb8'},'技を選んで反復練習。スタミナ8消費で技EXPを獲得。技レベルが上がると威力+4%/Lv(最大Lv10)。'),
        el('div',{class:'list'}, ch.skills.map(id=>skillRow(id,{ch, onClick:()=>{selSkill=id;sfx('click');render();},
          right: selSkill===id?[el('span',{class:'badge gold'},'選択中')]:null})))),
      selSkill?el('div',{class:'panel mt12'},
        el('div',{class:'flex-between'}, el('div',{class:'sec-title'},`「${SKILL_MAP[selSkill].name}」を鍛える`),
          el('span',{class:'badge purple'},`技Lv ${lv}/10`)),
        el('div',{class:'bar xp mt8'}, el('i',{style:{width:pct(xp,skillXpNeed(lv))+'%'}}), el('span',{},`${fmt(xp)} / ${fmt(skillXpNeed(lv))}`)),
        el('button',{class:'btn btn-gold btn-block mt12', disabled:(lv<10&&S.stamina>=8)?null:'', onclick:()=>{
          const r=practiceSkill(ch,selSkill);
          if(r.ok){sfx('confirm');toast(r.ups?`技レベルが${r.lv}に上がった！`:'技EXP+25','good');render();}
          else toast(r.msg||'練習できません','bad');
        }}, lv>=10?'最大レベル':'🥋 練習する (⚡8)')):null);
  }
  function tabQuest(){
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'修行クエスト'),
        el('p',{class:'hint'},'特別な条件での模擬戦。勝利すると通常報酬に加えて修行報酬を獲得。'),
        el('div',{class:'grid-cards mt12'}, TRAIN_QUESTS.map(q=>
          el('div',{class:'mini-card'},
            el('h4',{},`${q.ico} ${q.name}`),
            el('p',{},q.desc),
            el('p',{class:'mt8 txt-gold small'},`報酬: 🪙${q.reward.coins} / EXP${q.reward.xp}${q.reward.points?` / 🏆${q.reward.points}`:''}`),
            el('p',{class:'small txt-dim'},`消費スタミナ ${q.stamina}${q.noItems?' / アイテム使用禁止':''}`),
            el('button',{class:'btn btn-sm btn-gold mt8', disabled:S.stamina>=q.stamina?null:'', onclick:()=>{
              regenStamina();
              if(S.stamina<q.stamina){toast('スタミナが足りません','bad');return;}
              S.stamina-=q.stamina; persist();
              const enemies=[];
              for(let i=0;i<q.waves;i++){
                const jobIds=Object.keys(JOB_MAP);
                enemies.push(makeEnemy({job:jobIds[Math.floor(Math.random()*jobIds.length)],
                  level:Math.max(1,ch.level+q.lvOff), mult:q.mult, name:`修行の相手 ${i+1}`, diff:'normal', seed:'train'+q.id+i}));
              }
              startBattle({enemies, noItems:q.noItems, label:`修行クエスト「${q.name}」`,
                onEnd:(res)=>{
                  if(res.win){
                    S.coins+=q.reward.coins; S.points+=q.reward.points||0;
                    import('../state.js?v=20261105b').then(m=>{ m.addXp(ch,q.reward.xp); for(const [it,n] of Object.entries(q.reward.items||{})) m.addItem(it,n); });
                    toast(`修行達成！🪙${q.reward.coins} 獲得！`,'gold');
                  }
                  import('../ui.js?v=20261105b').then(m=>m.go('dojo'));
                }});
            }},'挑戦する'))))));
  }
  render();
  body.append(charSummary(ch,{compact:true}), el('div',{class:'mt12'},tabs), content);
  return facilityScreen({bg:'dojo',title:'修行場',sub:'トレーニング・技の練習・修行クエスト',active:'dojo',body});
}
