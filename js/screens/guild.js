// ============ 冒険者ギルド ============
import { el, fmt, bus, pct } from '../util.js';
import { go, facilityScreen, charSummary, modal, toast, confirmModal, empty, skillRow } from '../ui.js';
import { S, activeChar, charPower, charStats, battleRewards, claimQuest, buyPointShop, claimRankRewards, persist, addItem, grantReward, trackDaily, checkAchievements } from '../state.js';
import { DIFFICULTIES, DIFF_MAP, makeOpponent, BOSSES, BOSS_MAP, DUNGEONS, DUNGEON_MAP, makeDungeonFloor, makeEnemy } from '../data/enemies.js';
import { JOB_MAP } from '../data/jobs.js';
import { SKILL_MAP } from '../data/skills.js';
import { ITEM_MAP } from '../data/items.js';
import { SPECIAL_EQUIPS, RARITY, SLOTS } from '../data/equipment.js';
import { DAILY_QUESTS, POINT_SHOP, RANKS, rankOf, nextRank, TITLE_MAP } from '../data/meta.js';
import { spriteDataURL } from '../sprites.js';
import { startBattle } from '../battle-ui.js';
import { sfx } from '../audio.js';

export function renderGuild(){
  const ch=activeChar();
  const body=el('div',{style:{maxWidth:'980px',margin:'0 auto'}});
  if(!ch) return facilityScreen({bg:'guild',title:'冒険者ギルド',sub:'CPU対戦・ダンジョン・クエスト・戦績',active:'guild',body:empty('キャラクターを作成してください')});
  let tab='battle', diff='normal', opponents=genOpponents();
  const tabs=el('div',{class:'tabs'}), content=el('div',{});
  const TABS=[['battle','CPU対戦'],['dungeon','ダンジョン'],['quest','クエスト'],['shop','交換所'],['record','戦績']];
  function genOpponents(){ return Array.from({length:6},()=>makeOpponent(ch.level, diff)); }
  function render(){
    tabs.innerHTML='';content.innerHTML='';
    for(const [id,l] of TABS) tabs.append(el('button',{class:tab===id?'on':'',onclick:()=>{tab=id;sfx('click');render();}},l));
    content.append({battle:tabBattle,dungeon:tabDungeon,quest:tabQuest,shop:tabShop,record:tabRecord}[tab]());
  }
  bus.on('rerender',()=>{if(document.body.contains(body))render();});

  function tabBattle(){
    const rank=rankOf(S.rp);
    const shuraAvailable = S.streak>=5;
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'flex-between'},
          el('div',{class:'sec-title'},'対戦の難易度'),
          el('div',{class:'flex'}, el('span',{class:'badge gold'},`🔥 ${S.streak}連勝中`), el('span',{class:'badge'},`${rank.ico} ${rank.name}`))),
        el('div',{class:'seg'}, DIFFICULTIES.map(d=>
          el('button',{class:diff===d.id?'on':'', style:{color:d.color}, onclick:()=>{diff=d.id;opponents=genOpponents();sfx('click');render();}},d.name))),
        el('div',{class:'flex-between mt12'},
          el('span',{class:'txt-dim small'},'勝利でコイン・経験値・対戦ポイント・ランクPを獲得。敗北しても少量のポイントを獲得。'),
          el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{opponents=genOpponents();sfx('click');render();}},'🔄 相手を入れ替え'))),
      shuraAvailable?el('div',{class:'panel mt12 rar-border-M rar-bg-M'},
        el('div',{class:'flex-between'},
          el('div',{}, el('div',{class:'sec-title'},'🔥 特別な強敵「修羅」出現！'),
            el('p',{class:'hint'},'5連勝以上の者の前に現れる強敵。撃破で大量の報酬。')),
          el('button',{class:'btn btn-red', onclick:()=>{
            const e=makeEnemy({job:'berserker',level:ch.level+8,mult:1.8,name:'修羅',diff:'nightmare',seed:'shura',isBoss:true});
            startBattle({enemy:e,label:'特別強敵・修羅',onEnd:()=>go('guild')});
          }},'挑戦する'))):null,
      el('div',{class:'grid-cards mt12'}, opponents.map((e,i)=>{
        const d=DIFF_MAP[e.diff];
        return el('div',{class:'mini-card'},
          el('div',{class:'flex'},
            el('div',{class:'opp-sprite'}, el('img',{class:'pixel', src:spriteDataURL(e.seed,e.job,false)})),
            el('div',{}, el('h4',{},e.name), el('p',{},`Lv${e.level} ${JOB_MAP[e.job].name}`),
              el('p',{class:'small', style:{color:d.color}},d.name))),
          el('button',{class:'btn btn-sm btn-gold btn-block mt8', onclick:()=>{
            startBattle({enemy:e,label:`CPU対戦 (${d.name})`,onEnd:()=>go('guild')});
          }},'⚔️ 対戦する'));
      })),
      el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},'ボス挑戦'),
        el('p',{class:'hint mb8'},'ボスを倒すと専用技・覚醒素材・大量報酬を獲得。初回撃破で限定技を習得！'),
        el('div',{class:'list'}, BOSSES.map(b=>{
          const locked = b.hidden && !(S.dungeons.abyss?.cleared && ch.awaken>=3);
          const killed = S.bosses[b.id];
          return el('div',{class:'row'+(locked?' locked':'')},
            el('span',{class:'r-ico'},b.ico),
            el('div',{class:'r-main'},
              el('div',{class:'r-name'},b.name, killed?el('span',{class:'badge green',style:{marginLeft:'6px'}},`撃破×${killed}`):null, locked?el('span',{class:'badge red',style:{marginLeft:'6px'}},'封印中'):null),
              el('div',{class:'r-desc'}, locked?'条件: 深淵の塔制覇 + 覚醒・参以上':`Lv${b.level} / ${b.desc}`)),
            el('div',{class:'r-side'},
              el('button',{class:'btn btn-sm btn-red', disabled:locked?'':null, onclick:()=>{
                const e=makeEnemy({job:b.job,level:b.level,mult:b.mult,name:b.name,skills:b.skills,seed:b.id,isBoss:true,diff:'nightmare'});
                startBattle({enemy:e,bossId:b.id,label:`ボス戦 ${b.name}`,onEnd:()=>go('guild')});
              }},'挑戦')));
        }))));
  }

  function tabDungeon(){
    return el('div',{},
      el('div',{class:'panel'}, el('div',{class:'sec-title'},'ダンジョン'),
        el('p',{class:'hint'},'階層を進む連続バトル。HP/MPは引き継ぎ(階層間で25%回復)。進行状況は保存されます。'),
        el('div',{class:'grid-cards mt12'}, DUNGEONS.map(d=>{
          const prog=S.dungeons[d.id]||{best:0,cleared:false};
          const locked=d.hidden&&!(S.dungeons.abyss?.cleared&&ch.awaken>=3);
          return el('div',{class:'mini-card'+(locked?' locked':'')},
            el('h4',{},`${d.ico} ${d.name}`, prog.cleared?el('span',{class:'badge green',style:{marginLeft:'6px'}},'制覇'):null),
            el('p',{},d.desc),
            el('p',{class:'small txt-dim mt8'},`全${d.floors}階 / 推奨Lv${d.recLv} / 最深 ${prog.best}階`),
            locked?el('p',{class:'small txt-red'},'封印中: 深淵の塔制覇+覚醒・参'):
            el('button',{class:'btn btn-sm btn-gold mt8', onclick:()=>runDungeon(d, Math.min(prog.best+1,d.floors))},
              prog.best>0&&!prog.cleared?`${prog.best+1}階から再開`:'挑戦する'));
        }))));
  }
  function runDungeon(d, floor){
    const enemy=makeDungeonFloor(d.id, floor);
    startBattle({enemy, silentResult:true, noFlee:true, label:`${d.name} ${floor}F`, onEnd:(res)=>{
      const rewards=battleRewards(ch, enemy, !!res.win, {});
      if(res.win){
        S.counters.floors++; trackDaily('floors',1);
        const prog=S.dungeons[d.id]||(S.dungeons[d.id]={best:0,cleared:false});
        prog.best=Math.max(prog.best,floor);
        // 25%回復
        const {stats}=charStats(ch);
        ch.hp=Math.min(stats.hp,(ch.hp==null?stats.hp:ch.hp)+Math.round(stats.hp*0.25));
        ch.mp=Math.min(stats.mp,(ch.mp==null?stats.mp:ch.mp)+Math.round(stats.mp*0.25));
        if(floor>=d.floors){
          prog.cleared=true;
          grantReward(d.clearReward); checkAchievements();
          record2(`${d.name} を制覇した！`);
          persist();
          sfx('victory');
          modal(el('div',{class:'center'},
            el('div',{style:{fontSize:'46px'}},'🏆'),
            el('h3',{},`${d.name} 制覇！`),
            el('p',{class:'txt-gold'},'制覇報酬を獲得しました！'),
            rewardList(d.clearReward),
            el('div',{class:'modal-actions'}, el('button',{class:'btn btn-gold',onclick:()=>{document.querySelector('.modal-veil').remove();go('guild');}},'ギルドへ戻る'))));
        } else {
          persist();
          modal(el('div',{class:'center'},
            el('h3',{},`${floor}階 突破！`),
            el('p',{class:'txt-dim'},`コイン+${fmt(rewards.coins)} / EXP+${fmt(rewards.xp)} 獲得。HP/MPが25%回復。`),
            el('div',{class:'modal-actions'},
              el('button',{class:'btn btn-gold',onclick:()=>{document.querySelector('.modal-veil').remove();runDungeon(d,floor+1);}},`次の階へ (${floor+1}F)`),
              el('button',{class:'btn btn-ghost',onclick:()=>{document.querySelector('.modal-veil').remove();go('guild');}},'一度戻る'))));
        }
      } else {
        persist();
        modal(el('div',{class:'center'},
          el('div',{style:{fontSize:'46px'}},'💀'),
          el('h3',{},`${floor}階で敗北…`),
          el('p',{class:'txt-dim'},'進行状況は保存されました。育成して再挑戦しよう。'),
          el('div',{class:'modal-actions'}, el('button',{class:'btn btn-gold',onclick:()=>{document.querySelector('.modal-veil').remove();go('guild');}},'ギルドへ戻る'))));
      }
    }});
  }
  function record2(t){ S.records.unshift({t:new Date().toLocaleDateString('ja-JP'),text:t,type:'gold'}); }
  function rewardList(r){
    const rows=[];
    if(r.coins)rows.push(`🪙 コイン +${fmt(r.coins)}`);
    if(r.points)rows.push(`🏆 対戦P +${fmt(r.points)}`);
    for(const [m,n] of Object.entries(r.mats||{})) rows.push(`${ITEM_MAP[m]?.ico||'📦'} ${ITEM_MAP[m]?.name||m} ×${n}`);
    return el('div',{class:'list mt12',style:{textAlign:'left'}}, rows.map(x=>el('div',{class:'row'},el('span',{class:'r-main r-name',style:{fontSize:'13px'}},x))));
  }

  function tabQuest(){
    const t=S.quests;
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'flex-between'}, el('div',{class:'sec-title'},'デイリークエスト'), el('span',{class:'badge'},t.date)),
        el('p',{class:'hint mb8'},'毎日更新。達成して報酬を受け取ろう。'),
        el('div',{class:'list'}, DAILY_QUESTS.map(q=>{
          const cur=Math.min(q.need, t.counters[q.counter]||0);
          const done=cur>=q.need, claimed=t.claimed[q.id];
          return el('div',{class:'row'+(done&&!claimed?' quest-claimable':'')},
            el('span',{class:'r-ico'},claimed?'✅':done?'🎁':'📜'),
            el('div',{class:'r-main'},
              el('div',{class:'r-name',style:{fontSize:'13px'}},q.name),
              el('div',{class:'r-desc'},`${cur}/${q.need} / 報酬: 🪙${q.reward.coins}${q.reward.points?` 🏆${q.reward.points}`:''}`)),
            el('div',{class:'r-side'},
              claimed?el('span',{class:'badge green'},'受取済'):
              el('button',{class:'btn btn-sm btn-gold', disabled:done?null:'', onclick:()=>{if(claimQuest(q.id)){sfx('coin');toast('報酬を受け取った！','gold');render();}}},'受け取る')));
        }))));
  }
  function tabShop(){
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'flex-between'}, el('div',{class:'sec-title'},'対戦ポイント交換所'), el('span',{class:'res points'},`🏆 ${fmt(S.points)}`)),
        el('p',{class:'hint mb8'},'対戦で貯めたポイントと、限定技・素材・特別装備・称号を交換。'),
        el('div',{class:'list'}, POINT_SHOP.map(p=>{
          let name,desc,ico,bought=false;
          if(p.kind==='skill'){const s=SKILL_MAP[p.skill];name=`技「${s.name}」`;desc=`${s.cat} / ${s.elem} / 威力${s.power||'—'}`;ico='✨';bought=!!S.pointShopBought[p.id]||ch.skills.includes(p.skill);}
          else if(p.kind==='item'){const it=ITEM_MAP[p.item];name=it.name;desc=it.desc;ico=it.ico;}
          else if(p.kind==='title'){const t=TITLE_MAP[p.title];name=`称号「${t.name}」`;desc=t.desc;ico='🏅';bought=!!S.pointShopBought[p.id];}
          else {const e=SPECIAL_EQUIPS.find(x=>x.id===p.id);name=e.name;desc=`${RARITY[e.rarity].name} / ${e.desc}`;ico=SLOTS[e.slot].ico;}
          return el('div',{class:'row'},
            el('span',{class:'r-ico'},ico),
            el('div',{class:'r-main'}, el('div',{class:'r-name',style:{fontSize:'13px'}},name), el('div',{class:'r-desc'},desc)),
            el('div',{class:'r-side'},
              el('span',{class:'num txt-blue'},`🏆${fmt(p.cost)}`),
              bought?el('span',{class:'badge green'},'交換済'):
              el('button',{class:'btn btn-sm btn-gold', disabled:S.points>=p.cost?null:'', onclick:()=>{
                const r=buyPointShop(p.id);
                if(r.ok){sfx('rare');toast('交換しました！','gold');render();}else toast(r.msg,'bad');
              }},'交換')));
        }))));
  }
  function tabRecord(){
    const rank=rankOf(S.rp), nr=nextRank(S.rp);
    const claimable=RANKS.filter(r=>r.rp>0&&S.rp>=r.rp&&!S.rankClaimed.includes(r.id));
    return el('div',{},
      el('div',{class:'panel'},
        el('div',{class:'sec-title'},'対戦戦績'),
        el('div',{class:'stat-grid'},
          el('div',{class:'stat-row'},el('span',{class:'sn'},'勝利'),el('span',{class:'sv num txt-green'},fmt(S.counters.wins))),
          el('div',{class:'stat-row'},el('span',{class:'sn'},'敗北'),el('span',{class:'sv num txt-red'},fmt(S.counters.losses))),
          el('div',{class:'stat-row'},el('span',{class:'sn'},'連勝'),el('span',{class:'sv num txt-gold'},`${S.streak} (最高${S.counters.bestStreak})`)),
          el('div',{class:'stat-row'},el('span',{class:'sn'},'ボス撃破'),el('span',{class:'sv num'},fmt(S.counters.bossKills)))),
        el('div',{class:'divider'}),
        el('div',{class:'flex-between'}, el('span',{},`${rank.ico} ${rank.name} / ${fmt(S.rp)} RP`), nr?el('span',{class:'txt-dim small'},`次: ${nr.name} (${fmt(nr.rp-S.rp)}RP)`):null),
        el('div',{class:'bar xp mt8'}, el('i',{style:{width:(nr?pct(S.rp-rank.rp,nr.rp-rank.rp):100)+'%'}})),
        claimable.length?el('button',{class:'btn btn-gold btn-block mt12', onclick:()=>{
          const got=claimRankRewards(); sfx('rare'); toast(`${got.length}件のランク報酬を獲得！`,'gold'); render();
        }},`🎁 ランク報酬を受け取る (${claimable.length}件)`):null),
      el('div',{class:'panel mt12'},
        el('div',{class:'sec-title'},'育成記録'),
        el('div',{style:{maxHeight:'340px',overflowY:'auto'}},
          S.records.length?S.records.slice(0,80).map(r=>el('div',{class:'record-line '+r.type}, el('time',{},r.t), r.text)):empty('記録はまだありません'))));
  }
  render();
  body.append(charSummary(ch,{compact:true}), el('div',{class:'mt12'},tabs), content);
  return facilityScreen({bg:'guild',title:'冒険者ギルド',sub:'CPU対戦・ダンジョン・クエスト・戦績',active:'guild',body});
}
