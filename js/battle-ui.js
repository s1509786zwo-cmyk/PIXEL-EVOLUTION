// ============ 戦闘画面(Canvas演出) ============
import { el, $, fmt, clamp, loadImage, sleep } from './util.js?v=20261105c';
import { go, toast, modal } from './ui.js?v=20261105c';
import { S, activeChar, buildPlayerUnit, syncCharVitals, battleRewards, persist } from './state.js?v=20261105c';
import { Battle } from './battle.js?v=20261105c';
import { SKILL_MAP, ELEMENTS } from './data/skills.js?v=20261105c';
import { JOB_MAP } from './data/jobs.js?v=20261105c';
import { ITEM_MAP } from './data/items.js?v=20261105c';
import { enemySprite } from './sprites.js?v=20261105c';
import { makeOpponent } from './data/enemies.js?v=20261105c';
import { sfx, playBGM } from './audio.js?v=20261105c';
import { AWAKEN_STAGES } from './data/items.js?v=20261105c';
import { SIZE_MULT } from './image-edit.js?v=20261105c';

const ELEM_FX = {none:'#cfd8ec',fire:'#ff8a50',ice:'#7fd4ff',bolt:'#ffe066',wind:'#9fe8b0',light:'#fff3b0',dark:'#b48cf2'};
const CONSUMABLES = ['potion','hi_potion','ether','hi_ether','elixir','antidote'];
let bgImg = null;
loadImage('assets/bg/dojo.jpg').then(i=>bgImg=i).catch(()=>{});

export function startBattle({enemy, enemies, bossId=null, noItems=false, noFlee=false, label='CPU対戦', silentResult=false, onEnd=null}){
  const ch = activeChar();
  if (!ch){ toast('キャラクターが必要です','bad'); return; }
  const list = enemies || [enemy];
  let waveIdx = 0;
  const bag = {}; for (const id of CONSUMABLES) bag[id]=S.inventory[id]||0;
  const startBag = {...bag};
  let playerSpec = buildPlayerUnit(ch);
  let battle = null;
  let speed = S.settings.speed||1;
  let auto = S.settings.autoBattle||false;
  let busy = false, ended=false;
  const particles=[], floats=[];
  const vis = [{lunge:0,flash:0,shake:0,glow:0},{lunge:0,flash:0,shake:0,glow:0}];
  let shakeScreen=0;

  // ===== DOM =====
  const canvas = el('canvas',{id:'battle-canvas'});
  const pHud = mkHud(), eHud = mkHud();
  const logBox = el('div',{class:'battle-log'});
  const banner = el('div',{class:'turn-banner'});
  const controls = el('div',{class:'battle-controls'});
  const topLabel = el('span',{class:'bt-label'}, label);
  const roundLabel = el('span',{class:'txt-dim small'},'');
  const speedBtn = el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{speed=speed>=3?1:speed+1;speedBtn.textContent=`速度 x${speed}`;}},`速度 x${speed}`);
  const autoBtn = el('button',{class:'btn btn-sm '+(auto?'btn-gold':'btn-ghost'), onclick:()=>{auto=!auto;autoBtn.className='btn btn-sm '+(auto?'btn-gold':'btn-ghost');autoBtn.textContent=auto?'自動:ON':'自動:OFF';if(auto&&!busy)maybeAuto();}},auto?'自動:ON':'自動:OFF');
  const screen = el('div',{class:'screen battle-screen'},
    el('div',{class:'battle-top'}, topLabel, roundLabel, speedBtn, autoBtn,
      el('button',{class:'btn btn-sm btn-red', onclick:()=>tryFlee()},'逃走')),
    el('div',{class:'battle-stage'},
      el('div',{class:'battle-canvas-wrap'}, canvas,
        el('div',{class:'battle-hud'}, pHud.root, eHud.root),
        logBox, banner),
      controls));
  $('#app').innerHTML=''; $('#app').append(screen);
  playBGM(bossId||list[0].isBoss?'boss':'battle');

  function mkHud(){
    const name=el('div',{class:'bh-name'}), hp=el('div',{class:'bar hp'},el('i'),el('span')),
      mp=el('div',{class:'bar mp'},el('i'),el('span')), gg=el('div',{class:'bar gg'},el('i'),el('span')),
      eff=el('div',{class:'bh-effects'});
    const root=el('div',{class:'bhud'},name,hp,mp,gg,eff);
    return {root,name,hp,mp,gg,eff};
  }
  function updateHud(){
    if(!battle) return;
    const [p,e]=battle.units;
    for(const [u,h] of [[p,pHud],[e,eHud]]){
      h.name.innerHTML=''; h.name.append(el('span',{},u.name), el('small',{},`Lv${u.level} ${JOB_MAP[u.job]?.name||''} ${ELEMENTS[u.elem].ico}`));
      h.hp.querySelector('i').style.width=clamp(u.hp/u.maxHp*100,0,100)+'%'; h.hp.querySelector('span').textContent=`HP ${fmt(u.hp)}/${fmt(u.maxHp)}`;
      h.mp.querySelector('i').style.width=clamp(u.mp/u.maxMp*100,0,100)+'%'; h.mp.querySelector('span').textContent=`MP ${fmt(u.mp)}/${fmt(u.maxMp)}`;
      h.gg.querySelector('i').style.width=clamp(u.gauge,0,100)+'%'; h.gg.querySelector('span').textContent=`闘志 ${Math.round(u.gauge)}/100`;
      h.eff.innerHTML='';
      for(const ef of u.effects){ h.eff.append(el('span',{class:'ef-ico', title:`${ef.s} ${ef.dur}T`}, (EF_ICON[ef.s]||'◆')+ef.dur)); }
    }
    roundLabel.textContent=`ROUND ${battle.round}`;
  }
  const EF_ICON={poison:'☠️',burn:'🔥',stun:'💫',sleep:'💤',blind:'🌫️',silence:'🔇',freeze:'🧊',regen:'💚',shield:'🛡️',counter:'↩️',guard:'🔰',dodge:'👤',focus:'🎯',atk:'⚔️',def:'🛡️',spd:'💨',mag:'🔮',acc:'🎯',eva:'🌀'};

  // ===== Canvas =====
  const ctx = canvas.getContext('2d');
  let W=0,H=0, raf=null, t0=performance.now();
  const playerImg = new Image(); playerImg.src = playerSpec.sprite;
  let enemyCanvas = null;
  function resize(){
    const wrap=canvas.parentElement;
    W=canvas.width=wrap.clientWidth*devicePixelRatio; H=canvas.height=wrap.clientHeight*devicePixelRatio;
  }
  window.addEventListener('resize',resize); resize();
  function draw(now){
    raf=requestAnimationFrame(draw);
    const t=(now-t0)/1000;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
    // 背景
    if(bgImg){ const s=Math.max(W/bgImg.width,H/bgImg.height); const dw=bgImg.width*s,dh=bgImg.height*s;
      ctx.drawImage(bgImg,(W-dw)/2,(H-dh)/2,dw,dh); }
    else { ctx.fillStyle='#101628'; ctx.fillRect(0,0,W,H); }
    ctx.fillStyle='rgba(6,9,18,0.45)'; ctx.fillRect(0,0,W,H);
    if(battle&&battle.units[1].isBoss){ ctx.fillStyle='rgba(60,10,30,0.25)'; ctx.fillRect(0,0,W,H); }
    // 地面
    const gy=H*0.8;
    const grd=ctx.createLinearGradient(0,gy,0,H); grd.addColorStop(0,'rgba(20,26,46,0.2)'); grd.addColorStop(1,'rgba(8,11,22,0.85)');
    ctx.fillStyle=grd; ctx.fillRect(0,gy,W,H-gy);
    // 画面揺れ
    let sx=0,sy=0; if(shakeScreen>0){ sx=(Math.random()-0.5)*shakeScreen*devicePixelRatio; sy=(Math.random()-0.5)*shakeScreen*devicePixelRatio; shakeScreen*=0.86; if(shakeScreen<0.3)shakeScreen=0; }
    ctx.translate(sx,sy);
    if(battle){
      drawUnit(0, W*0.26, gy, t, playerImg, true);
      drawUnit(1, W*0.74, gy, t, enemyCanvas, false);
    }
    // パーティクル
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i]; p.life-=0.016*speed; p.x+=p.vx*speed; p.y+=p.vy*speed; p.vy+=p.g||0;
      if(p.life<=0){particles.splice(i,1);continue;}
      ctx.globalAlpha=clamp(p.life/p.max,0,1); ctx.fillStyle=p.color;
      ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
    ctx.globalAlpha=1;
    // ダメージ数字
    for(let i=floats.length-1;i>=0;i--){
      const f=floats[i]; f.life-=0.016*speed; f.y-=0.7*speed*devicePixelRatio;
      if(f.life<=0){floats.splice(i,1);continue;}
      ctx.globalAlpha=clamp(f.life/f.max,0,1);
      ctx.font=`900 ${f.size*devicePixelRatio}px sans-serif`; ctx.textAlign='center';
      ctx.lineWidth=3*devicePixelRatio; ctx.strokeStyle='rgba(0,0,0,0.8)';
      ctx.strokeText(f.text,f.x,f.y); ctx.fillStyle=f.color; ctx.fillText(f.text,f.x,f.y);
    }
    ctx.globalAlpha=1;
  }
  function drawUnit(idx, x, gy, t, img, isPlayer){
    const u=battle.units[idx]; const v=vis[idx];
    const ie = isPlayer ? (ch.imageEdit||{}) : {};
    const sizeMult = isPlayer ? (SIZE_MULT[ie.size]||1) : 1;
    const zoom = isPlayer ? Math.max(0.3, Math.min(4, ie.zoom||1)) : 1;
    const sizeF = isPlayer ? sizeMult*zoom : (u.isBoss?1.25:1);
    const hgt = Math.min(H*0.42, 210*devicePixelRatio)*sizeF;
    const bob = Math.sin(t*2.2+idx*2)*3*devicePixelRatio;
    let dx=0; if(v.lunge>0){ dx=(isPlayer?1:-1)*Math.sin(v.lunge*Math.PI)*46*devicePixelRatio; v.lunge=Math.max(0,v.lunge-0.05*speed); }
    let shx=0; if(v.shake>0){ shx=(Math.random()-0.5)*v.shake*devicePixelRatio; v.shake*=0.85; if(v.shake<0.3)v.shake=0; }
    // 画像エディタの位置オフセットを反映(プレイヤーのみ)
    const offX = isPlayer ? (ie.x||0)*W*0.18 : 0;
    const offY = isPlayer ? (ie.y||0)*H*0.12 : 0;
    const px=x+dx+shx+offX, py=gy+bob+offY;
    // 覚醒オーラ
    if(isPlayer&&ch.awaken>0){ const col=AWAKEN_STAGES[ch.awaken-1].color;
      ctx.save(); ctx.globalAlpha=0.25+0.12*Math.sin(t*3);
      const g=ctx.createRadialGradient(px,py-hgt*0.5,5,px,py-hgt*0.5,hgt*0.75);
      g.addColorStop(0,col); g.addColorStop(1,'transparent'); ctx.fillStyle=g;
      ctx.fillRect(px-hgt,py-hgt*1.4,hgt*2,hgt*1.6); ctx.restore(); }
    if(v.glow>0){ ctx.save(); ctx.globalAlpha=v.glow*0.5; ctx.fillStyle=ELEM_FX[battle.lastElem||'none'];
      ctx.beginPath(); ctx.arc(px,py-hgt*0.5,hgt*0.6,0,7); ctx.fill(); ctx.restore(); v.glow=Math.max(0,v.glow-0.04*speed); }
    // スプライト(プレイヤーは元画像を高品質のまま / 敵はドット絵)
    ctx.save();
    ctx.imageSmoothingEnabled = isPlayer ? true : false;
    ctx.imageSmoothingQuality = 'high';
    const src = img;
    if(src&&(isPlayer?img.complete: true)){
      const iw=src.width||src.naturalWidth, ih=src.height||src.naturalHeight;
      const scale=hgt/ih; const dw=iw*scale; // 縦横比を維持
      if(!isPlayer){ ctx.translate(px,0); ctx.scale(-1,1); ctx.drawImage(src,-dw/2,py-hgt,dw,hgt); }
      else ctx.drawImage(src,px-dw/2,py-hgt,dw,hgt);
    }
    ctx.restore();
    // ヒットフラッシュ
    if(v.flash>0){ ctx.save(); ctx.globalAlpha=v.flash*0.7; ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='#fff'; const iw=(src?.width||60),ih=(src?.height||60); const scale=hgt/ih; const dw=iw*scale;
      ctx.fillRect(px-dw/2,py-hgt,dw,hgt); ctx.restore(); v.flash=Math.max(0,v.flash-0.08*speed); }
    // 影
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x,gy+4*devicePixelRatio,hgt*0.32,hgt*0.07,0,0,7); ctx.fill(); ctx.restore();
  }
  function burst(x,y,color,n=18,spd=3){
    for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2; const v=(0.5+Math.random())*spd*devicePixelRatio;
      particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1,g:0.06*devicePixelRatio,size:(2+Math.random()*3)*devicePixelRatio,color,life:0.6+Math.random()*0.4,max:1}); }
  }
  function floatText(idx,text,color,size=22){
    const x=idx===0?W*0.26:W*0.74; const y=H*0.8-H*0.3;
    floats.push({x:x+(Math.random()-0.5)*30,y,text,color,size,life:1.1,max:1.1});
  }
  function showBanner(text){ banner.textContent=text; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); }
  function logLine(text){
    const d=el('div',{class:'blog-line'},text); logBox.append(d);
    while(logBox.children.length>4) logBox.firstChild.remove();
  }
  const wait = ms => sleep(ms/speed);

  // ===== イベント再生 =====
  async function play(events){
    busy=true; setControls(false);
    for(const ev of events){
      if(ev.t==='log'){ logLine(ev.text); }
      else if(ev.t==='round'){ /* round */ }
      else if(ev.t==='turn'){ updateHud(); }
      else if(ev.t==='action'){ await playAction(ev); }
      else if(ev.t==='heal'){ vis[ev.unit].glow=1; burst(ev.unit===0?W*0.26:W*0.74,H*0.55,'#7ed491',14,2); floatText(ev.unit,'+'+fmt(ev.amount),'#7ed491'); sfx('heal'); updateHud(); await wait(350); }
      else if(ev.t==='dot'){ burst(ev.unit===0?W*0.26:W*0.74,H*0.55,ev.kind==='poison'?'#9fe87e':'#ff8a50',10,2); floatText(ev.unit,'-'+fmt(ev.amount),ev.kind==='poison'?'#9fe87e':'#ff8a50',18); updateHud(); await wait(280); }
      else if(ev.t==='counter'){ vis[ev.target].flash=1; vis[ev.target].shake=8; floatText(ev.target,'-'+fmt(ev.amount),'#ffd27f',18); sfx('hit'); updateHud(); await wait(300); }
      else if(ev.t==='defend'){ vis[ev.unit].glow=1; sfx('buff'); updateHud(); await wait(300); }
      else if(ev.t==='item'){ sfx('heal'); updateHud(); await wait(300); }
      else if(ev.t==='skip'){ floatText(ev.unit,'行動不能','#9aa3bd',16); await wait(400); }
      else if(ev.t==='end'){ /* handled after */ }
    }
    updateHud();
    busy=false;
  }
  async function playAction(ev){
    const u=battle.units[ev.unit]; const target=1-ev.unit;
    const s=ev.skill; battle.lastElem=s.elem;
    logLine(`${u.name} の「${s.name}」！`);
    const isAtk=['phys','magic','summon','ultimate'].includes(s.cat)&&ev.hits.length>0;
    if(isAtk){
      vis[ev.unit].lunge=1;
      if(['magic','summon'].includes(s.cat)){ vis[ev.unit].glow=1; sfx('magic'); }
      await wait(220);
      const col=ELEM_FX[s.elem]||'#fff';
      for(const h of ev.hits){
        if(h.miss){ floatText(target,'MISS','#9aa3bd',18); await wait(140); continue; }
        vis[target].flash=1; vis[target].shake=h.crit?12:7;
        burst(target===0?W*0.26:W*0.74, H*0.55, col, h.crit?30:18, h.crit?4.5:3);
        floatText(target, fmt(h.dmg)+(h.crit?'!':''), h.crit?'#ffd24f':'#ffffff', h.crit?30:22);
        if(h.eff>1) floatText(target,'弱点!','#ffd24f',14);
        if(h.crit){ shakeScreen=10; sfx('crit'); } else sfx(s.cat==='magic'||s.cat==='summon'?'magic':'hit');
        if(s.cat==='ultimate') shakeScreen=14;
        updateHud(); await wait(160);
      }
      if(ev.heal>0){ floatText(ev.unit,'+'+fmt(ev.heal),'#7ed491',18); }
      await wait(200);
    } else {
      vis[ev.unit].glow=1; sfx(s.cat==='heal'?'heal':s.cat==='debuff'?'debuff':'buff');
      burst(ev.unit===0?W*0.26:W*0.74,H*0.55, s.cat==='debuff'?'#b48cf2':'#9fd4ff',16,2);
      if(ev.heal>0) floatText(ev.unit,'+'+fmt(ev.heal),'#7ed491');
      for(const a of ev.applied) floatText(target,a,'#b48cf2',14);
      for(const a of ev.selfEffects) floatText(ev.unit,a,'#9fd4ff',13);
      updateHud(); await wait(450);
    }
  }

  // ===== 進行 =====
  async function proceed(){
    if(ended) return;
    updateHud();
    if(battle.over){ await finishBattle(); return; }
    const cur=battle.current();
    if(!cur){ return; }
    if(cur.isPlayer){
      if(auto){ await maybeAuto(); }
      else setControls(true);
    } else {
      setControls(false);
      await wait(500);
      if(ended) return;
      const evs=battle.aiAct();
      await play(evs);
      await proceed();
    }
  }
  async function maybeAuto(){
    if(ended||busy) return;
    setControls(false);
    await wait(420);
    if(ended) return;
    const cur=battle.current();
    if(cur&&cur.isPlayer){ const evs=battle.submit(battle.aiChoose(cur)); await play(evs); await proceed(); }
  }
  async function playerAction(action){
    if(busy||ended) return;
    const cur=battle.current(); if(!cur||!cur.isPlayer) return;
    setControls(false);
    const evs=battle.submit(action);
    await play(evs);
    await proceed();
  }
  function tryFlee(){
    if(busy||ended) return;
    const cur=battle.current(); if(!cur||!cur.isPlayer) return;
    playerAction({type:'flee'});
  }

  // ===== コントロール =====
  function setControls(enabled){
    controls.innerHTML='';
    if(!enabled){ controls.append(el('div',{class:'txt-dim small center', style:{padding:'12px'}}, busy?'戦闘中…':'相手のターン…')); return; }
    const u=battle.current();
    const main=el('div',{class:'bc-main'},
      el('button',{class:'btn', onclick:()=>playerAction({type:'attack'})},'⚔️ 攻撃'),
      el('button',{class:'btn btn-blue', onclick:()=>showSkills()},'✨ 技'),
      el('button',{class:'btn btn-green', onclick:()=>playerAction({type:'defend'})},'🛡️ 防御'),
      el('button',{class:'btn btn-gold', disabled:noItems?'':null, onclick:()=>showItems()},'🎒 道具'));
    controls.append(main);
  }
  function showSkills(){
    const u=battle.current();
    const usable=battle.usableSkills(u);
    const menu=el('div',{class:'skill-menu'},
      el('button',{class:'skill-btn', onclick:()=>playerAction({type:'attack'})},
        el('div',{class:'sk-n'},'⚔️ 通常攻撃'), el('div',{class:'sk-d'},'MP消費なし')),
      ...u.skills.map(id=>{
        const s=SKILL_MAP[id]; const ok=usable.find(x=>x.id===id);
        const cd=u.cds[id]||0; const cost=battle.mpCost(u,s);
        const reason=!ok?(cd>0?`CD${cd}`:u.mp<cost?'MP不足':s.gauge&&u.gauge<s.gauge?`闘志${s.gauge}必要`:'使用不可'):'';
        return el('button',{class:'skill-btn', disabled:ok?null:'', onclick:()=>playerAction({type:'skill',id})},
          el('div',{class:'sk-n'}, el('span',{},`${ELEMENTS[s.elem].ico} ${s.name}`), el('span',{class:'txt-dim'},reason)),
          el('div',{class:'sk-d'},`威力${s.power||'—'} MP${cost}${s.cd?` CD${s.cd}`:''}${s.gauge?` 闘志${s.gauge}`:''}`));
      }));
    controls.innerHTML=''; controls.append(el('div',{class:'flex-between'}, el('span',{class:'small txt-dim'},'技を選択'),
      el('button',{class:'btn btn-sm btn-ghost', onclick:()=>setControls(true)},'戻る')), menu);
  }
  function showItems(){
    const items=CONSUMABLES.filter(id=>(battle.bag[id]||0)>0);
    const menu=el('div',{class:'skill-menu'},
      ...items.map(id=>el('button',{class:'skill-btn', onclick:()=>playerAction({type:'item',id})},
        el('div',{class:'sk-n'},`${ITEM_MAP[id].ico} ${ITEM_MAP[id].name} ×${battle.bag[id]}`),
        el('div',{class:'sk-d'},ITEM_MAP[id].desc))),
      !items.length?el('div',{class:'txt-dim small',style:{padding:'10px'}},'使えるアイテムがありません'):null);
    controls.innerHTML=''; controls.append(el('div',{class:'flex-between'}, el('span',{class:'small txt-dim'},'アイテムを選択'),
      el('button',{class:'btn btn-sm btn-ghost', onclick:()=>setControls(true)},'戻る')), menu);
  }

  // ===== 戦闘終了 =====
  async function finishBattle(){
    if(ended) return;
    const win=battle.win;
    // 次のウェーブ
    if(win && waveIdx<list.length-1){
      waveIdx++;
      const pu=battle.units[0];
      playerSpec={...playerSpec, hp:Math.min(pu.maxHp,pu.hp+Math.round(pu.maxHp*0.2)), mp:Math.min(pu.maxMp,pu.mp+Math.round(pu.maxMp*0.2)), gauge:pu.gauge};
      showBanner(`WAVE ${waveIdx+1}`);
      await wait(900);
      battle=new Battle(playerSpec, list[waveIdx], {bag:battle.bag, allowFlee:!bossId});
      enemyCanvas=enemySprite(list[waveIdx].seed, list[waveIdx].job, list[waveIdx].isBoss);
      const evs=battle.start(); await play(evs); await proceed();
      return;
    }
    ended=true;
    cancelAnimationFrame(raf); window.removeEventListener('resize',resize);
    const pu=battle.units[0];
    syncCharVitals(ch,pu);
    // アイテム消費を反映
    for(const id of CONSUMABLES){ const used=startBag[id]-battle.bag[id]; if(used>0) S.inventory[id]=Math.max(0,(S.inventory[id]||0)-used); }
    persist();
    if(silentResult){ onEnd&&onEnd({win, fled:battle.fled, playerUnit:pu, enemy:list[waveIdx]}); return; }
    const rewards=battle.fled?null:battleRewards(ch, list[waveIdx], win, {bossId});
    sfx(win?'victory':'defeat');
    showResult(win, battle.fled, rewards);
  }
  function showResult(win, fled, rewards){
    const rows=[];
    if(rewards){
      rows.push(['🪙 コイン', `+${fmt(rewards.coins)}`]);
      rows.push(['✨ 経験値', `+${fmt(rewards.xp)}`]);
      rows.push(['🏆 対戦ポイント', `+${fmt(rewards.points)}`]);
      rows.push(['🎖️ ランクP', `${rewards.rp>=0?'+':''}${fmt(rewards.rp)}`]);
      rows.push(['📗 職業熟練', `+${fmt(rewards.jobXp)}`]);
      if(rewards.streakBonus>0) rows.push(['🔥 連勝ボーナス', `+${rewards.streakBonus}%`]);
      if(rewards.levels>0) rows.push(['⬆️ レベルアップ', `Lv${ch.level}に！`]);
      if(rewards.drops.length) rows.push(['🎁 ドロップ', rewards.drops.join(', ')]);
    }
    const m=modal(el('div',{class:'center'},
      el('div',{style:{fontSize:'46px'}}, fled?'🏃':win?'🏆':'💀'),
      el('h3',{}, fled?'逃走した':win?'勝利！':'敗北…'),
      fled?el('p',{class:'txt-dim'},'報酬は得られなかった。'):null,
      rewards?el('div',{class:'list mt12', style:{textAlign:'left'}}, rows.map(([k,v])=>
        el('div',{class:'row'}, el('span',{class:'r-main r-name',style:{fontSize:'13px'}},k), el('span',{class:'num txt-gold'},v)))):null,
      !win&&!fled?el('p',{class:'txt-dim mt8'},'少量のポイントを獲得。育成して再挑戦しよう！'):null,
      el('div',{class:'modal-actions'},
        el('button',{class:'btn btn-gold', onclick:()=>{m.close(); onEnd?onEnd({win,fled,rewards}):go('guild');}},'ギルドへ戻る'),
        win&&!bossId?el('button',{class:'btn btn-blue', onclick:()=>{m.close(); startBattle({enemy:makeOpponent(ch.level,'normal'), label:'CPU対戦'});}},'もう一度戦う'):null)));
  }

  // ===== 開始 =====
  enemyCanvas=enemySprite(list[0].seed, list[0].job, list[0].isBoss);
  battle=new Battle(playerSpec, list[0], {bag, allowFlee:!bossId&&!noItems&&!noFlee});
  raf=requestAnimationFrame(draw);
  (async()=>{
    showBanner('戦闘開始');
    const evs=battle.start();
    await play(evs);
    await proceed();
  })();
}
