// ============ 育成の間 ============
import { el, fmt, bus, pct } from '../util.js';
import { go, facilityScreen, charSummary, statGrid, skillRow, modal, toast, confirmModal, empty } from '../ui.js';
import { S, activeChar, charStats, availableSkills, learnSkill, unlockedJobs, changeJob, jobLevel, maxJobLevel,
  awakenReq, doAwaken, doRebirth, maxSkillSlots, useItem, persist, STAT_NAME } from '../state.js';
import { JOBS, JOB_MAP, TIER_NAME, WEAPON_TYPES } from '../data/jobs.js';
import { SKILL_MAP, skillDesc, CAT_NAME, ELEMENTS } from '../data/skills.js';
import { AWAKEN_STAGES, MAX_LEVEL, MAX_JOB_LEVEL, xpNeed, jobXpNeed, ITEM_MAP } from '../data/items.js';
import { sfx } from '../audio.js';

export function renderHall(){
  const ch = activeChar();
  const body = el('div',{style:{maxWidth:'960px',margin:'0 auto'}});
  if (!ch){ return facilityScreen({bg:'hall',title:'育成の間',sub:'レベル・職業・技・覚醒',active:'hall',
    body: el('div',{}, empty('キャラクターを作成してください'), el('div',{class:'center mt12'},el('button',{class:'btn btn-gold',onclick:()=>go('create')},'キャラクター作成')))}); }
  let tab = 'status';
  const tabs = el('div',{class:'tabs'});
  const content = el('div',{});
  const TABS = [['status','ステータス'],['job','職業'],['skill','技'],['awaken','覚醒・進化'],['rebirth','転生'],['look','見た目']];
  function render(){
    tabs.innerHTML=''; content.innerHTML='';
    for (const [id,label] of TABS){
      tabs.append(el('button',{class:tab===id?'on':'', onclick:()=>{tab=id;sfx('click');render();}},label));
    }
    content.append({status:tabStatus,job:tabJob,skill:tabSkill,awaken:tabAwaken,rebirth:tabRebirth,look:tabLook}[tab]());
  }
  bus.on('rerender', ()=>{ if(document.body.contains(body)) render(); });

  function tabStatus(){
    const {stats} = charStats(ch);
    return el('div',{},
      charSummary(ch),
      el('div',{class:'panel mt12'},
        el('div',{class:'flex-between'},
          el('div',{class:'sec-title'},'能力値'),
          el('span',{class:'badge gold'},`振り分けポイント: ${ch.statPoints}`)),
        el('p',{class:'hint mb8'},'レベルアップで3ポイント獲得。＋ボタンで自由に振り分けられます。'),
        statGrid(ch,{allocate:true})),
      el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},'回復アイテム使用'),
        el('div',{class:'flex'}, ['potion','hi_potion','ether','hi_ether','elixir'].map(id=>{
          const n = S.inventory[id]||0;
          return el('button',{class:'btn btn-sm', disabled:n<1?'':null, onclick:()=>{
            const r=useItem(ch,id); if(r.ok){sfx('heal');toast(r.msg,'good');render();}
          }},`${ITEM_MAP[id].ico} ${ITEM_MAP[id].name} ×${n}`);
        }))));
  }
  function tabJob(){
    const j = JOB_MAP[ch.job];
    const jd = ch.jobData[ch.job]||{lv:1,xp:0};
    const unlocked = unlockedJobs(ch).map(x=>x.id);
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'flex-between'},
          el('div',{}, el('div',{class:'sec-title'},`現在の職業: ${j.ico} ${j.name}`),
            el('p',{class:'hint'},j.style)),
          el('span',{class:'badge purple'},`${TIER_NAME[j.tier]}`)),
        el('div',{class:'mt8'},
          el('div',{class:'flex-between small'}, el('span',{},`熟練度 Lv${jd.lv} / ${MAX_JOB_LEVEL}`), el('span',{class:'txt-dim'},`${fmt(jd.xp)} / ${fmt(jobXpNeed(jd.lv))} JP`)),
          el('div',{class:'bar xp mt8'}, el('i',{style:{width:pct(jd.xp,jobXpNeed(jd.lv))+'%'}}))),
        el('div',{class:'mt8 small txt-dim'},'装備可能武器: '+j.weapons.map(w=>WEAPON_TYPES[w].name).join(' / '))),
      el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},'ジョブチェンジ'),
        el('p',{class:'hint mb8'},'職業レベルと条件を満たすと上級職・特殊職が解放されます。熟練度は職業ごとに保存されます。'),
        el('div',{class:'grid-cards'}, JOBS.map(job=>{
          const isUn = unlocked.includes(job.id);
          const cur = job.id===ch.job;
          const jl = jobLevel(ch, job.id);
          let reqTxt = '';
          if (job.unlock){
            const u=job.unlock;
            reqTxt = `条件: ${JOB_MAP[u.job].name}熟練Lv${u.jl}${u.alt?` または ${JOB_MAP[u.alt.job].name}Lv${u.alt.jl}`:''} / 本体Lv${u.level}${u.awaken?` / 覚醒${u.awaken}`:''}`;
          }
          return el('div',{class:'mini-card'+(cur?' sel':'')+(!isUn?' locked':''), onclick:()=>{
            if(cur||!isUn) return;
            confirmModal(`${job.name} にジョブチェンジしますか？`, ()=>{ if(changeJob(ch,job.id)){sfx('confirm');render();} });
          }},
            el('h4',{},`${job.ico} ${job.name} `, el('span',{class:'badge', style:{fontSize:'9px'}},TIER_NAME[job.tier])),
            el('p',{},job.style),
            el('p',{class:'mt8', style:{color:isUn?'#7ed491':'#f07a6a'}}, cur?'使用中':isUn?`解放済み (熟練Lv${jl})`:reqTxt));
        }))));
  }
  function tabSkill(){
    const avail = availableSkills(ch);
    const slots = ch.slots;
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'flex-between'},
          el('div',{class:'sec-title'},'戦闘にセットする技'),
          el('span',{class:'badge'},`${slots.length} / ${maxSkillSlots(ch)}`)),
        el('p',{class:'hint mb8'},'タップでセット/解除。レベルが上がるとセット数が増えます(最大8)。'),
        el('div',{}, slots.length?slots.map(id=>{
          const s=SKILL_MAP[id];
          return el('span',{class:'skill-slot-chip', onclick:()=>{ch.slots=slots.filter(x=>x!==id);persist();sfx('cancel');render();}},
            `${ELEMENTS[s.elem].ico} ${s.name}`, el('span',{class:'rm'},'✕'));
        }):el('span',{class:'txt-dim small'},'技がセットされていません'))),
      avail.length?el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},'習得可能な技'),
        el('div',{class:'list'}, avail.map(a=>skillRow(a.id,{right:[
          el('span',{class:'badge'},a.src),
          el('button',{class:'btn btn-sm btn-green', onclick:()=>{if(learnSkill(ch,a.id)){sfx('confirm');toast(`「${SKILL_MAP[a.id].name}」を習得！`,'good');render();}}},'習得')]})))):null,
      el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},`習得済みの技 (${ch.skills.length})`),
        el('div',{class:'list'}, ch.skills.map(id=>skillRow(id,{ch, right:[
          el('button',{class:'btn btn-sm '+(slots.includes(id)?'btn-red':'btn-blue'), onclick:()=>{
            if(slots.includes(id)) ch.slots=slots.filter(x=>x!==id);
            else { if(slots.length>=maxSkillSlots(ch)){toast('セット数が上限です','bad');return;} ch.slots.push(id); }
            persist();sfx('click');render();
          }}, slots.includes(id)?'解除':'セット'),
          el('button',{class:'btn btn-sm btn-ghost', onclick:()=>skillDetail(id)},'詳細')]})))),
      el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},'技の書を使う'),
        el('div',{class:'flex'}, Object.keys(S.inventory).filter(id=>ITEM_MAP[id]?.kind==='book').map(id=>
          el('button',{class:'btn btn-sm btn-gold', onclick:()=>{const r=useItem(ch,id);if(r.ok){sfx('rare');toast(r.msg,'gold');render();}else toast(r.msg||'使えません','bad');}},
            `📕 ${ITEM_MAP[id].name} ×${S.inventory[id]}`)),
          !Object.keys(S.inventory).some(id=>ITEM_MAP[id]?.kind==='book')?el('span',{class:'txt-dim small'},'技の書は道具屋や交換所で入手できます'):null)));
  }
  function skillDetail(id){
    const s=SKILL_MAP[id];
    modal(el('div',{},
      el('h3',{},`${ELEMENTS[s.elem].ico} ${s.name}`),
      el('div',{class:'center mb8'}, el('span',{class:'badge'},CAT_NAME[s.cat]), el('span',{class:'badge'},`${ELEMENTS[s.elem].name}属性`)),
      el('p',{class:'center'}, skillDesc(s)),
      el('div',{class:'divider'}),
      el('p',{class:'small txt-dim'},`消費MP ${s.mp} / クールダウン ${s.cd}ターン${s.gauge?` / 闘志${s.gauge}消費`:''}`),
      ch.skillLv[id]?el('p',{class:'small txt-gold'},`技レベル ${ch.skillLv[id]} (威力+${(ch.skillLv[id]-1)*4}%) — 修行場で鍛えられます`):null));
  }
  function tabAwaken(){
    const req = awakenReq(ch);
    const wrap = el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'sec-title'},'覚醒・進化'),
        el('p',{class:'hint'},'条件を満たして素材を捧げると覚醒段階が進み、全能力が大幅上昇。覚醒限定技も解放されます。'),
        el('div',{class:'flex mt12'}, AWAKEN_STAGES.map(st=>
          el('span',{class:'badge '+(ch.awaken>=st.stage?'purple':''), style:{opacity:ch.awaken>=st.stage?1:.45, borderColor:ch.awaken>=st.stage?st.color:''}},
            `${ch.awaken>=st.stage?'✦':'◇'} ${st.name}`)))),
      req?el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},`次の覚醒: ${req.name}`),
        el('div',{class:'list'},
          reqRow(`本体レベル ${req.level} 以上`, req.okLevel, `現在 Lv${ch.level}`),
          reqRow(`いずれかの職業熟練 Lv${req.jl} 以上`, req.okJl, `現在 最高Lv${maxJobLevel(ch)}`),
          reqRow(`ボス撃破 ${req.bosses} 体以上`, req.okBoss, `現在 ${S.counters.bossKills}体`),
          ...Object.entries(req.mats).map(([id,n])=>reqRow(`${ITEM_MAP[id].name} ×${n}`, (S.inventory[id]||0)>=n, `所持 ${S.inventory[id]||0}`))),
        el('div',{class:'mt12 txt-dim small'},`覚醒効果: 全能力 +${Math.round(req.bonus*100)}% / 限定技「${SKILL_MAP[req.skill].name}」解放`),
        el('button',{class:'btn btn-gold btn-lg btn-block mt12', disabled:(req.okLevel&&req.okJl&&req.okBoss&&req.okMats)?null:'',
          onclick:()=>{ if(doAwaken(ch)){render();} else toast('条件を満たしていません','bad'); }},'✨ 覚醒する'))
      :el('div',{class:'panel mt12 center'}, el('div',{style:{fontSize:'40px'}},'🌟'), el('p',{class:'txt-gold'},'最終覚醒「覚醒・極」に到達済み！')));
    return wrap;
  }
  function reqRow(label, ok, cur){
    return el('div',{class:'row'}, el('span',{class:'r-ico'},ok?'✅':'⬜'),
      el('div',{class:'r-main'}, el('div',{class:'r-name',style:{fontSize:'13px'}},label), el('div',{class:'r-desc'},cur)));
  }
  function tabRebirth(){
    return el('div',{class:'panel center'},
      el('div',{style:{fontSize:'40px'}},'♾️'),
      el('div',{class:'sec-title', style:{justifyContent:'center'}},'転生'),
      el('p',{class:'txt-dim'},`Lv${MAX_LEVEL}に到達すると転生できます。レベルは1に戻りますが、技・装備・覚醒は引き継ぎ、`),
      el('p',{class:'txt-gold'},'転生1回につき全能力が永久に+5%されます。'),
      el('p',{class:'mt12'},`現在の転生回数: ${ch.rebirth} / 現在のレベル: Lv${ch.level}`),
      el('button',{class:'btn btn-gold btn-lg mt12', disabled:ch.level<MAX_LEVEL?'':null, onclick:()=>{
        confirmModal('転生しますか？\nレベルは1に戻りますが、永久強化を得られます。', ()=>{ if(doRebirth(ch)){sfx('awaken');render();} });
      }}, ch.level>=MAX_LEVEL?'♾️ 転生する':`Lv${MAX_LEVEL}で解放`));
  }
  function tabLook(){
    return el('div',{class:'panel center'},
      el('div',{class:'sec-title', style:{justifyContent:'center'}},'見た目を変更'),
      el('img',{class:'pixel', src:ch.sprite, style:{width:'140px',margin:'12px auto'}}),
      el('p',{class:'txt-dim'},'保存された元画像からドット絵を再生成して、キャラクターの見た目を変更できます。'),
      el('button',{class:'btn btn-gold mt12', onclick:()=>go('create',{edit:ch.id})},'🎨 画像を再変換する'));
  }
  render();
  body.append(charSummary(ch,{compact:true}), el('div',{class:'mt12'},tabs), content);
  return facilityScreen({bg:'hall', title:'育成の間', sub:'レベル・職業・技・覚醒・転生', active:'hall', body});
}
