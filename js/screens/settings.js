// ============ 設定 ============
import { el, bus } from '../util.js?v=20261105c';
import { go, topbar, bottomNav, modal, toast, confirmModal } from '../ui.js?v=20261105c';
import { S, persist, persistNow, setState, defaultState } from '../state.js?v=20261105c';
import { setVolumes, sfx, stopBGM } from '../audio.js?v=20261105c';
import { exportSave, deleteSave, loadGame } from '../save.js?v=20261105c';

export function renderSettings(){
  const body=el('div',{style:{maxWidth:'720px',margin:'0 auto'}});
  const st=S.settings;
  const volRow=(label, key)=>{
    const cv=el('span',{class:'cv'},Math.round(st[key]*100)+'%');
    const input=el('input',{type:'range',min:'0',max:'100',value:Math.round(st[key]*100), oninput:e=>{
      st[key]=+e.target.value/100; cv.textContent=e.target.value+'%'; setVolumes(st.bgm,st.sfx); persist();
    }});
    return el('div',{class:'ctrl-row'}, el('label',{},label), input, cv);
  };
  const toggle=(label, key, desc)=>{
    const sw=el('button',{class:'switch'+(st[key]?' on':''), onclick:()=>{st[key]=!st[key];sw.classList.toggle('on',st[key]);persist();sfx('click');}});
    return el('div',{class:'ctrl-row'}, el('label',{},label), sw, el('span',{class:'txt-dim small'},desc));
  };
  const fileInput=el('input',{type:'file',accept:'application/json',style:{display:'none'}});
  fileInput.addEventListener('change', async e=>{
    const f=e.target.files[0]; if(!f) return;
    try {
      const text=await f.text(); const data=JSON.parse(text);
      if(!data.characters||!data.version) throw new Error('invalid');
      setState(data); await persistNow(); sfx('confirm'); toast('セーブデータを読み込みました','good'); go('hub');
    } catch(err){ toast('セーブデータの読み込みに失敗しました','bad'); }
  });
  body.append(
    el('div',{class:'panel ornate'},
      el('div',{class:'sec-title'},'サウンド'),
      volRow('BGM音量','bgm'), volRow('効果音音量','sfx')),
    el('div',{class:'panel ornate mt12'},
      el('div',{class:'sec-title'},'バトル設定'),
      toggle('画面揺れ','shake','会心・必殺技時の振動演出'),
      toggle('ダメージ数字','dmgNumbers','戦闘中の数字表示'),
      toggle('デフォルト自動戦闘','autoBattle','戦闘開始時に自動バトルをON'),
      el('div',{class:'ctrl-row'}, el('label',{},'戦闘速度'),
        el('div',{class:'seg'}, [1,2,3].map(v=>el('button',{class:st.speed===v?'on':'', onclick:e=>{st.speed=v;persist();sfx('click');
          e.target.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));e.target.classList.add('on');}},`x${v}`))))),
    el('div',{class:'panel ornate mt12'},
      el('div',{class:'sec-title'},'セーブデータ'),
      el('p',{class:'hint mb8'},'ゲームは自動セーブされます。バックアップの書き出し・読み込みができます。'),
      el('div',{class:'flex'},
        el('button',{class:'btn btn-blue', onclick:async()=>{await persistNow();exportSave(S);sfx('confirm');toast('セーブデータを書き出しました','good');}},'📤 書き出し'),
        el('button',{class:'btn btn-ghost', onclick:()=>fileInput.click()},'📥 読み込み'),
        el('button',{class:'btn btn-red', onclick:()=>confirmModal('全てのセーブデータを削除しますか？\nこの操作は取り消せません。', async()=>{
          await deleteSave(); setState(defaultState()); stopBGM(); sfx('cancel'); toast('データを削除しました','bad'); go('title');
        })},'🗑️ データ削除')),
      fileInput),
    el('div',{class:'panel mt12 center'},
      el('div',{class:'sec-title',style:{justifyContent:'center'}},'オリキャラファイターズ'),
      el('p',{class:'txt-dim small'},'自分の画像からオリキャラを作り、育てて、CPUと戦う2D育成RPG。'),
      el('p',{class:'txt-dim small'},'技215種 / 職業22種 / 装備6レアリティ / 覚醒5段階 / 転生・ダンジョン・実績搭載'),
      el('p',{class:'txt-dim small',style:{marginTop:'6px'}},`ビルド: ${document.documentElement.dataset.build||'dev'}(元画像そのまま使用版)`),
      el('button',{class:'btn btn-gold mt12', onclick:()=>{sfx('click');go('title');}},'タイトルへ戻る')));
  return el('div',{class:'screen'},
    el('div',{class:'screen-bg', style:{backgroundImage:'url(assets/bg/shop.jpg)'}}),
    topbar('設定'),
    el('div',{class:'screen-body'}, body),
    bottomNav(''));
}
