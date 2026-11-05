// ============ 拠点画面 ============
import { el, fmt, bus } from '../util.js';
import { go, topbar, bottomNav, charSummary, modal, toast } from '../ui.js';
import { S, activeChar, persist, persistNow, charPower } from '../state.js';
import { JOB_MAP } from '../data/jobs.js';
import { rankOf, nextRank } from '../data/meta.js';
import { sfx, playBGM } from '../audio.js';

const FACILITIES = [
  {id:'hall', bg:'hall', name:'育成の間', desc:'レベル・職業・技・覚醒・転生', ico:'🔮'},
  {id:'forge', bg:'forge', name:'武器・装備工房', desc:'装備変更・ガチャ・強化・合成', ico:'⚒️'},
  {id:'dojo', bg:'dojo', name:'修行場', desc:'トレーニング・技の練習・修行クエスト', ico:'⛩️'},
  {id:'guild', bg:'guild', name:'冒険者ギルド', desc:'CPU対戦・ダンジョン・クエスト・戦績', ico:'⚔️'},
  {id:'shop', bg:'shop', name:'道具屋', desc:'アイテム・素材・技の書の購入/売却', ico:'🧪'},
];

export function renderHub(){
  playBGM('facility');
  const ch = activeChar();
  const body = el('div',{class:'hub-wrap'});
  const rank = rankOf(S.rp), nr = nextRank(S.rp);
  body.append(
    el('div',{class:'flex-between'},
      el('div',{class:'sec-title', style:{margin:'0'}},'拠点'),
      el('div',{class:'flex'},
        el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{sfx('click');charSelect();}},'👥 キャラ変更'),
        el('button',{class:'btn btn-sm btn-gold', onclick:()=>{sfx('click');go('create');}},'＋ 新規作成'),
        el('button',{class:'btn btn-sm btn-blue', onclick:async()=>{await persistNow();sfx('confirm');toast('セーブしました','good');}},'💾 セーブ'))),
    charSummary(ch),
    el('div',{class:'facility-grid'},
      FACILITIES.map(f=>el('button',{class:'facility-card', onclick:()=>{sfx('confirm');go(f.id);}},
        el('img',{src:`assets/bg/${f.bg}.jpg`, alt:f.name}),
        el('span',{class:'fc-label'},`${f.ico} ${f.name}`, el('span',{class:'fc-desc'},f.desc))))),
    el('div',{class:'panel'},
      el('div',{class:'flex-between'},
        el('div',{},
          el('div',{class:'sec-title'},'現在のランク'),
          el('div',{class:'flex'}, el('span',{style:{fontSize:'26px'}},rank.ico),
            el('span',{class:'num txt-gold', style:{fontSize:'19px'}},rank.name),
            el('span',{class:'txt-dim small'},`${fmt(S.rp)} RP`))),
        el('div',{class:'txt-dim small'}, nr?`次のランク「${nr.name}」まで ${fmt(nr.rp-S.rp)} RP`:'最高ランク到達！')),
      el('div',{class:'divider'}),
      el('div',{class:'flex', style:{gap:'18px'}},
        el('span',{class:'small'},`🏆 ${S.counters.wins}勝 ${S.counters.losses}敗`),
        el('span',{class:'small txt-gold'},`🔥 連勝 ${S.streak} (最高${S.counters.bestStreak})`),
        el('span',{class:'small'},`📚 図鑑: 技${Object.keys(S.codex.skills).length} / 装備${Object.keys(S.codex.equip).length}`))),
  );
  if (!ch){
    body.append(el('div',{class:'panel center'},
      el('p',{class:'txt-dim'},'まだキャラクターがいません。あなたの画像からオリキャラを作りましょう！'),
      el('button',{class:'btn btn-gold btn-lg mt12', onclick:()=>go('create')},'✨ キャラクターを作成する')));
  }
  const node = el('div',{class:'screen'},
    el('div',{class:'screen-bg', style:{backgroundImage:'url(assets/bg/hall.jpg)'}}),
    topbar('オリキャラファイターズ'),
    el('div',{class:'screen-body'}, body),
    bottomNav('hub'));
  bus.on('rerender', ()=>{ if(document.body.contains(node)) go('hub'); });
  return node;
}

function charSelect(){
  const list = el('div',{class:'list'},
    S.characters.map(c=>{
      const j = JOB_MAP[c.job];
      return el('div',{class:'row clickable'+(c.id===S.activeCharId?' rar-border-L':''), onclick:()=>{
        S.activeCharId=c.id; persist(); sfx('confirm'); m.close(); go('hub');
      }},
        el('div',{class:'opp-sprite'}, el('img',{src:c.sprite, style:{objectFit:'contain'}})),
        el('div',{class:'r-main'},
          el('div',{class:'r-name'}, c.name, c.id===S.activeCharId?el('span',{class:'badge gold',style:{marginLeft:'6px'}},'使用中'):null),
          el('div',{class:'r-desc'},`Lv${c.level} ${j.name} / 戦力${fmt(charPower(c))} / ${c.wins}勝${c.losses}敗`)),
      );
    }));
  const m = modal(el('div',{}, el('h3',{},'キャラクター変更'), S.characters.length?list:el('p',{class:'empty-note'},'キャラクターがいません')));
}
