/* ===========================================================
   画像読み込み / 背景透過 / CPUスプライト生成
   - プレイヤー画像のドット絵変換・AI描き直しは廃止。
     読み込んだ元画像をそのままキャラクター画像として使う。
   - 背景透過だけは元画像の背景色を推定してアルファを抜く。
     （輪郭・服装・色・細部は一切変更しない）
   =========================================================== */

/* プレイヤーが選んだ画像は再エンコードせず、バイト列そのままを保持する。
   PNG / JPEG / WebP / GIF / BMP / AVIF などブラウザが読める形式に対応。 */
export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('画像ファイルを選択してください'));
    const ok = (file.type || '').startsWith('image/')
      || /\.(png|jpe?g|webp|gif|bmp|avif|svg|heic|heif)$/i.test(file.name || '');
    if (!ok) return reject(new Error('画像ファイル（PNG/JPEG/WebP など）を選択してください'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('ファイルを読み込めませんでした'));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve({
        image: img, dataURL: fr.result,
        width: img.naturalWidth || img.width, height: img.naturalHeight || img.height,
        name: file.name || '',
      });
      img.onerror = () => reject(new Error('この形式の画像は表示できませんでした'));
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


/** 背景だけを透過したPNGを生成（元画像のデータは書き換えない） */
export function makeTransparentImage(image, strength = 30) {
  const W = Math.min(900, image.width || 900), H = Math.round(W * (image.height / image.width));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(image, 0, 0, W, H);
  const data = ctx.getImageData(0,0,W,H).data;
  removeBackground(data, W, H, strength);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), W, H), 0, 0);
  return { dataURL: cv.toDataURL('image/png'), width: W, height: H };
}

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
