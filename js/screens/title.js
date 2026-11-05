// ============ タイトル画面 ============
import { el } from '../util.js';
import { go, toast } from '../ui.js';
import { S } from '../state.js';
import { sfx, playBGM, initAudio } from '../audio.js';
import { hasSaveHint } from '../save.js';

export function renderTitle(){
  playBGM('title');
  const sparks = el('div',{style:{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none',zIndex:'1'}});
  for (let i=0;i<26;i++){
    const s = el('span',{class:'title-spark'});
    const size = 2+Math.random()*4;
    Object.assign(s.style,{
      width:size+'px', height:size+'px',
      left:Math.random()*100+'%', top:60+Math.random()*40+'%',
      animationDuration:(4+Math.random()*6)+'s', animationDelay:(Math.random()*6)+'s',
      opacity:0.3+Math.random()*0.6,
    });
    sparks.append(s);
  }
  const hasChars = S.characters.length>0;
  const menu = el('div',{class:'title-menu'},
    el('button',{class:'btn', onclick:()=>{initAudio();sfx('confirm');go('create');}},'ゲームスタート'),
    el('button',{class:'btn', onclick:()=>{initAudio();sfx('confirm');
      if(S.characters.length>0||hasSaveHint()) go('hub'); else {toast('まずはキャラクターを作成しましょう','');go('create');}}},'つづきから'),
    el('button',{class:'btn', onclick:()=>{initAudio();sfx('confirm');go('create');}},'キャラクター作成'),
    el('button',{class:'btn', onclick:()=>{initAudio();sfx('click');go('codex');}},'図鑑'),
    el('button',{class:'btn', onclick:()=>{initAudio();sfx('click');go('settings');}},'設定'),
  );
  return el('div',{class:'screen title-screen'},
    el('div',{class:'title-bg'}),
    sparks,
    el('div',{class:'title-inner'},
      el('div',{class:'title-emblem'},'⚔️'),
      el('h1',{class:'title-logo'},'オリキャラファイターズ'),
      el('div',{class:'title-sub'},'ORIGINAL CHARACTER FIGHTERS'),
      menu,
      el('div',{class:'title-foot'}, hasChars?`登録キャラクター: ${S.characters.length}体 / 総戦績 ${S.counters.wins}勝${S.counters.losses}敗`:'自分だけのオリキャラを育てて戦おう！')),
  );
}
