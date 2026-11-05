// ロジックテスト (node test/logic.test.mjs)
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
import assert from 'node:assert';
import * as G from '../js/state.js';
import { Battle } from '../js/battle.js';
import { makeEnemy, makeOpponent, makeDungeonFloor, BOSS_MAP } from '../js/data/enemies.js';
import { SKILLS, SKILL_MAP } from '../js/data/skills.js';
import { JOBS } from '../js/data/jobs.js';
import { xpNeed, AWAKEN_STAGES } from '../js/data/items.js';
import { RARITIES } from '../js/data/equipment.js';

let passed=0;
function ok(name, fn){ try{ fn(); passed++; console.log('  ✓', name);}catch(e){ console.error('  ✗', name, '\n   ', e.message); process.exitCode=1; } }

console.log('— データ整合性 —');
ok('技は100種以上', ()=>assert.ok(SKILLS.length>=100, SKILLS.length+''));
ok('職業は20種以上', ()=>assert.ok(JOBS.length>=20));
ok('全ジョブの習得技が存在', ()=>{ for(const j of JOBS) for(const l of [...j.learn,...j.jlearn]) assert.ok(SKILL_MAP[l.id], j.id+':'+l.id); });

console.log('— キャラクター作成・育成 —');
G.setState(G.defaultState());
const ch = G.createCharacter({name:'テスト勇者', job:'swordsman', style:'attack', sprite:'data:image/png;base64,x', source:'data:image/png;base64,y', alloc:{atk:5,hp:3,spd:2}});
ok('キャラ作成', ()=>{ assert.equal(G.S.characters.length,1); assert.ok(ch.skills.length>=1); assert.ok(ch.equip.weapon); });
ok('ステータス算出', ()=>{ const {stats}=G.charStats(ch); assert.ok(stats.hp>0&&stats.atk>0&&stats.acc>0); });
ok('レベルアップ&全回復&技習得', ()=>{ ch.hp=1; const r=G.addXp(ch, 5000); assert.ok(r.ups>0); assert.ok(ch.statPoints>10); assert.equal(ch.hp,null); });
ok('能力値振分', ()=>{ const before=ch.alloc.atk; assert.ok(G.allocate(ch,'atk',2)); assert.equal(ch.alloc.atk,before+2); });
ok('職業熟練度上昇', ()=>{ const r=G.addJobXp(ch, 5000); assert.ok(r.ups>0); });
ok('ジョブチェンジ(剣聖は条件必要)', ()=>{ assert.ok(G.changeJob(ch,'fighter')); assert.equal(ch.job,'fighter'); });

console.log('— 装備・ガチャ —');
G.S.coins=100000;
ok('10連ガチャ', ()=>{ const r=G.doGacha('weapon',10); assert.equal(r.length,10); assert.ok(G.S.counters.gacha>=10); assert.ok(r.some(e=>RARITIES.indexOf(e.rarity)>=2)); });
ok('装備ガチャ', ()=>{ const r=G.doGacha('gear',10); assert.equal(r.length,10); });
ok('装備強化', ()=>{ const eq=G.S.equipment[0]; const r=G.enhanceEquip(eq.uid); assert.ok(r.ok); assert.equal(eq.lv,1); });
ok('装備合成', ()=>{ const n=G.S.equipment.filter(e=>e.slot==='weapon'&&e.rarity==='N').slice(0,3);
  while(G.S.equipment.filter(e=>e.slot==='weapon'&&e.rarity==='N').length<3){ G.S.equipment.push({...n[0], uid:'x'+Math.random()}); }
  const three=G.S.equipment.filter(e=>e.slot==='weapon'&&e.rarity==='N').slice(0,3).map(e=>e.uid);
  const r=G.fuseEquips(three); assert.ok(r.ok, r.msg); assert.equal(r.eq.rarity,'R'); });
ok('装備付け替え', ()=>{ const w=G.S.equipment.find(e=>e.slot==='weapon'&&e.type==='sword'); if(w){ assert.ok(G.equipItem(ch,w.uid)); } });

console.log('— 戦闘エンジン —');
ok('CPU戦が終了する(自動×20)', ()=>{
  for(let i=0;i<20;i++){
    const p=G.buildPlayerUnit(ch); const e=makeOpponent(Math.max(5,ch.level),'normal');
    const b=new Battle(p,e,{bag:{potion:2}});
    b.start();
    let guard=0;
    while(!b.over && guard++<400){ const cur=b.current(); if(!cur)break; b.submit(b.aiChoose(cur)); }
    assert.ok(b.over, 'battle did not end');
    assert.ok(b.win===true||b.win===false);
  }
});
ok('ボス戦が終了する', ()=>{
  const b0=BOSS_MAP.demon_lord; const e=makeEnemy({job:b0.job,level:b0.level,mult:b0.mult,name:b0.name,skills:b0.skills,seed:b0.id,isBoss:true,diff:'nightmare'});
  const p=G.buildPlayerUnit(ch); p.stats.hp*=5; p.hp=p.stats.hp; p.maxHp=p.stats.hp;
  const b=new Battle(p,e); b.start(); let g=0; while(!b.over&&g++<500){const c=b.current(); if(!c)break; b.submit(b.aiChoose(c));}
  assert.ok(b.over);
});
ok('ダンジョン敵生成', ()=>{ const e=makeDungeonFloor('cave',1); assert.ok(e.stats.hp>0); });

console.log('— 報酬・クエスト・実績 —');
ok('勝利報酬', ()=>{ const e=makeOpponent(ch.level,'normal'); const coins=G.S.coins; const r=G.battleRewards(ch,e,true,{}); assert.ok(r.coins>0); assert.ok(G.S.coins>coins); assert.ok(G.S.points>=0); });
ok('敗北報酬(少量)', ()=>{ const e=makeOpponent(ch.level,'normal'); const r=G.battleRewards(ch,e,false,{}); assert.ok(r.points>=0); });
ok('デイリークエスト', ()=>{ G.trackDaily('wins',3); assert.ok(G.claimQuest('dq_win3')); });
ok('実績チェック', ()=>{ G.checkAchievements(); assert.ok(Object.keys(G.S.achievements).length>0); });

console.log('— 覚醒・転生・交換所 —');
ok('覚醒', ()=>{ ch.level=35; ch.jobData[ch.job].lv=6; G.S.counters.bossKills=2; G.addItem('awk_shard',5);
  const req=G.awakenReq(ch); assert.ok(req.okLevel&&req.okJl&&req.okBoss&&req.okMats); assert.ok(G.doAwaken(ch)); assert.equal(ch.awaken,1); assert.ok(ch.skills.includes('awk_soul_burst')); });
ok('転生', ()=>{ ch.level=100; assert.ok(G.doRebirth(ch)); assert.equal(ch.level,1); assert.equal(ch.rebirth,1); });
ok('ポイント交換', ()=>{ G.S.points=5000; const r=G.buyPointShop('ps_sword_god'); assert.ok(r.ok, r.msg); assert.ok(ch.skills.includes('pt_gladiator')); });
ok('特別装備交換', ()=>{ const r=G.buyPointShop('sp_hero_sword'); assert.ok(r.ok); assert.ok(G.S.equipment.some(e=>e.special)); });

console.log('— セーブ —');
ok('シリアライズ往復', ()=>{ const json=JSON.stringify(G.S); const back=JSON.parse(json); assert.equal(back.characters.length,1); assert.equal(back.characters[0].name,'テスト勇者'); });

console.log(`\n${passed} tests passed${process.exitCode?' (with failures)':''}`);
