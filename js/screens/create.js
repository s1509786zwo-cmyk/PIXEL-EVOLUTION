// ============ オリキャラ作成(元画像をそのまま使用・非破壊編集) ============
import { el, $, clamp, loadImage, bus } from '../util.js?v=20261105c';
import { go, topbar, bottomNav, modal, toast } from '../ui.js?v=20261105c';
import { S, createCharacter, persist, STAT_NAME, ALLOC_GAIN, STYLES } from '../state.js?v=20261105c';
import { JOBS, JOB_MAP, WEAPON_TYPES } from '../data/jobs.js?v=20261105c';
import { EDIT_DEFAULTS, SIZE_MULT, SIZE_LABEL, normalizeEdit, removeBackgroundCanvas, renderEdited, drawFitted } from '../image-edit.js?v=20261105c';
import { sfx } from '../audio.js?v=20261105c';

const MAX_SOURCE = 2048;   // 元画像の保存上限(高品質維持)
const MAX_BAKE = 1600;     // 保存する編集済み画像の上限
const MAX_BG = 1400;       // 背景透過処理の作業上限

export async function renderCreate(params={}){
  const editChar = params.edit ? S.characters.find(c=>c.id===params.edit) : null;
  let draft = editChar ? {
    source: editChar.source, sprite: editChar.sprite,
    edit: normalizeEdit(editChar.imageEdit),
    name: editChar.name, job: editChar.job, style: editChar.style, alloc: {...editChar.alloc}, weaponType: null,
  } : (S.draft ? JSON.parse(JSON.stringify(S.draft)) : {
    source:null, sprite:null, edit:{...EDIT_DEFAULTS},
    name:'', job:'fighter', style:'balance', alloc:{hp:0,mp:0,atk:0,def:0,spd:0,mag:0,acc:0,eva:0}, weaponType:null,
  });
  draft.edit = normalizeEdit(draft.edit);

  let img = null;             // 元画像(高品質)
  let editedCanvas = null;    // 色・反転・透過を適用した作業画像
  let bgCache = {key:null, canvas:null};
  let showOriginal = false;
  let rebuildPending = false;

  const fileInput = el('input',{type:'file', accept:'image/png,image/jpeg,image/webp,image/gif,image/bmp', style:{display:'none'}});

  // ===== 左: 大きなプレビュー =====
  const stage = el('div',{class:'img-stage'}, el('canvas'));
  const dropzone = el('div',{class:'dropzone'},
    el('div',{class:'dz-ico'},'🖼️'),
    el('div',{style:{fontWeight:'800'}},'キャラクター画像を読み込む'),
    el('div',{class:'txt-dim small mt8'},'クリック / タップで選択、またはドラッグ&ドロップ'),
    el('div',{class:'txt-dim small'},'PNG・JPEG・WebP など / 写真・イラスト・アニメ画像そのまま使えます'));
  const cmpToggle = el('button',{class:'btn btn-sm btn-ghost', onclick:()=>{showOriginal=!showOriginal;cmpToggle.textContent=showOriginal?'編集後を表示':'元画像と比較';renderPreview();}},'元画像と比較');
  const reselectBtn = el('button',{class:'btn btn-sm btn-ghost', onclick:()=>fileInput.click()},'🔄 画像を変更');
  const leftPanel = el('div',{class:'panel ornate'},
    el('h3',{},'キャラクター画像'),
    dropzone, stage,
    el('div',{class:'flex mt8', style:{justifyContent:'space-between'}}, cmpToggle, reselectBtn),
    el('p',{class:'hint mt8'},'読み込んだ画像をそのまま使用します。ドット絵変換や描き直しは行いません。'));

  // ===== 右: 編集設定 =====
  const sliders = {};
  function sliderRow(label, key, min, max, step, fmtFn, kind){
    const cv = el('span',{class:'cv'}, fmtFn(draft.edit[key]));
    const input = el('input',{type:'range', min, max, step, value:draft.edit[key], oninput:e=>{
      draft.edit[key]=+e.target.value; cv.textContent=fmtFn(draft.edit[key]);
      if(kind==='display') renderPreview(); else scheduleRebuild();
      saveDraft();
    }});
    const row = el('div',{class:'ctrl-row'}, el('label',{},label), input, cv);
    sliders[key]={input, cv, fmtFn};
    return row;
  }
  const setSlider = (key)=>{ const s=sliders[key]; if(s){ s.input.value=draft.edit[key]; s.cv.textContent=s.fmtFn(draft.edit[key]); } };

  // 位置パッド
  const nudge=(dx,dy)=>{ draft.edit.x=clamp(draft.edit.x+dx,-1,1); draft.edit.y=clamp(draft.edit.y+dy,-1,1); setSlider('x');setSlider('y');renderPreview();saveDraft(); };
  const pad = el('div',{class:'pos-pad'},
    el('button',{class:'btn btn-sm', onclick:()=>nudge(0,-0.06)},'▲'),
    el('div',{class:'flex', style:{gap:'4px'}},
      el('button',{class:'btn btn-sm', onclick:()=>nudge(-0.06,0)},'◀'),
      el('button',{class:'btn btn-sm btn-gold', onclick:()=>{draft.edit.x=0;draft.edit.y=0;setSlider('x');setSlider('y');renderPreview();saveDraft();}},'●'),
      el('button',{class:'btn btn-sm', onclick:()=>nudge(0.06,0)},'▶')),
    el('button',{class:'btn btn-sm', onclick:()=>nudge(0,0.06)},'▼'));

  const flipToggle = el('button',{class:'switch'+(draft.edit.flip?' on':''), onclick:()=>{draft.edit.flip=!draft.edit.flip;flipToggle.classList.toggle('on',draft.edit.flip);scheduleRebuild();saveDraft();sfx('click');}});
  const transToggle = el('button',{class:'switch'+(draft.edit.transparent?' on':''), onclick:()=>{draft.edit.transparent=!draft.edit.transparent;transToggle.classList.toggle('on',draft.edit.transparent);scheduleRebuild();saveDraft();sfx('click');}});
  const sizeSeg = el('div',{class:'seg'}, Object.keys(SIZE_MULT).map(sz=>
    el('button',{class:draft.edit.size===sz?'on':'', onclick:e=>{draft.edit.size=sz;sizeSeg.querySelectorAll('button').forEach(b=>b.classList.remove('on'));e.target.classList.add('on');renderPreview();saveDraft();sfx('click');}},SIZE_LABEL[sz])));
  const resetBtn = el('button',{class:'btn btn-red btn-block', onclick:()=>{
    draft.edit={...EDIT_DEFAULTS};
    for(const k in sliders) setSlider(k);
    flipToggle.classList.remove('on'); transToggle.classList.remove('on');
    sizeSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.textContent===SIZE_LABEL.M));
    scheduleRebuild(); saveDraft(); sfx('cancel'); toast('編集をリセットしました','');
  }},'↺ 編集をリセット(元画像に戻す)');

  const rightPanel = el('div',{class:'panel ornate'},
    el('h3',{},'画像の編集'),
    el('div',{class:'sec-title'},'拡大・縮小 / 位置'),
    sliderRow('拡大率','zoom',0.3,4,0.01,v=>Math.round(v*100)+'%','display'),
    sliderRow('左右位置','x',-1,1,0.01,v=>Math.round(v*100),'display'),
    sliderRow('上下位置','y',-1,1,0.01,v=>Math.round(v*100),'display'),
    el('div',{class:'flex', style:{justifyContent:'center'}}, pad),
    el('div',{class:'divider'}),
    el('div',{class:'sec-title'},'色彩の変更(リアルタイム反映)'),
    sliderRow('明るさ','brightness',0,200,1,v=>v+'%','color'),
    sliderRow('コントラスト','contrast',0,200,1,v=>v+'%','color'),
    sliderRow('彩度','saturate',0,200,1,v=>v+'%','color'),
    sliderRow('色相','hue',-180,180,1,v=>v+'°','color'),
    sliderRow('色温度','temperature',-100,100,1,v=>(v>0?'+':'')+v,'color'),
    el('div',{class:'divider'}),
    el('div',{class:'sec-title'},'その他の編集'),
    el('div',{class:'ctrl-row'}, el('label',{},'左右反転'), flipToggle),
    el('div',{class:'ctrl-row'}, el('label',{},'背景の透過'), transToggle, el('span',{class:'txt-dim small'},'背景のみ透明化(輪郭は変更しません)')),
    sliderRow('透過の強さ','bgTol',0,100,1,v=>v,'color'),
    el('div',{class:'ctrl-row'}, el('label',{},'戦闘での大きさ'), sizeSeg),
    el('div',{class:'mt12'}, resetBtn));

  // ===== 下: キャラクター設定 =====
  const nameInput = el('input',{type:'text', maxlength:'16', placeholder:'キャラクター名(16文字まで)', value:draft.name||''});
  const basicJobs = JOBS.filter(j=>j.tier==='basic');
  let jobGrid;
  const jobWrap = el('div',{});
  const buildJobGrid = ()=>{ jobGrid&&jobGrid.remove();
    jobGrid = el('div',{class:'grid-cards'}, basicJobs.map(j=>
      el('div',{class:'mini-card'+(draft.job===j.id?' sel':''), onclick:()=>{draft.job=j.id;sfx('click');buildJobGrid();buildWeaponSeg();saveDraft();}},
        el('h4',{},`${j.ico} ${j.name}`), el('p',{},j.style))));
    jobWrap.append(jobGrid); };
  let weaponSeg; const weaponWrap=el('div',{});
  const buildWeaponSeg = ()=>{ weaponSeg&&weaponSeg.remove();
    const types=JOB_MAP[draft.job].weapons; if(!types.includes(draft.weaponType)) draft.weaponType=types[0];
    weaponSeg = el('div',{class:'seg'}, types.map(t=>
      el('button',{class:draft.weaponType===t?'on':'', onclick:e=>{draft.weaponType=t;weaponSeg.querySelectorAll('button').forEach(b=>b.classList.remove('on'));e.target.classList.add('on');sfx('click');saveDraft();}},
        `${WEAPON_TYPES[t].ico} ${WEAPON_TYPES[t].name}`)));
    weaponWrap.append(weaponSeg); };
  const styleSeg = el('div',{class:'seg'}, STYLES.map(st=>
    el('button',{class:draft.style===st.id?'on':'', title:st.desc, onclick:e=>{draft.style=st.id;styleSeg.querySelectorAll('button').forEach(b=>b.classList.remove('on'));e.target.classList.add('on');sfx('click');saveDraft();}},st.name)));
  let initPoints = 10 - Object.values(draft.alloc).reduce((a,b)=>a+b,0);
  const allocWrap = el('div',{class:'stat-grid'});
  const buildAlloc = ()=>{ allocWrap.innerHTML='';
    allocWrap.append(el('div',{class:'stat-row',style:{gridColumn:'1/-1'}}, el('span',{class:'sn'},'残りポイント'), el('span',{class:'sv num txt-gold'},String(initPoints))));
    for(const k of ['hp','mp','atk','def','spd','mag','acc','eva']){
      allocWrap.append(el('div',{class:'stat-row'},
        el('span',{class:'sn'},STAT_NAME[k]), el('span',{class:'sv num'},String(draft.alloc[k]||0)), el('span',{class:'sb txt-dim small'},`+${ALLOC_GAIN[k]}/pt`),
        el('button',{class:'stat-plus', onclick:()=>{if(initPoints>0){initPoints--;draft.alloc[k]++;sfx('click');buildAlloc();saveDraft();}}},'+'),
        el('button',{class:'stat-plus', style:{background:'linear-gradient(180deg,#5a2f2f,#3a1c1c)',borderColor:'#914646'}, onclick:()=>{if((draft.alloc[k]||0)>0){initPoints++;draft.alloc[k]--;sfx('click');buildAlloc();saveDraft();}}},'−')));
    } };
  const createBtn = el('button',{class:'btn btn-gold btn-lg btn-block', onclick:()=>finish()}, editChar?'💾 画像を保存(育成データは保持)':'🎉 作成完了');
  const setupPanel = el('div',{class:'panel ornate'},
    el('h3',{}, editChar?'画像の保存':'キャラクター設定'),
    !editChar?el('div',{class:'field'}, el('label',{},'キャラクター名'), nameInput):null,
    !editChar?el('div',{class:'field'}, el('label',{},'初期職業'), jobWrap):null,
    !editChar?el('div',{class:'field'}, el('label',{},'初期武器'), weaponWrap):null,
    !editChar?el('div',{class:'field'}, el('label',{},'戦闘スタイル'), styleSeg):null,
    !editChar?el('div',{class:'field'}, el('label',{},'初期能力値(10ポイント)'), allocWrap):null,
    el('div',{class:'mt16'}, createBtn));

  const body = el('div',{class:'create-wrap'},
    el('div',{class:'editor-cols'}, leftPanel, rightPanel), setupPanel);

  // ===== ロジック =====
  function getBgCanvas(){
    if(!draft.edit.transparent) return null;
    const key = draft.edit.bgTol;
    if(bgCache.key===key && bgCache.canvas) return bgCache.canvas;
    const iw=img.naturalWidth, ih=img.naturalHeight;
    const s=Math.min(1, MAX_BG/Math.max(iw,ih));
    const c=document.createElement('canvas'); c.width=Math.round(iw*s); c.height=Math.round(ih*s);
    const cx=c.getContext('2d'); cx.imageSmoothingEnabled=true; cx.imageSmoothingQuality='high';
    cx.drawImage(img,0,0,c.width,c.height);
    removeBackgroundCanvas(c, draft.edit.bgTol);
    bgCache={key, canvas:c};
    return c;
  }
  function rebuildEdited(){
    if(!img) return;
    const bg = getBgCanvas();
    editedCanvas = renderEdited(img, draft.edit, {maxDim:1000, bgCanvas:bg});
    renderPreview();
  }
  function scheduleRebuild(){
    if(rebuildPending) return;
    rebuildPending=true;
    requestAnimationFrame(()=>{ rebuildPending=false; rebuildEdited(); });
  }
  function renderPreview(){
    const canvas = stage.querySelector('canvas');
    const size = stage.clientWidth || 420;
    if(canvas.width!==size){ canvas.width=size; canvas.height=size; }
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,size,size);
    // 透過チェッカー
    ctx.fillStyle='#141a2e'; ctx.fillRect(0,0,size,size);
    ctx.fillStyle='#1a2138';
    const cell=20;
    for(let y=0;y<size;y+=cell) for(let x=0;x<size;x+=cell) if(((x+y)/cell)%2===0) ctx.fillRect(x,y,cell,cell);
    const src = showOriginal ? img : editedCanvas;
    if(src) drawFitted(ctx, src, showOriginal?EDIT_DEFAULTS:draft.edit, 0,0,size,size, {sizeMult:1});
  }
  async function loadSource(dataUrl){
    try {
      const raw = await loadImage(dataUrl);
      // 高品質を維持しつつ上限のみ適用
      const iw=raw.naturalWidth, ih=raw.naturalHeight;
      const s=Math.min(1, MAX_SOURCE/Math.max(iw,ih));
      let sourceUrl=dataUrl;
      if(s<1){
        const c=document.createElement('canvas'); c.width=Math.round(iw*s); c.height=Math.round(ih*s);
        const cx=c.getContext('2d'); cx.imageSmoothingEnabled=true; cx.imageSmoothingQuality='high';
        cx.drawImage(raw,0,0,c.width,c.height);
        sourceUrl=c.toDataURL('image/png');
      }
      img = await loadImage(sourceUrl);
      draft.source = sourceUrl;
      bgCache={key:null,canvas:null};
      dropzone.style.display='none'; stage.style.display='block';
      rebuildEdited();
      saveDraft();
    } catch(e){ toast('画像を読み込めませんでした','bad'); }
  }
  function saveDraft(){ if(!editChar){ S.draft=JSON.parse(JSON.stringify(draft)); persist(); } }
  function bakeSprite(){
    const bg=getBgCanvas();
    const c=renderEdited(img, draft.edit, {maxDim:MAX_BAKE, bgCanvas:bg});
    return c.toDataURL('image/png');
  }
  function finish(){
    if(!img || !draft.source){ toast('先に画像を読み込んでください','bad'); return; }
    const sprite = bakeSprite();
    if(editChar){
      editChar.source=draft.source; editChar.sprite=sprite; editChar.imageEdit=normalizeEdit(draft.edit);
      persist(); sfx('confirm'); toast('画像を保存しました(育成データは保持)','good'); go('hall'); return;
    }
    const name=nameInput.value.trim();
    if(!name){ toast('キャラクター名を入力してください','bad'); nameInput.focus(); return; }
    createCharacter({name, job:draft.job, style:draft.style, sprite, source:draft.source,
      imageEdit:normalizeEdit(draft.edit), weaponType:draft.weaponType, alloc:draft.alloc});
    S.draft=null; persist(); sfx('victory');
    modal(el('div',{class:'center'},
      el('div',{style:{fontSize:'44px'}},'🎉'),
      el('h3',{},`${name} が誕生！`),
      el('img',{src:sprite, style:{width:'130px',margin:'10px auto',objectFit:'contain'}}),
      el('p',{class:'txt-dim'},'育成の間で育てて、ギルドでCPU対戦に挑もう！'),
      el('div',{class:'modal-actions'}, el('button',{class:'btn btn-gold', onclick:()=>{document.querySelector('.modal-veil').remove();go('hub');}},'拠点へ'))));
  }

  // ===== イベント =====
  dropzone.addEventListener('click', ()=>fileInput.click());
  fileInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    if(!f.type.startsWith('image/')){ toast('画像ファイルを選んでください','bad'); return; }
    const r=new FileReader(); r.onload=()=>loadSource(r.result); r.readAsDataURL(f);
    fileInput.value='';
  });
  ['dragover','dragenter'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag');}));
  dropzone.addEventListener('drop', e=>{
    const f=e.dataTransfer.files[0]; if(!f||!f.type.startsWith('image/'))return;
    const r=new FileReader(); r.onload=()=>loadSource(r.result); r.readAsDataURL(f);
  });
  // ドラッグで位置調整
  let dragging=false,lx=0,ly=0;
  stage.addEventListener('pointerdown',e=>{dragging=true;lx=e.clientX;ly=e.clientY;stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{
    if(!dragging||!img)return;
    const size=stage.clientWidth;
    draft.edit.x=clamp(draft.edit.x+(e.clientX-lx)/size*2,-1,1);
    draft.edit.y=clamp(draft.edit.y+(e.clientY-ly)/size*2,-1,1);
    lx=e.clientX;ly=e.clientY;setSlider('x');setSlider('y');renderPreview();
  });
  ['pointerup','pointercancel'].forEach(ev=>stage.addEventListener(ev,()=>{dragging=false;saveDraft();}));
  stage.addEventListener('wheel',e=>{ if(!img)return; e.preventDefault();
    draft.edit.zoom=clamp(draft.edit.zoom*(e.deltaY<0?1.08:0.92),0.3,4); setSlider('zoom'); renderPreview(); },{passive:false});
  window.addEventListener('resize', renderPreview);

  buildJobGrid(); buildWeaponSeg(); buildAlloc();
  if(draft.source){ await loadSource(draft.source); }
  return el('div',{class:'screen'},
    el('div',{class:'screen-bg', style:{backgroundImage:'url(assets/bg/hall.jpg)'}}),
    topbar(editChar?'キャラクター画像の変更':'オリキャラ作成'),
    el('div',{class:'screen-body'}, body),
    bottomNav('hub'),
    fileInput);
}
