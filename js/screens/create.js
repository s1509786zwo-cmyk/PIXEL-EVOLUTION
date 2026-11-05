// ============ キャラクター作成 / 画像→ドット絵変換 ============
import { el, $, clamp, loadImage, downscaleImage, bus } from '../util.js';
import { go, topbar, bottomNav, modal, toast, confirmModal } from '../ui.js';
import { S, createCharacter, persist, STAT_NAME, ALLOC_GAIN, STYLES, activeChar } from '../state.js';
import { JOBS, JOB_MAP, WEAPON_TYPES } from '../data/jobs.js';
import { convertToPixel, defaultCrop, makeCropCanvas, PIXEL_DEFAULTS, RES_OPTIONS, COLOR_OPTIONS, SIZE_OPTIONS } from '../pixel.js';
import { sfx } from '../audio.js';

export async function renderCreate(params={}){
  const editChar = params.edit ? S.characters.find(c=>c.id===params.edit) : null;
  // ドラフト復元
  let draft = editChar ? {
    source: editChar.source, crop: editChar.crop, opts: {...PIXEL_DEFAULTS, ...(editChar.spriteSettings||{})},
    sprite: editChar.sprite, name: editChar.name, job: editChar.job, style: editChar.style,
    alloc: {...editChar.alloc}, weaponType: null,
  } : (S.draft ? JSON.parse(JSON.stringify(S.draft)) : {
    source:null, crop:null, opts:{...PIXEL_DEFAULTS}, sprite:null,
    name:'', job:'fighter', style:'balance', alloc:{hp:0,mp:0,atk:0,def:0,spd:0,mag:0,acc:0,eva:0}, weaponType:null,
  });
  let img = null;
  let zoom = 1;

  const body = el('div',{class:'create-wrap'});
  const fileInput = el('input',{type:'file', accept:'image/png,image/jpeg,image/webp,image/gif,image/bmp', style:{display:'none'}});

  // ===== 左: 読み込み & 切り抜き =====
  const dropzone = el('div',{class:'dropzone'},
    el('div',{class:'dz-ico'},'🖼️'),
    el('div',{style:{fontWeight:'800'}},'画像を読み込む'),
    el('div',{class:'txt-dim small mt8'},'クリック / タップで選択、またはドラッグ&ドロップ'),
    el('div',{class:'txt-dim small'},'PNG・JPEG・WebP などに対応'),
  );
  const cropStage = el('div',{class:'crop-stage', style:{display:'none'}},
    el('canvas'), el('div',{class:'crop-frame'}));
  const zoomRow = el('div',{class:'ctrl-row', style:{display:'none'}},
    el('label',{},'拡大縮小'),
    el('input',{type:'range', min:'1', max:'6', step:'0.05', value:'1'}),
    el('span',{class:'cv'},'1.0x'));
  const modeSeg = el('div',{class:'seg'},
    ...[['full','全身'],['upper','上半身']].map(([m,label])=>
      el('button',{class:draft.opts.mode===m?'on':'', 'data-mode':m, onclick:e=>{
        draft.opts.mode=m; sfx('click');
        modeSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.mode===m));
        if(img){ draft.crop = defaultCrop(img, m); zoom=1; syncZoom(); drawCrop(); }
      }},label)));
  const cropHint = el('div',{class:'txt-dim small', style:{display:'none'}},'ドラッグで位置調整 / スライダー・ホイール・ピンチで拡大縮小。顔や体が切れないように調整してください。');
  const leftPanel = el('div',{class:'panel ornate'},
    el('h3',{},'① 画像を読み込む'),
    dropzone, cropStage, zoomRow, cropHint,
    el('div',{class:'ctrl-row'}, el('label',{},'切り抜き範囲'), modeSeg),
    el('button',{class:'btn btn-sm btn-ghost mt8', style:{display:'none'}, id:'reselect'},'別の画像を選ぶ'), fileInput);

  // ===== 右: 変換設定 & プレビュー =====
  const previewBox = el('div',{class:'sprite-preview-lg'}, el('span',{class:'txt-dim small'},'ここにドット絵が表示されます'));
  const cmpWrap = el('div',{class:'compare mt12', style:{display:'none'}},
    el('figure',{}, el('div',{class:'cmp-box'}, el('canvas',{id:'cmp-src'})), el('figcaption',{},'元画像(切り抜き)')),
    el('figure',{}, el('div',{class:'cmp-box'}, el('img',{class:'pixel', id:'cmp-out'})), el('figcaption',{},'生成ドット絵')));

  const ctrlRes = slider('ドットの細かさ', RES_OPTIONS.indexOf(draft.opts.res), 0, RES_OPTIONS.length-1, 1, v=>{draft.opts.res=RES_OPTIONS[v]; return RES_OPTIONS[v]+'px';});
  const ctrlColors = slider('色数', COLOR_OPTIONS.indexOf(draft.opts.colors), 0, COLOR_OPTIONS.length-1, 1, v=>{draft.opts.colors=COLOR_OPTIONS[v]; return COLOR_OPTIONS[v]+'色';});
  const ctrlOutline = slider('輪郭の強さ', draft.opts.outline, 0, 3, 1, v=>{draft.opts.outline=+v; return v;});
  const ctrlTol = slider('背景除去の強さ', draft.opts.bgTol, 0, 100, 1, v=>{draft.opts.bgTol=+v; return v;});
  const ctrlSat = slider('彩度', Math.round(draft.opts.sat*100), 80, 160, 1, v=>{draft.opts.sat=v/100; return v+'%';});
  const transToggle = el('button',{class:'switch'+(draft.opts.transparent?' on':''), onclick:()=>{
    draft.opts.transparent=!draft.opts.transparent; transToggle.classList.toggle('on',draft.opts.transparent); sfx('click');
  }});
  const sizeSeg = el('div',{class:'seg'}, ...Object.keys(SIZE_OPTIONS).map(sz=>
    el('button',{class:draft.opts.size===sz?'on':'', onclick:e=>{draft.opts.size=sz; sizeSeg.querySelectorAll('button').forEach(b=>b.classList.remove('on')); e.target.classList.add('on'); sfx('click');}},
      {S:'小',M:'中',L:'大'}[sz])));
  const genBtn = el('button',{class:'btn btn-gold btn-block btn-lg', onclick:()=>generate()}, '✨ ドット絵を生成');
  const rightPanel = el('div',{class:'panel ornate'},
    el('h3',{},'② ドット絵に変換'),
    previewBox, cmpWrap,
    el('div',{class:'divider'}),
    ctrlRes.row, ctrlColors.row, ctrlOutline.row,
    el('div',{class:'ctrl-row'}, el('label',{},'背景の透過'), transToggle, el('span',{class:'txt-dim small'},'元画像の背景を自動で除去')),
    ctrlTol.row, ctrlSat.row,
    el('div',{class:'ctrl-row'}, el('label',{},'キャラの大きさ'), sizeSeg),
    el('div',{class:'mt12'}, genBtn),
    el('div',{class:'txt-dim small mt8'},'設定を変えて何度でも再生成できます。元画像と並べて比較できます。'));

  // ===== 下: キャラ設定 =====
  const nameInput = el('input',{type:'text', maxlength:'16', placeholder:'キャラクター名(16文字まで)', value:draft.name||''});
  const basicJobs = JOBS.filter(j=>j.tier==='basic');
  let jobGrid;
  const buildJobGrid = ()=>{
    jobGrid && jobGrid.remove();
    jobGrid = el('div',{class:'grid-cards'}, basicJobs.map(j=>
      el('div',{class:'mini-card'+(draft.job===j.id?' sel':''), onclick:()=>{draft.job=j.id; sfx('click'); buildJobGrid(); buildWeaponSeg();}},
        el('h4',{},`${j.ico} ${j.name}`), el('p',{},j.style))));
    jobWrap.append(jobGrid);
  };
  const jobWrap = el('div',{});
  let weaponSeg;
  const buildWeaponSeg = ()=>{
    weaponSeg && weaponSeg.remove();
    const types = JOB_MAP[draft.job].weapons;
    if (!types.includes(draft.weaponType)) draft.weaponType = types[0];
    weaponSeg = el('div',{class:'seg'}, types.map(t=>
      el('button',{class:draft.weaponType===t?'on':'', onclick:e=>{draft.weaponType=t; weaponSeg.querySelectorAll('button').forEach(b=>b.classList.remove('on')); e.target.classList.add('on'); sfx('click');}},
        `${WEAPON_TYPES[t].ico} ${WEAPON_TYPES[t].name}`)));
    weaponWrap.append(weaponSeg);
  };
  const weaponWrap = el('div',{});
  const styleSeg = el('div',{class:'seg'}, STYLES.map(st=>
    el('button',{class:draft.style===st.id?'on':'', title:st.desc, onclick:e=>{draft.style=st.id; styleSeg.querySelectorAll('button').forEach(b=>b.classList.remove('on')); e.target.classList.add('on'); sfx('click');}},st.name)));
  // 初期能力値振分
  let initPoints = 10;
  const allocWrap = el('div',{class:'stat-grid'});
  const buildAlloc = ()=>{
    allocWrap.innerHTML='';
    allocWrap.append(el('div',{class:'stat-row', style:{gridColumn:'1/-1'}},
      el('span',{class:'sn'},'残りポイント'), el('span',{class:'sv num txt-gold'},String(initPoints))));
    for (const k of ['hp','mp','atk','def','spd','mag','acc','eva']){
      allocWrap.append(el('div',{class:'stat-row'},
        el('span',{class:'sn'},STAT_NAME[k]),
        el('span',{class:'sv num'},String(draft.alloc[k]||0)),
        el('span',{class:'sb txt-dim small'},`+${ALLOC_GAIN[k]}/pt`),
        el('button',{class:'stat-plus', onclick:()=>{if(initPoints>0){initPoints--;draft.alloc[k]++;sfx('click');buildAlloc();}}},'+'),
        el('button',{class:'stat-plus', style:{background:'linear-gradient(180deg,#5a2f2f,#3a1c1c)',borderColor:'#914646'},
          onclick:()=>{if((draft.alloc[k]||0)>0){initPoints++;draft.alloc[k]--;sfx('click');buildAlloc();}}},'−')));
    }
  };
  const createBtn = el('button',{class:'btn btn-gold btn-lg btn-block', onclick:()=>finish()},
    editChar?'💾 この見た目を保存':'🎉 このキャラクターで作成');
  const setupPanel = el('div',{class:'panel ornate'},
    el('h3',{}, editChar?'③ 見た目の変更':'③ キャラクター設定'),
    !editChar?el('div',{class:'field'}, el('label',{},'キャラクター名'), nameInput):null,
    !editChar?el('div',{class:'field'}, el('label',{},'初期職業'), jobWrap):null,
    !editChar?el('div',{class:'field'}, el('label',{},'初期武器'), weaponWrap):null,
    !editChar?el('div',{class:'field'}, el('label',{},'戦闘スタイル'), styleSeg,
      el('div',{class:'txt-dim small mt8'}, STYLES.find(s=>s.id===draft.style)?.desc||'')):null,
    !editChar?el('div',{class:'field'}, el('label',{},'初期能力値の振り分け(10ポイント)'), allocWrap):null,
    el('div',{class:'mt16'}, createBtn));

  body.append(el('div',{class:'create-cols'}, leftPanel, rightPanel), setupPanel);

  // ===== ロジック =====
  function slider(label, val, min, max, step, fmtFn){
    const cv = el('span',{class:'cv'}, fmtFn(val));
    const input = el('input',{type:'range', min, max, step, value:val, oninput:e=>{cv.textContent=fmtFn(+e.target.value);}});
    return {row: el('div',{class:'ctrl-row'}, el('label',{},label), input, cv), input};
  }
  function syncZoom(){
    zoomRow.querySelector('input').value = zoom;
    zoomRow.querySelector('.cv').textContent = zoom.toFixed(1)+'x';
  }
  function drawCrop(){
    if (!img) return;
    const canvas = cropStage.querySelector('canvas');
    const size = cropStage.clientWidth || 360;
    canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#0c1122'; ctx.fillRect(0,0,size,size);
    const scale = size/draft.crop.size;
    ctx.setTransform(scale,0,0,scale, size/2-draft.crop.cx*scale, size/2-draft.crop.cy*scale);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0);
    ctx.setTransform(1,0,0,1,0,0);
  }
  function clampCrop(){
    const w=img.naturalWidth,h=img.naturalHeight;
    draft.crop.size = clamp(draft.crop.size, Math.min(w,h)/6, Math.max(w,h)*1.2);
    const half=draft.crop.size/2;
    draft.crop.cx = clamp(draft.crop.cx, Math.min(half,w/2), Math.max(w-half,w/2));
    draft.crop.cy = clamp(draft.crop.cy, Math.min(half,h/2), Math.max(h-half,h/2));
  }
  async function loadSource(dataUrl){
    try {
      const raw = await loadImage(dataUrl);
      const small = downscaleImage(raw, 768, 'image/png');
      img = await loadImage(small);
      draft.source = small;
      draft.crop = defaultCrop(img, draft.opts.mode);
      zoom=1; syncZoom();
      dropzone.style.display='none'; cropStage.style.display='block';
      zoomRow.style.display='flex'; cropHint.style.display='block';
      leftPanel.querySelector('#reselect').style.display='inline-flex';
      requestAnimationFrame(drawCrop);
      saveDraft();
    } catch(e){ toast('画像を読み込めませんでした','bad'); }
  }
  function saveDraft(){
    if (!editChar){ S.draft = JSON.parse(JSON.stringify(draft)); persist(); }
  }
  function generate(){
    if (!img || !draft.crop){ toast('まず画像を読み込んでください','bad'); return; }
    clampCrop();
    const res = convertToPixel(img, draft.crop, draft.opts);
    draft.sprite = res.dataUrl;
    previewBox.innerHTML='';
    const pv = el('img',{class:'pixel', src:res.dataUrl, style:{width:(SIZE_OPTIONS[draft.opts.size]*70)+'%', maxWidth:'88%'}});
    previewBox.append(pv);
    cmpWrap.style.display='grid';
    const sc = $('#cmp-src'); const sctx=sc.getContext('2d');
    const cc = makeCropCanvas(img, draft.crop, 200);
    sc.width=200; sc.height=200; sctx.drawImage(cc,0,0);
    $('#cmp-out').src = res.dataUrl;
    sfx('magic'); toast('ドット絵を生成しました！','good');
    saveDraft();
  }
  function finish(){
    if (!draft.sprite){ toast('先にドット絵を生成してください','bad'); return; }
    if (editChar){
      editChar.source=draft.source; editChar.sprite=draft.sprite;
      editChar.crop=draft.crop; editChar.spriteSettings=draft.opts;
      persist(); sfx('confirm'); toast('見た目を変更しました！','good'); go('hall'); return;
    }
    const name = nameInput.value.trim();
    if (!name){ toast('キャラクター名を入力してください','bad'); nameInput.focus(); return; }
    createCharacter({name, job:draft.job, style:draft.style, sprite:draft.sprite, source:draft.source,
      crop:draft.crop, spriteSettings:draft.opts, weaponType:draft.weaponType, alloc:draft.alloc});
    S.draft=null; persist();
    sfx('victory');
    modal(el('div',{class:'center'},
      el('div',{style:{fontSize:'44px'}},'🎉'),
      el('h3',{},`${name} が誕生！`),
      el('img',{class:'pixel', src:draft.sprite, style:{width:'120px',margin:'10px auto'}}),
      el('p',{class:'txt-dim'},'育成の間で育てて、ギルドでCPU対戦に挑もう！'),
      el('div',{class:'modal-actions'},
        el('button',{class:'btn btn-gold', onclick:()=>{document.querySelector('.modal-veil').remove();go('hub');}},'拠点へ'))));
  }

  // ===== イベント =====
  dropzone.addEventListener('click', ()=>fileInput.click());
  leftPanel.querySelector('#reselect').addEventListener('click', ()=>fileInput.click());
  fileInput.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    if(!f.type.startsWith('image/')){ toast('画像ファイルを選んでください','bad'); return; }
    const r=new FileReader(); r.onload=()=>loadSource(r.result); r.readAsDataURL(f);
  });
  ['dragover','dragenter'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag');}));
  dropzone.addEventListener('drop', e=>{
    const f=e.dataTransfer.files[0]; if(!f||!f.type.startsWith('image/'))return;
    const r=new FileReader(); r.onload=()=>loadSource(r.result); r.readAsDataURL(f);
  });
  zoomRow.querySelector('input').addEventListener('input', e=>{
    zoom=+e.target.value;
    if(img){ const base=Math.min(img.naturalWidth,img.naturalHeight); draft.crop.size=base/zoom; clampCrop(); drawCrop(); }
    zoomRow.querySelector('.cv').textContent=zoom.toFixed(1)+'x';
  });
  // ドラッグ / ピンチ
  let dragging=false, lastX=0,lastY=0, pinchDist=0;
  cropStage.addEventListener('pointerdown', e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;cropStage.setPointerCapture(e.pointerId);});
  cropStage.addEventListener('pointermove', e=>{
    if(!dragging||!img)return;
    const scale=cropStage.clientWidth/draft.crop.size;
    draft.crop.cx-=(e.clientX-lastX)/scale; draft.crop.cy-=(e.clientY-lastY)/scale;
    lastX=e.clientX;lastY=e.clientY; clampCrop(); drawCrop();
  });
  ['pointerup','pointercancel'].forEach(ev=>cropStage.addEventListener(ev,()=>{dragging=false;saveDraft();}));
  cropStage.addEventListener('wheel', e=>{
    if(!img)return; e.preventDefault();
    zoom=clamp(zoom*(e.deltaY<0?1.1:0.9),1,6); syncZoom();
    const base=Math.min(img.naturalWidth,img.naturalHeight); draft.crop.size=base/zoom; clampCrop(); drawCrop();
  },{passive:false});
  cropStage.addEventListener('touchmove', e=>{
    if(e.touches.length===2&&img){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      if(pinchDist){ zoom=clamp(zoom*(d/pinchDist),1,6); syncZoom();
        const base=Math.min(img.naturalWidth,img.naturalHeight); draft.crop.size=base/zoom; clampCrop(); drawCrop(); }
      pinchDist=d; e.preventDefault();
    }
  },{passive:false});
  cropStage.addEventListener('touchend',()=>{pinchDist=0;});
  window.addEventListener('resize', drawCrop);

  buildJobGrid(); buildWeaponSeg(); buildAlloc();
  // 復元
  if (draft.source){
    const savedCrop = draft.crop ? {...draft.crop} : null;
    await loadSource(draft.source);
    if (savedCrop){
      draft.crop = savedCrop;
      zoom = clamp(Math.min(img.naturalWidth,img.naturalHeight)/draft.crop.size, 1, 6);
      syncZoom(); drawCrop(); saveDraft();
    }
  }
  if (draft.sprite){
    previewBox.innerHTML=''; previewBox.append(el('img',{class:'pixel', src:draft.sprite, style:{width:(SIZE_OPTIONS[draft.opts.size]*70)+'%'}}));
  }
  return el('div',{class:'screen'},
    el('div',{class:'screen-bg', style:{backgroundImage:'url(assets/bg/hall.jpg)'}}),
    topbar(editChar?'見た目変更':'キャラクター作成'),
    el('div',{class:'screen-body'}, body),
    bottomNav('hub'));
}
