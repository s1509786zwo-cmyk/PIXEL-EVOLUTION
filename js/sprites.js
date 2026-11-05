// ============ CPU用プロシージャル・ドット絵スプライト ============
import { mulberry32 } from './util.js?v=20261105c';
import { JOB_MAP } from './data/jobs.js?v=20261105c';

const SKINS = ['#f6d3ae','#e8b98a','#d29b6c','#b07a4a','#8a5a34','#ffe0c2'];
const HAIRS = ['#23262e','#4a3220','#7a4a22','#c9a227','#b03030','#2e5f9e','#6a3fa0','#d8d8e0','#2e7d54','#e07020'];
const JOB_COLORS = {
  fighter:['#8a5a2a','#b07840'], swordsman:['#3a6ea5','#5a92c9'], knight:['#7a8290','#a8b0bc'],
  mage:['#5a3fa0','#7a5fc0'], priest:['#c9b060','#e8d090'], thief:['#3a3f4a','#5a6070'],
  archer:['#3f7d3a','#5fa05a'], monk:['#b05030','#d07050'], gunner:['#5a5f6a','#808898'],
  summoner:['#3f6a8a','#5f8ab0'], alchemist:['#4a7a5a','#6aa07a'], ninja:['#2a2f3a','#4a5060'],
  berserker:['#8a2a20','#b04a38'], paladin:['#c0c8d8','#e8eef8'], sage:['#6a5a9a','#8a7ac0'],
  ranger:['#4a6a3a','#6a8a5a'], swordmaster:['#d0d8e8','#f0f4ff'], archmage:['#4a2a8a','#6a4ac0'],
  assassin:['#1a1f2a','#3a4050'], dragoon:['#2a5a8a','#4a7ab0'], spellblade:['#8a3a5a','#b05a7a'],
  divine:['#e8e0c0','#fff8e0'], destroyer:['#5a1a1a','#8a3030'], chronomancer:['#2a4a6a','#4a6a9a'],
};
const cache = new Map();

export function enemySprite(seed, job, isBoss=false){
  const key = seed+'|'+job+'|'+isBoss;
  if (cache.has(key)) return cache.get(key);
  const rng = mulberry32(key);
  const N = 36;
  const c = document.createElement('canvas'); c.width=N; c.height=N;
  const x = c.getContext('2d');
  const px=(a,b,col)=>{x.fillStyle=col;x.fillRect(a,b,1,1);};
  const rect=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(a,b,w,h);};
  const skin = SKINS[Math.floor(rng()*SKINS.length)];
  const hair = HAIRS[Math.floor(rng()*HAIRS.length)];
  const [armor, armorHi] = JOB_COLORS[job]||JOB_COLORS.fighter;
  const dark = '#14161e';
  const hairStyle = Math.floor(rng()*5);
  const j = JOB_MAP[job]||JOB_MAP.fighter;
  const wt = j.weapons[0];

  // 影
  x.fillStyle='rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(18,33,9,2.4,0,0,7); x.fill();
  // マント(ボス)
  if (isBoss){ rect(9,12,18,17,'#3a1020'); rect(10,12,16,15,'#5a1a30'); }
  // 脚
  rect(13,24,4,8,dark); rect(19,24,4,8,dark);
  rect(14,24,2,7,armor); rect(20,24,2,7,armor);
  // 胴体
  rect(11,13,14,12,dark);
  rect(12,14,12,10,armor);
  rect(12,14,12,2,armorHi);
  rect(12,22,12,2,shade(armor,-25));
  // ベルト
  rect(12,21,12,1,'#2a2018'); px(17,21,'#e8c060');
  // 腕
  rect(9,14,3,8,dark); rect(24,14,3,8,dark);
  rect(10,15,1,6,armor); rect(25,15,1,6,armor);
  px(10,21,skin); px(25,21,skin);
  // 頭
  rect(12,3,12,11,dark);
  rect(13,4,10,9,skin);
  rect(13,4,10,2,shade(skin,12));
  // 髪型
  if (hairStyle===0){ rect(12,2,12,4,hair); rect(12,4,2,5,hair); rect(22,4,2,5,hair); }
  else if (hairStyle===1){ rect(12,2,12,5,hair); rect(11,4,2,8,hair); rect(23,4,2,8,hair); }
  else if (hairStyle===2){ rect(13,2,10,3,hair); px(13,5,hair); px(22,5,hair); rect(15,1,6,2,hair); }
  else if (hairStyle===3){ rect(12,2,12,4,hair); rect(12,4,3,9,hair); rect(21,4,3,9,hair); }
  else { rect(13,2,10,4,hair); px(12,3,hair); px(23,3,hair); rect(16,1,4,2,hair); }
  // 目・眉
  const eye = '#1a2030';
  px(15,8,eye); px(16,8,eye); px(19,8,eye); px(20,8,eye);
  px(15,7,shade(hair,-10)); px(20,7,shade(hair,-10));
  px(16,8,'#ffffff'); px(20,8,'#ffffff');
  // 口
  px(17,11,shade(skin,-40)); px(18,11,shade(skin,-40));
  // 職業装飾
  if (['knight','paladin','dragoon'].includes(job)){ rect(12,2,12,3,armorHi); px(17,1,'#e8c060'); }
  if (['mage','archmage','sage','chronomancer'].includes(job)){ rect(11,1,14,2,armor); px(17,0,'#e8c060'); }
  if (job==='ninja'||job==='assassin'){ rect(13,9,10,3,'#1a1f2a'); px(15,8,'#e05050'); px(20,8,'#e05050'); }
  if (job==='divine'){ x.fillStyle='rgba(255,240,180,0.5)'; x.beginPath(); x.arc(18,2,4,0,7); x.fill(); }
  // 武器
  drawWeapon(x, px, rect, wt, isBoss);
  // ボスオーラ
  if (isBoss){
    x.strokeStyle='rgba(255,120,60,0.6)'; x.lineWidth=1;
    x.strokeRect(6.5,0.5,23,34);
  }
  cache.set(key,c);
  return c;
}
function drawWeapon(x, px, rect, wt, boss){
  const steel='#c8d0dc', steelD='#8890a0', wood='#7a5230', glow=boss?'#ff8040':'#e8c060';
  if (wt==='sword'){ rect(27,8,2,12,steelD); rect(27,8,1,12,steel); rect(26,19,4,2,wood); rect(27,21,2,3,wood); px(27,7,glow); }
  else if (wt==='axe'){ rect(27,9,2,13,wood); rect(25,8,6,5,steel); rect(25,8,6,1,steelD); px(25,9,glow); }
  else if (wt==='spear'){ rect(28,4,1,20,wood); rect(27,2,3,4,steel); px(28,1,glow); }
  else if (wt==='bow'){ x.strokeStyle=wood; x.lineWidth=2; x.beginPath(); x.arc(28,14,7,-1.2,1.2); x.stroke(); x.strokeStyle='#d0d8e0'; x.lineWidth=1; x.beginPath(); x.moveTo(30,8); x.lineTo(30,20); x.stroke(); }
  else if (wt==='gun'){ rect(26,16,7,3,steelD); rect(26,16,7,1,steel); rect(27,19,2,3,wood); px(33,17,glow); }
  else if (wt==='staff'){ rect(28,6,1,18,wood); x.fillStyle=glow; x.beginPath(); x.arc(28.5,5,2.5,0,7); x.fill(); }
  else { rect(26,18,4,4,glow); rect(27,19,2,2,'#fff0c0'); }
}
function shade(hex, amt){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)+amt, g=((n>>8)&255)+amt, b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
export function spriteDataURL(seed, job, isBoss){ return enemySprite(seed,job,isBoss).toDataURL('image/png'); }
