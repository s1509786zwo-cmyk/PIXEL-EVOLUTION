/* ===========================================================
   画像読み込み → ドット絵変換エンジン / CPUスプライト生成
   - 単なる縮小・モザイクではなく、エッジ保持平滑化 + 特徴強調 +
     適応パレット(k-means) + ディザ + 陰影のバンド化 + 輪郭描き起こし
   =========================================================== */

export const MAX_SOURCE = 1100;

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('画像ファイルを選択してください'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('ファイルを読み込めませんでした'));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve(normalizeImage(img));
      img.onerror = () => reject(new Error('画像を開けませんでした（対応形式: PNG / JPEG / WebP / GIF）'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

export function loadImageURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ image: img, dataURL: url, width: img.width, height: img.height });
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = url;
  });
}

/** 元画像を保存用に正規化（最大辺1100px・透過保持） */
export function normalizeImage(img) {
  const r = Math.min(1, MAX_SOURCE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * r)), h = Math.max(1, Math.round(img.height * r));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  let dataURL;
  try { dataURL = cv.toDataURL('image/png'); }
  catch (e) { dataURL = cv.toDataURL('image/jpeg', 0.9); }
  if (dataURL.length > 3_200_000) dataURL = cv.toDataURL('image/jpeg', 0.82);
  return { image: cv, dataURL, width: w, height: h };
}

/** 切り抜き矩形を計算（settings.scale / cropX / cropY / body） */
export function cropRect(image, s) {
  const iw = image.width, ih = image.height;
  const aspect = 0.78; // 縦長のキャラクター枠
  let cw = Math.min(iw, ih * aspect);
  let ch = cw / aspect;
  if (s.body === 'upper') ch *= 0.60;
  const zoom = Math.max(0.45, Math.min(3.2, s.scale || 1));
  cw /= zoom; ch /= zoom;
  cw = Math.min(cw, iw); ch = Math.min(ch, ih);
  let cx = (s.cropX ?? 0.5) * iw;
  let cy = s.body === 'upper' ? (0.12 + (s.cropY ?? 0.5) * 0.30) * ih : (s.cropY ?? 0.5) * ih;
  cx = Math.max(cw / 2, Math.min(iw - cw / 2, cx));
  cy = Math.max(ch / 2, Math.min(ih - ch / 2, cy));
  return { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
}

/** 切り抜きプレビュー（枠・三分割線・ガイド付き） */
export function drawCropPreview(canvas, image, s) {
  if (!canvas || !image) return;
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(240, Math.round(rect.width || canvas.clientWidth || 320));
  const H = Math.round(W * 0.78);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // 市松模様
  for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
    ctx.fillStyle = ((x / 16 + y / 16) % 2) ? '#1b2440' : '#222d4d';
    ctx.fillRect(x, y, 16, 16);
  }
  const r = cropRect(image, s);
  // 画像全体を薄く、選択範囲を鮮明に
  const fit = Math.min(W / image.width, H / image.height);
  const dw = image.width * fit, dh = image.height * fit;
  ctx.globalAlpha = 0.28;
  ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
  const sx = W / r.w, sy = H / r.h;
  ctx.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, W, H);
  // ドットグリッド（設定した細かさ）
  const gx = Math.max(8, Math.min(80, s.grid || 40));
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += W / gx) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += H / Math.round(gx / 0.78)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // 顔の目安ガイド
  ctx.strokeStyle = 'rgba(255,215,122,.75)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(W * 0.29, H * 0.08, W * 0.42, H * 0.30);
  ctx.strokeStyle = 'rgba(79,216,255,.9)'; ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.fillStyle = 'rgba(10,14,28,.78)'; ctx.fillRect(6, H - 30, 158, 23);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif';
  ctx.fillText(`切り抜き倍率 ×${(s.scale||1).toFixed(2)} / ${s.body === 'upper' ? '上半身' : '全身'}`, 12, H - 14);
  return { sx, sy, W, H };
}

const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const dist2 = (a, b, c, d, e, f) => (a-d)*(a-d) + (b-e)*(b-e) + (c-f)*(c-f);

/** 背景除去：四隅の色から連結成分を探索してアルファを抜く */
function removeBackground(data, w, h, strength = 30) {
  const px = (x,y) => (y*w+x)*4;
  const sample = (x,y) => [data[px(x,y)], data[px(x,y)+1], data[px(x,y)+2]];
  const patchAvg = (x0,y0,rw,rh) => {
    const a=[0,0,0]; let n=0;
    for(let y=y0;y<Math.min(h,y0+rh);y+=2) for(let x=x0;x<Math.min(w,x0+rw);x+=2){
      const c=sample(x,y); a[0]+=c[0];a[1]+=c[1];a[2]+=c[2];n++;
    }
    return [a[0]/n,a[1]/n,a[2]/n];
  };
  // 四隅だけを背景色の基準にする（端に被写体が掛かっても誤判定しにくい）
  const corners = [patchAvg(0,0,16,16), patchAvg(w-16,0,16,16), patchAvg(0,h-16,16,16), patchAvg(w-16,h-16,16,16)];
  const avg = [0,0,0];
  for (const c of corners) for (let i=0;i<3;i++) avg[i] += c[i]/corners.length;
  let variance = 0;
  for (const c of corners) variance += dist2(c[0],c[1],c[2],avg[0],avg[1],avg[2]);
  variance = Math.sqrt(variance / corners.length);
  const tol = Math.max(24, Math.min(48, strength + variance * 0.35));
  const visited = new Uint8Array(w*h);
  const queue = [];           // 動的キュー（BFS で重複が入っても溢れない）
  let head = 0;
  const enqueue = idx => { if (!visited[idx]) queue.push(idx); };
  const chromaOf = c => Math.max(c[0],c[1],c[2]) - Math.min(c[0],c[1],c[2]);
  const isBg = (x,y) => {
    const p = px(x,y);
    const r=data[p], g=data[p+1], b=data[p+2];
    const chroma = Math.max(r,g,b) - Math.min(r,g,b);
    let d = dist2(r,g,b,avg[0],avg[1],avg[2]);
    for (const c of corners) d = Math.min(d, dist2(r,g,b,c[0],c[1],c[2]));
    // グラデーション対応：境界色が無彩色（背景らしい）ときだけ参照
    for (const c of [sample(x,0), sample(x,h-1), sample(0,y), sample(w-1,y)]) {
      if (chromaOf(c) < 30) d = Math.min(d, dist2(r,g,b,c[0],c[1],c[2]) * 1.25);
    }
    // 彩度の高い髪・服・肌は背景として消しにくくする
    const threshold = tol*tol*2.1 * (chroma > 36 ? 0.4 : 1);
    return d < threshold;
  };
  // 画像の四辺をシードに、背景色の連結成分だけを透過させる
  for (let x = 0; x < w; x++) { enqueue(x); enqueue((h-1)*w + x); }
  for (let y = 0; y < h; y++) { enqueue(y*w); enqueue(y*w + w-1); }
  while (head < queue.length) {
    const idx = queue[head++];
    if (visited[idx]) continue;
    visited[idx] = 1;
    const x = idx % w, y = (idx / w) | 0;
    if (!isBg(x,y)) continue;
    const p = idx*4;
    data[p+3] = 0;
    if (x > 0 && !visited[idx-1]) enqueue(idx-1);
    if (x < w-1 && !visited[idx+1]) enqueue(idx+1);
    if (y > 0 && !visited[idx-w]) enqueue(idx-w);
    if (y < h-1 && !visited[idx+w]) enqueue(idx+w);
  }
  // 孤立点の除去（透明に囲まれた小さなノイズ）
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    const p = px(x,y);
    if (!data[p+3]) continue;
    let t = 0;
    if (!data[p-4+3]) t++; if (!data[p+4+3]) t++;
    if (!data[p-w*4+3]) t++; if (!data[p+w*4+3]) t++;
    if (t >= 3) data[p+3] = 0;
  }
  // 脚の間など、被写体に囲まれて洪水塗りが届かなかった背景を連結成分で検出して除去
  const seen = new Uint8Array(w*h);
  const comp = [], compQueue = [];
  for (let sy=0; sy<h; sy++) for (let sx=0; sx<w; sx++) {
    const start = sy*w+sx;
    if (seen[start] || !data[start*4+3]) continue;
    let qh=0; compQueue.length=0; compQueue.push(start); seen[start]=1;
    let sr=0,sg=0,sb=0,n=0;
    while (qh < compQueue.length) {
      const idx=compQueue[qh++], cx=idx%w, cy=(idx/w)|0;
      comp.push(idx);
      const p=idx*4; sr+=data[p];sg+=data[p+1];sb+=data[p+2];n++;
      const nb=[cx>0?idx-1:-1, cx<w-1?idx+1:-1, cy>0?idx-w:-1, cy<h-1?idx+w:-1];
      for (const k of nb) if (k>=0 && !seen[k] && data[k*4+3]) { seen[k]=1; compQueue.push(k); }
    }
    const cr=sr/n,cg=sg/n,cb=sb/n;
    if (n < w*h*0.14 && dist2(cr,cg,cb,avg[0],avg[1],avg[2]) < tol*tol*4) {
      for (const idx of comp) data[idx*4+3]=0;
    }
    comp.length=0;
  }
  // 仕上げ：被写体に囲まれた無彩色の背景（脚の間・影など）を色で除去。
  // 明るい白衣やハイライト（輝度226超）は残して服装の特徴を保持する。
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const p=px(x,y);
    if (!data[p+3]) continue;
    const r=data[p], g=data[p+1], b=data[p+2];
    const chroma=Math.max(r,g,b)-Math.min(r,g,b);
    const lum=r*0.299+g*0.587+b*0.114;
    if (chroma < 26 && lum > 120 && lum < 226 && dist2(r,g,b,avg[0],avg[1],avg[2]) < tol*tol*3) data[p+3]=0;
  }
}

/** エッジ保持平滑化（色差で重みを落とす簡易バイラテラル） */
function bilateral(data, w, h) {
  const out = new Uint8ClampedArray(data);
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    const p = (y*w+x)*4;
    if (data[p+3] < 16) continue;
    let sr=0,sg=0,sb=0,sw=0;
    for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
      const q = ((y+dy)*w + (x+dx))*4;
      if (data[q+3] < 16) continue;
      const d = dist2(data[p],data[p+1],data[p+2],data[q],data[q+1],data[q+2]);
      const wgt = (dx===0&&dy===0 ? 4 : 1) * Math.exp(-d / 3200);
      sr += data[q]*wgt; sg += data[q+1]*wgt; sb += data[q+2]*wgt; sw += wgt;
    }
    if (sw > 0) { out[p]=sr/sw; out[p+1]=sg/sw; out[p+2]=sb/sw; }
  }
  return out;
}

/** 肌色ピクセルから顔の位置を推定（中央・上部をフォールバック） */
function detectFace(data, w, h) {
  let sx=0, sy=0, n=0, minX=w, maxX=0, minY=h, maxY=0;
  for (let y = 0; y < h*0.72; y += 2) for (let x = 0; x < w; x += 2) {
    const p = (y*w+x)*4;
    if (data[p+3] < 40) continue;
    const r=data[p], g=data[p+1], b=data[p+2];
    const skin = r > 90 && r > g*1.06 && g > b*1.02 && r-b > 18 && r-b < 115 && Math.max(r,g,b)-Math.min(r,g,b) < 130;
    if (!skin) continue;
    const weight = 1 - y/h*0.35;
    sx += x*weight; sy += y*weight; n += weight;
    minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
  }
  if (n < 12) return { x:w*0.28, y:h*0.10, w:w*0.44, h:h*0.32, found:false };
  const cx = sx/n, cy = sy/n;
  const fw = Math.max(w*0.22, Math.min(w*0.60, (maxX-minX)*1.3));
  const fh = Math.max(h*0.16, Math.min(h*0.42, (maxY-minY)*1.5));
  return { x: Math.max(0, cx-fw/2), y: Math.max(0, cy-fh/2), w:fw, h:fh, found:true };
}

/** k-means で適応パレットを作成（顔領域を重み付け） */
function buildPalette(data, w, h, k, face) {
  const samples = [];
  const bins = new Map();
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const p=(y*w+x)*4;
    if (data[p+3] < 40) continue;
    const inFace = x>=face.x && x<=face.x+face.w && y>=face.y && y<=face.y+face.h;
    const weight = inFace ? 3 : 1;
    samples.push({ r:data[p], g:data[p+1], b:data[p+2], w:weight, x, y });
    const key = `${data[p]>>4}_${data[p+1]>>4}_${data[p+2]>>4}`;
    const bin = bins.get(key) || { r:0,g:0,b:0,n:0 };
    bin.r+=data[p]; bin.g+=data[p+1]; bin.b+=data[p+2]; bin.n+=weight; bins.set(key,bin);
  }
  if (!samples.length) return [[40,44,60]];
  let centers = [...bins.values()].sort((a,b)=>b.n-a.n).slice(0,k).map(b=>[b.r/b.n,b.g/b.n,b.b/b.n]);
  if (centers.length < k) {
    const extra = samples.filter((_,i)=>i%Math.max(1,Math.floor(samples.length/(k-centers.length)))===0)
      .slice(0,k-centers.length).map(s=>[s.r,s.g,s.b]);
    centers = centers.concat(extra);
  }
  for (let it=0; it<7; it++) {
    const acc = centers.map(()=>[0,0,0,0]);
    for (const s of samples) {
      let bi=0, bd=Infinity;
      for (let i=0;i<centers.length;i++) {
        const c=centers[i]; const d=(s.r-c[0])**2+(s.g-c[1])**2+(s.b-c[2])**2;
        if (d<bd){bd=d;bi=i;}
      }
      acc[bi][0]+=s.r*s.w; acc[bi][1]+=s.g*s.w; acc[bi][2]+=s.b*s.w; acc[bi][3]+=s.w;
    }
    for (let i=0;i<centers.length;i++) if (acc[i][3]) centers[i]=[acc[i][0]/acc[i][3],acc[i][1]/acc[i][3],acc[i][2]/acc[i][3]];
  }
  return centers;
}

const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

/** メイン変換：元画像 → 戦闘用ドット絵PNG（dataURL） */
export function makePixelSprite(image, s) {
  const gw = Math.max(20, Math.min(72, Math.round(s.grid || 40)));
  const gh = Math.round(gw / 0.78);
  const SW = Math.max(gw*3, 192), SH = Math.round(SW/0.78);
  const r = cropRect(image, s);

  // 1) 高解像度バッファへ切り抜き
  const hi = document.createElement('canvas'); hi.width=SW; hi.height=SH;
  const hx = hi.getContext('2d', { willReadFrequently:true });
  hx.imageSmoothingEnabled = true; hx.imageSmoothingQuality='high';
  hx.clearRect(0,0,SW,SH);
  if (!s.transparent) { hx.fillStyle='#ffffff'; hx.fillRect(0,0,SW,SH); }
  hx.drawImage(image, r.x, r.y, r.w, r.h, 0,0,SW,SH);
  let data = hx.getImageData(0,0,SW,SH).data;
  if (s.transparent) removeBackground(data, SW, SH, 30);
  data = bilateral(data, SW, SH);

  // 2) 縮小（エリア平均）＋ 顔特徴を保持するためのアンシャープ
  const small = document.createElement('canvas'); small.width=gw; small.height=gh;
  const sx = small.getContext('2d', { willReadFrequently:true });
  const tmp = document.createElement('canvas'); tmp.width=SW; tmp.height=SH;
  tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), SW, SH), 0,0);
  sx.imageSmoothingEnabled=true; sx.imageSmoothingQuality='high';
  sx.clearRect(0,0,gw,gh);
  sx.drawImage(tmp, 0,0,SW,SH, 0,0,gw,gh);
  const grid = sx.getImageData(0,0,gw,gh);
  const d = grid.data;
  const face = detectFace(data, SW, SH);
  const faceN = { x: face.x/SW*gw, y: face.y/SH*gh, w: face.w/SW*gw, h: face.h/SH*gh };

  // コントラスト・彩度調整（顔・髪の特徴を際立たせる）
  const sat = s.saturation ?? 1.12, con = s.contrast ?? 1.08;
  for (let i=0;i<d.length;i+=4) {
    if (d[i+3] < 20) continue;
    const lum = d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    d[i]   = clamp255((d[i]-lum)*sat + lum*con);
    d[i+1] = clamp255((d[i+1]-lum)*sat + lum*con);
    d[i+2] = clamp255((d[i+2]-lum)*sat + lum*con);
  }

  // エッジ保持の鮮鋭化（顔は強め、衣装は弱め）
  if (s.faceBoost !== false) {
    const orig = new Uint8ClampedArray(d);
    const lumAt = (arr,x,y) => { const p=(y*gw+x)*4; return arr[p]*0.299+arr[p+1]*0.587+arr[p+2]*0.114; };
    for (let y=1;y<gh-1;y++) for (let x=1;x<gw-1;x++) {
      const p=(y*gw+x)*4;
      if (orig[p+3] < 30) continue;
      const blur = (lumAt(orig,x-1,y)+lumAt(orig,x+1,y)+lumAt(orig,x,y-1)+lumAt(orig,x,y+1)+lumAt(orig,x,y)*2)/6;
      const sharp = lumAt(orig,x,y) - blur;
      const inFace = x>=faceN.x-1 && x<=faceN.x+faceN.w+1 && y>=faceN.y-1 && y<=faceN.y+faceN.h+1;
      const amt = inFace ? 1.15 : 0.42;
      for (let k=0;k<3;k++) d[p+k] = clamp255(orig[p+k] + sharp*amt);
    }
  }

  // 3) 適応パレット + 秩序ディザ + 3段階の陰影（描き直し）
  const palette = buildPalette(d, gw, gh, Math.max(5, Math.min(48, Math.round(s.colors||24))), faceN);
  const near = (r,g,b) => {
    let bi=0,bd=Infinity;
    for (let i=0;i<palette.length;i++) {
      const c=palette[i], dd=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;
      if (dd<bd){bd=dd;bi=i;}
    }
    return palette[bi];
  };
  const dither = (s.dither ?? 0.35) * 26;
  for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) {
    const p=(y*gw+x)*4;
    if (d[p+3] < 24) { d[p+3]=0; continue; }
    const b = (BAYER[(y%4)*4 + (x%4)]/15 - 0.5) * dither;
    const c = near(clamp255(d[p]+b), clamp255(d[p+1]+b), clamp255(d[p+2]+b));
    const lum = (c[0]*0.299+c[1]*0.587+c[2]*0.114)/255;
    // バンド化：ハイライト / 標準 / 影 / 深い影
    const band = lum > 0.72 ? 1.08 : lum > 0.46 ? 1.0 : lum > 0.24 ? 0.84 : 0.70;
    d[p]   = clamp255(c[0]*band + (band>1?8:-3));
    d[p+1] = clamp255(c[1]*band + (band>1?8:-3));
    d[p+2] = clamp255(c[2]*band + (band>1?8:-3));
    d[p+3] = 255;
  }

  // 4) 輪郭の描き起こし（Sobel + シルエット外郭）
  const outline = Math.max(0, Math.min(4, s.outline ?? 2));
  if (outline > 0) {
    const src = new Uint8ClampedArray(d);
    const L = (x,y) => { const p=(clamp255(Math.max(0,Math.min(gw-1,x)))*1 + clamp255(Math.max(0,Math.min(gh-1,y)))*gw)*4; return src[p]*0.299+src[p+1]*0.587+src[p+2]*0.114; };
    const alpha = (x,y) => x<0||y<0||x>=gw||y>=gh ? 0 : src[(y*gw+x)*4+3];
    const threshold = 92 - outline*11;
    for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) {
      const p=(y*gw+x)*4;
      if (src[p+3] < 24) continue;
      const gx = L(x+1,y-1)+2*L(x+1,y)+L(x+1,y+1)-L(x-1,y-1)-2*L(x-1,y)-L(x-1,y+1);
      const gy = L(x-1,y+1)+2*L(x,y+1)+L(x+1,y+1)-L(x-1,y-1)-2*L(x,y-1)-L(x+1,y-1);
      const g = Math.sqrt(gx*gx+gy*gy)/4;
      if (g > threshold) {
        const k = Math.max(0.22, 0.58 - outline*0.09);
        d[p]=src[p]*k; d[p+1]=src[p+1]*k; d[p+2]=src[p+2]*k*1.05; d[p+3]=255;
      }
      // 外側に1pxの濃い輪郭
      if (outline >= 2 && (alpha(x-1,y)<24 || alpha(x+1,y)<24 || alpha(x,y-1)<24 || alpha(x,y+1)<24)) {
        const k = 0.34;
        d[p]=src[p]*k; d[p+1]=src[p+1]*k; d[p+2]=src[p+2]*k*1.1; d[p+3]=255;
      }
    }
    // 透明側にもう1px輪郭を足す
    const sil = new Uint8ClampedArray(d);
    for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) {
      const p=(y*gw+x)*4;
      if (sil[p+3] > 24) continue;
      const up = y>0 ? sil[p-gw*4+3] : 0, dn = y<gh-1 ? sil[p+gw*4+3] : 0;
      const lf = x>0 ? sil[p-4+3] : 0, rt = x<gw-1 ? sil[p+4+3] : 0;
      if (up>24||dn>24||lf>24||rt>24) { d[p]=26; d[p+1]=24; d[p+2]=38; d[p+3]=Math.round(150+outline*22); }
    }
  }

  // 5) 最近傍で拡大して書き出し（本物のピクセルアートとして保存）
  small.getContext('2d').putImageData(grid,0,0);
  const PX = 8;
  const out = document.createElement('canvas'); out.width=gw*PX; out.height=gh*PX;
  const ox = out.getContext('2d'); ox.imageSmoothingEnabled=false;
  ox.clearRect(0,0,out.width,out.height);
  ox.drawImage(small,0,0,gw,gh,0,0,out.width,out.height);
  return { dataURL: out.toDataURL('image/png'), width: gw, height: gh, face: face.found };
}

/* ===========================================================
   CPUキャラクター用の高品質ドット絵を手続き的に描く
   =========================================================== */
function seeded(seed) {
  let x = 0;
  for (const ch of String(seed)) x = (x*31 + ch.charCodeAt(0)) >>> 0;
  return () => { x = (x*1664525 + 1013904223) >>> 0; return x/4294967296; };
}

export function makeEnemySprite(enemy) {
  const W=40, H=52, P=6;
  const cv=document.createElement('canvas'); cv.width=W*P; cv.height=H*P;
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const g=document.createElement('canvas'); g.width=W; g.height=H;
  const gx=g.getContext('2d', {willReadFrequently:true});
  const img=gx.createImageData(W,H);
  const p=enemy.palette||{hair:'#6b4a35',cloth:'#4c6a9c',skin:'#f0c9a0',accent:'#ffd77a'};
  const rnd=seeded(enemy.id||enemy.name||'x');
  const hex=h=>{const n=parseInt(h.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const shade=(h,f)=>{const [r,gg,b]=hex(h);return [clamp255(r*f),clamp255(gg*f),clamp255(b*f),255];};
  const set=(x,y,c)=>{if(x<0||y<0||x>=W||y>=H||!c)return;const i=(y*W+x)*4;img.data[i]=c[0];img.data[i+1]=c[1];img.data[i+2]=c[2];img.data[i+3]=c[3]??255;};
  const rect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(Math.round(x+i),Math.round(y+j),c);};
  const disc=(cx,cy,rx,ry,c)=>{for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1)set(x,y,c);}};
  const line=(x0,y0,x1,y1,c,t=1)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*i/n),y=Math.round(y0+(y1-y0)*i/n);rect(x,y,t,t,c);}};
  const skin=shade(p.skin,1), skinDark=shade(p.skin,.78), cloth=shade(p.cloth,1), clothDark=shade(p.cloth,.68),
    clothLight=shade(p.cloth,1.22), hair=shade(p.hair,1), hairDark=shade(p.hair,.68), hairLight=shade(p.hair,1.35),
    accent=shade(p.accent,1), metal=shade('#c8d4e4',1), metalDark=shade('#6f7d94',1), white=[245,248,255,255], dark=[24,22,38,255];
  const boss=!!enemy.boss, hidden=!!enemy.hidden;

  // オーラ（後方）
  if (boss) {
    const aura=hidden?[176,110,255,60]:[255,205,110,55];
    for(let y=3;y<H-5;y++)for(let x=2;x<W-2;x++){
      const dx=(x-20)/17,dy=(y-26)/22,d=dx*dx+dy*dy;
      if(d<1 && d>0.62 && !img.data[(y*W+x)*4+3]) set(x,y,[...aura.slice(0,3),Math.round(70*(1-d))]);
    }
  }
  // 影
  for(let x=8;x<32;x++){const dx=(x-20)/12;if(dx*dx<1)set(x,H-3,[10,14,26,140]);}
  // マント
  rect(8,20,4,20,clothDark); rect(28,20,4,20,clothDark);
  disc(20,32,12,14,clothDark);
  // 脚・ブーツ
  rect(14,37,4,9,clothDark); rect(22,37,4,9,clothDark);
  rect(13,44,6,4,metalDark); rect(21,44,6,4,metalDark);
  rect(13,47,7,2,dark); rect(21,47,7,2,dark);
  // 胴・鎧
  disc(20,28,8,10,cloth);
  rect(13,22,14,10,cloth);
  rect(16,22,8,7,clothLight);
  rect(19,22,2,10,accent);
  rect(13,31,14,2,metalDark);
  // 腕
  rect(9,23,4,11,cloth); rect(27,23,4,11,cloth);
  rect(9,33,4,4,skin); rect(27,33,4,4,skin);
  // 首・顔
  rect(18,18,4,3,skinDark);
  disc(20,13,7,8,skin);
  disc(20,16,5,3,skinDark);
  // 目（白＋虹彩＋ハイライト）
  rect(16,13,3,2,white); rect(22,13,3,2,white);
  rect(17,13,1,2,accent); rect(23,13,1,2,accent);
  set(17,13,dark); set(23,13,dark);
  set(16,13,[255,255,255,200]); set(22,13,[255,255,255,200]);
  rect(16,11,3,1,hairDark); rect(22,11,3,1,hairDark);
  set(20,16,skinDark);
  // 髪（スタイルをseedで変化）
  const hs=Math.floor(rnd()*4);
  disc(20,9,8,5,hair);
  rect(12,8,16,4,hair);
  if(hs===0){ rect(11,9,3,10,hair); rect(26,9,3,10,hair); }
  if(hs===1){ rect(12,9,3,7,hairDark); rect(25,9,3,6,hair); line(20,3,24,8,hair,2); }
  if(hs===2){ rect(12,9,16,2,hairDark); rect(11,9,2,12,hair); rect(27,9,2,12,hair); }
  if(hs===3){ line(19,3,22,9,hair,2); line(22,3,18,9,hairLight,1); rect(27,10,2,9,hairDark); }
  rect(15,6,10,2,hairLight);
  // ボス：角・冠
  if(boss){ line(13,7,10,1,accent,2); line(27,7,30,1,accent,2); rect(16,4,8,2,accent); set(20,3,white); }
  // 武器（職業で変化）
  const job=enemy.job||'warrior';
  const weaponType = ({mage:'杖',priest:'杖',archer:'弓',gunner:'銃',thief:'短剣',ninja:'短剣',monk:'拳',knight:'槍',dragonknight:'槍',summoner:'特殊',alchemist:'特殊',timeweaver:'特殊',apostle:'杖',destroyer:'斧',starguard:'剣'})[job]||'剣';
  if(weaponType==='杖'){ line(32,12,32,44,shade('#6b4a32',1),2); disc(32,10,3,3,accent); set(32,10,white); }
  else if(weaponType==='弓'){ line(33,12,36,24,metal,2); line(36,24,33,38,metal,2); line(33,12,33,38,[230,235,245,255],1); line(33,25,30,25,accent,1); }
  else if(weaponType==='銃'){ rect(29,25,8,3,metalDark); rect(34,28,2,5,shade('#4a3527',1)); rect(29,24,5,1,accent); }
  else if(weaponType==='斧'){ line(32,14,32,42,shade('#6b4a32',1),2); rect(29,12,7,5,metal); rect(33,13,2,3,white); }
  else if(weaponType==='槍'){ line(33,4,33,46,shade('#6b4a32',1),2); disc(33,5,2,3,metal); set(33,3,accent); }
  else if(weaponType==='拳'){ rect(8,32,6,4,metal); rect(27,32,6,4,metal); rect(9,32,4,1,accent); rect(28,32,4,1,accent); }
  else if(weaponType==='特殊'){ disc(33,20,3,3,accent); disc(33,20,1,1,white); line(30,25,32,36,clothLight,1); }
  else if(weaponType==='短剣'){ line(29,30,35,20,metal,2); line(28,31,31,34,shade('#4a3527',1),2); }
  else { line(30,32,37,8,metal,3); line(37,8,39,12,white,1); line(27,31,32,34,shade('#6b4a32',1),2); set(29,30,accent); }
  // ハイライトのディザ
  for(let y=20;y<36;y++)for(let x=12;x<28;x++) if(rnd()<0.045) set(x,y,clothLight);
  // シルエット輪郭（透明隣接へ1px）
  const before=new Uint8ClampedArray(img.data);
  const A=(x,y)=>x<0||y<0||x>=W||y>=H?0:before[(y*W+x)*4+3];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    if(before[i+3]>20)continue;
    if(A(x-1,y)>20||A(x+1,y)>20||A(x,y-1)>20||A(x,y+1)>20) { img.data[i]=18;img.data[i+1]=16;img.data[i+2]=30;img.data[i+3]=215; }
  }
  gx.putImageData(img,0,0);
  ctx.drawImage(g,0,0,W,H,0,0,W*P,H*P);
  return cv.toDataURL('image/png');
}
