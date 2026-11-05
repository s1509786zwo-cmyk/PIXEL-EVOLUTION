// ============ 画像→ドット絵 変換パイプライン ============
// 単純縮小ではなく「平滑化→背景除去→減色(メディアンカット)→輪郭抽出」で描き直す
import { clamp } from './util.js';

export const PIXEL_DEFAULTS = {
  res: 48, colors: 24, mode: 'full', transparent: true, bgTol: 34, outline: 2, sat: 1.18, size: 'M',
};
export const RES_OPTIONS = [24,32,48,64,96];
export const COLOR_OPTIONS = [8,12,16,24,32,48,64];
export const SIZE_OPTIONS = {S:0.8, M:1.0, L:1.25};

export function defaultCrop(img, mode='full'){
  const w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
  let size = Math.min(w,h);
  let cx = w/2, cy = h/2;
  if (mode==='upper'){ size = Math.min(w, h*0.62); cy = h*0.32; }
  return {cx, cy, size};
}

// 切り抜き領域を outSize×outSize に描画
export function makeCropCanvas(img, crop, outSize=256){
  const c = document.createElement('canvas');
  c.width = outSize; c.height = outSize;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, crop.cx-crop.size/2, crop.cy-crop.size/2, crop.size, crop.size, 0, 0, outSize, outSize);
  return c;
}

// ---- 背景除去(境界フラッドフィル) ----
function removeBackground(data, w, h, tol){
  const dist = (i, r,g,b) => {
    const dr=data[i]-r, dg=data[i+1]-g, db=data[i+2]-b;
    return Math.sqrt(dr*dr+dg*dg+db*db);
  };
  // 境界の代表色を収集
  const seeds = [];
  const pushSeed = (x,y)=>{ const i=(y*w+x)*4; if(data[i+3]>10) seeds.push([data[i],data[i+1],data[i+2],x,y]); };
  for (let x=0;x<w;x++){ pushSeed(x,0); pushSeed(x,h-1); }
  for (let y=0;y<h;y++){ pushSeed(0,y); pushSeed(w-1,y); }
  if (!seeds.length) return;
  const visited = new Uint8Array(w*h);
  const stack = [];
  for (const [r,g,b,x,y] of seeds){ stack.push([x,y,r,g,b]); }
  const threshold = tol*2.4;
  while (stack.length){
    const [x,y,r,g,b] = stack.pop();
    if (x<0||y<0||x>=w||y>=h) continue;
    const p = y*w+x;
    if (visited[p]) continue;
    visited[p]=1;
    const i=p*4;
    if (data[i+3]<10) continue;
    if (dist(i,r,g,b) > threshold) continue;
    data[i+3]=0;
    stack.push([x+1,y,r,g,b],[x-1,y,r,g,b],[x,y+1,r,g,b],[x,y-1,r,g,b]);
  }
  // エッジの半透明 feathering
  for (let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    if (data[i+3]===0) continue;
    let transN=0;
    if(x>0&&data[i-4+3]===0)transN++; if(x<w-1&&data[i+4+3]===0)transN++;
    if(y>0&&data[i-w*4+3]===0)transN++; if(y<h-1&&data[i+w*4+3]===0)transN++;
    if(transN>=2) data[i+3]=160;
  }
}

// ---- メディアンカット減色 ----
function medianCut(pixels, maxColors){
  if (!pixels.length) return [[0,0,0]];
  let boxes = [pixels];
  const range = box => {
    let mn=[255,255,255], mx=[0,0,0];
    for (const p of box) for(let c=0;c<3;c++){ if(p[c]<mn[c])mn[c]=p[c]; if(p[c]>mx[c])mx[c]=p[c]; }
    return [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
  };
  while (boxes.length < maxColors){
    let bi=-1, best=-1;
    for (let i=0;i<boxes.length;i++){
      if (boxes[i].length<2) continue;
      const r = range(boxes[i]);
      const score = Math.max(r[0],r[1],r[2]) * Math.cbrt(boxes[i].length);
      if (score>best){ best=score; bi=i; }
    }
    if (bi<0 || best<=0) break;
    const box = boxes[bi];
    const r = range(box);
    const ch = r.indexOf(Math.max(...r));
    box.sort((a,b)=>a[ch]-b[ch]);
    const mid = box.length>>1;
    boxes.splice(bi,1, box.slice(0,mid), box.slice(mid));
  }
  return boxes.map(box=>{
    let r=0,g=0,b=0;
    for(const p of box){r+=p[0];g+=p[1];b+=p[2];}
    const n=box.length||1;
    return [Math.round(r/n),Math.round(g/n),Math.round(b/n)];
  });
}

function boostSat(data, w, h, sat){
  for (let i=0;i<data.length;i+=4){
    if (data[i+3]<10) continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    const gray = 0.299*r+0.587*g+0.114*b;
    data[i]  = clamp(gray+(r-gray)*sat, 0, 255);
    data[i+1]= clamp(gray+(g-gray)*sat, 0, 255);
    data[i+2]= clamp(gray+(b-gray)*sat, 0, 255);
  }
}

// ---- 輪郭・セルシェード風エッジ ----
function addOutline(data, w, h, strength){
  if (strength<=0) return;
  const alpha=(x,y)=> (x<0||y<0||x>=w||y>=h)?0:data[(y*w+x)*4+3];
  const layers = Math.min(3, strength);
  // 外形輪郭
  for (let L=0; L<layers; L++){
    const marks=[];
    for (let y=0;y<h;y++) for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      if (data[i+3]<10) continue;
      if (alpha(x-1,y)<10||alpha(x+1,y)<10||alpha(x,y-1)<10||alpha(x,y+1)<10){
        marks.push(i);
      }
    }
    for (const i of marks){
      const f = 0.32 - L*0.06;
      data[i]=data[i]*f; data[i+1]=data[i+1]*f; data[i+2]=data[i+2]*f;
    }
  }
  // 内部エッジ(色境界を少し締める)
  const copy = new Uint8ClampedArray(data);
  const cdist=(i,j)=>{const dr=copy[i]-copy[j],dg=copy[i+1]-copy[j+1],db=copy[i+2]-copy[j+2];return Math.abs(dr)+Math.abs(dg)+Math.abs(db);};
  for (let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    if (data[i+3]<10) continue;
    let edge=false;
    if(x<w-1&&data[i+4+3]>10&&cdist(i,i+4)>150)edge=true;
    if(y<h-1&&data[i+w*4+3]>10&&cdist(i,i+w*4)>150)edge=true;
    if(edge){ data[i]*=0.82; data[i+1]*=0.82; data[i+2]*=0.82; }
  }
}

// ---- メイン変換 ----
export function convertToPixel(img, crop, opts={}){
  const o = {...PIXEL_DEFAULTS, ...opts};
  const res = o.res;
  // 1. 切り抜き(高精細)
  const big = makeCropCanvas(img, crop, 256);
  // 2. 背景除去
  if (o.transparent){
    const bctx = big.getContext('2d');
    const bd = bctx.getImageData(0,0,256,256);
    removeBackground(bd.data, 256, 256, o.bgTol);
    bctx.putImageData(bd,0,0);
  }
  // 3. 段階的ダウンスケール(品質重視)
  const mid = document.createElement('canvas');
  mid.width = res*2; mid.height = res*2;
  const mctx = mid.getContext('2d');
  mctx.imageSmoothingEnabled=true; mctx.imageSmoothingQuality='high';
  mctx.drawImage(big, 0,0, res*2, res*2);
  const small = document.createElement('canvas');
  small.width=res; small.height=res;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled=true; sctx.imageSmoothingQuality='high';
  sctx.drawImage(mid, 0,0, res, res);
  const id = sctx.getImageData(0,0,res,res);
  const data = id.data;
  // 4. 彩度強調
  boostSat(data, res, res, o.sat);
  // 5. 減色
  const pixels=[];
  for (let i=0;i<data.length;i+=4){ if(data[i+3]>40) pixels.push([data[i],data[i+1],data[i+2]]); }
  const palette = medianCut(pixels, o.colors);
  for (let i=0;i<data.length;i+=4){
    if (data[i+3]<128){ data[i+3]=0; continue; }
    let best=0,bd=1e9;
    for (let p=0;p<palette.length;p++){
      const dr=data[i]-palette[p][0],dg=data[i+1]-palette[p][1],db=data[i+2]-palette[p][2];
      const d=dr*dr+dg*dg+db*db;
      if(d<bd){bd=d;best=p;}
    }
    data[i]=palette[best][0]; data[i+1]=palette[best][1]; data[i+2]=palette[best][2]; data[i+3]=255;
  }
  // 6. 輪郭
  addOutline(data, res, res, o.outline);
  sctx.putImageData(id,0,0);
  return {canvas: small, palette, dataUrl: small.toDataURL('image/png')};
}
