// ============ 汎用ユーティリティ ============
export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const fmt = n => Math.round(n).toLocaleString('ja-JP');
export const pct = (a,b) => b>0 ? clamp(a/b*100,0,100) : 0;
export const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
export const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
export const nowStr = () => { const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function el(tag, attrs={}, ...children){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})){
    if (v==null) continue;
    if (k==='class') e.className = v;
    else if (k==='html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2), v);
    else if (k==='style' && typeof v==='object') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  for (const c of children.flat(9)){
    if (c==null || c===false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// シード付き乱数
export function mulberry32(seed){
  let a = typeof seed==='string' ? [...seed].reduce((h,c)=>(h*31 + c.charCodeAt(0))>>>0, 7) : seed>>>0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const pick = (arr, rng=Math.random) => arr[Math.floor(rng()*arr.length)];
export const chance = (p, rng=Math.random) => rng()*100 < p;

// イベントバス
class Bus {
  constructor(){ this.t = new EventTarget(); }
  on(ev, fn){ this.t.addEventListener(ev, e=>fn(e.detail)); }
  emit(ev, detail){ this.t.dispatchEvent(new CustomEvent(ev, {detail})); }
}
export const bus = new Bus();

export const sleep = ms => new Promise(r=>setTimeout(r, ms));

// 画像を最大辺maxに収めたdataURLへ
export function downscaleImage(img, max, type='image/png'){
  const w = img.naturalWidth||img.width, h = img.naturalHeight||img.height;
  const s = Math.min(1, max/Math.max(w,h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w*s)); c.height = Math.max(1, Math.round(h*s));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type);
}
export function loadImage(src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.onerror = ()=>rej(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}
