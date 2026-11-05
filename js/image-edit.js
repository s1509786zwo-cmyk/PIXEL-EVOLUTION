// ============ オリキャラ画像編集(非破壊・元画像そのまま使用) ============
// ドット絵変換は行わない。元画像の特徴(顔・髪・服装・色)を維持したまま、
// 拡大/位置/色彩/反転/背景透過 を編集パラメータとして適用する。
import { clamp } from './util.js?v=20261105b';

export const EDIT_DEFAULTS = {
  zoom: 1, x: 0, y: 0,               // 表示倍率と位置(-1〜1)
  brightness: 100, contrast: 100, saturate: 100, hue: 0, temperature: 0,
  flip: false,                       // 左右反転
  transparent: false, bgTol: 34,     // 背景透過
  size: 'M',                         // 戦闘での表示サイズ
};
export const SIZE_MULT = { S: 0.8, M: 1.0, L: 1.25 };
export const SIZE_LABEL = { S: '小', M: '中', L: '大' };

export function normalizeEdit(e){
  const d = {...EDIT_DEFAULTS, ...(e||{})};
  d.zoom = clamp(+d.zoom||1, 0.3, 4);
  d.x = clamp(+d.x||0, -1, 1);
  d.y = clamp(+d.y||0, -1, 1);
  d.brightness = clamp(+d.brightness||100, 0, 200);
  d.contrast = clamp(+d.contrast||100, 0, 200);
  d.saturate = clamp(+d.saturate||100, 0, 200);
  d.hue = clamp(+d.hue||0, -180, 180);
  d.temperature = clamp(+d.temperature||0, -100, 100);
  d.bgTol = clamp(+d.bgTol||34, 0, 100);
  if (!SIZE_MULT[d.size]) d.size = 'M';
  return d;
}

// ---- 背景透過(境界フラッドフィル・色は変更しない) ----
export function removeBackgroundCanvas(srcCanvas, tol){
  const w = srcCanvas.width, h = srcCanvas.height;
  const ctx = srcCanvas.getContext('2d');
  const id = ctx.getImageData(0,0,w,h);
  const data = id.data;
  const threshold = tol*2.4;
  const dist = (i,r,g,b)=>{const dr=data[i]-r,dg=data[i+1]-g,db=data[i+2]-b;return Math.sqrt(dr*dr+dg*dg+db*db);};
  const seeds=[];
  const push=(x,y)=>{const i=(y*w+x)*4; if(data[i+3]>10) seeds.push([x,y,data[i],data[i+1],data[i+2]]);};
  for(let x=0;x<w;x++){push(x,0);push(x,h-1);}
  for(let y=0;y<h;y++){push(0,y);push(w-1,y);}
  const visited=new Uint8Array(w*h);
  const stack=[...seeds];
  while(stack.length){
    const [x,y,r,g,b]=stack.pop();
    if(x<0||y<0||x>=w||y>=h)continue;
    const p=y*w+x; if(visited[p])continue; visited[p]=1;
    const i=p*4; if(data[i+3]<10)continue;
    if(dist(i,r,g,b)>threshold)continue;
    data[i+3]=0;
    stack.push([x+1,y,r,g,b],[x-1,y,r,g,b],[x,y+1,r,g,b],[x,y-1,r,g,b]);
  }
  ctx.putImageData(id,0,0);
  return srcCanvas;
}

// 色温度(暖色+/寒色-)を不透明ピクセルのみに適用
function applyTemperature(data, temp){
  if(!temp) return;
  const t = temp/100; // -1..1
  const rGain = 1 + 0.28*t, bGain = 1 - 0.28*t;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<10) continue;
    data[i]   = clamp(data[i]*rGain, 0, 255);
    data[i+2] = clamp(data[i+2]*bGain, 0, 255);
  }
}

// ---- 編集済み画像をレンダリング(縦横比維持・非破壊) ----
// bgCanvas: 背景透過済みのフルサイズcanvas(キャッシュ)。無ければ必要時に生成。
export function renderEdited(img, edit, {maxDim=1600, bgCanvas=null}={}){
  const e = normalizeEdit(edit);
  const iw = img.naturalWidth||img.width, ih = img.naturalHeight||img.height;
  const scale = Math.min(1, maxDim/Math.max(iw,ih));
  const w = Math.max(1, Math.round(iw*scale)), h = Math.max(1, Math.round(ih*scale));
  const out = document.createElement('canvas'); out.width=w; out.height=h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // 背景透過済みの元を元に描画
  const src = (e.transparent && bgCanvas) ? bgCanvas : img;
  ctx.save();
  if (e.flip){ ctx.translate(w,0); ctx.scale(-1,1); }
  ctx.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%) saturate(${e.saturate}%) hue-rotate(${e.hue}deg)`;
  ctx.drawImage(src, 0,0, w, h);
  ctx.restore();
  // 色温度
  if (e.temperature){
    const id = ctx.getImageData(0,0,w,h);
    applyTemperature(id.data, e.temperature);
    ctx.putImageData(id,0,0);
  }
  return out;
}

// ---- プレビュー/戦闘用のフィット描画(縦横比維持・中央+オフセット) ----
export function drawFitted(ctx, img, edit, bx, by, bw, bh, {sizeMult=1, anchor='center'}={}){
  const e = normalizeEdit(edit);
  const iw = img.naturalWidth||img.width, ih = img.naturalHeight||img.height;
  if(!iw||!ih) return;
  const fit = Math.min(bw/iw, bh/ih);
  const s = fit * e.zoom * sizeMult;
  const dw = iw*s, dh = ih*s;
  const cx = bx + bw/2 + e.x*bw/2;
  let cy;
  if (anchor==='bottom') cy = by + bh - dh/2 + e.y*bh/2;
  else cy = by + bh/2 + e.y*bh/2;
  ctx.drawImage(img, cx-dw/2, cy-dh/2, dw, dh);
  return {dw, dh, cx, cy};
}
