// ============ WebAudio サウンド ============
let ctx=null, master=null, bgmGain=null, sfxGain=null;
let bgmTimer=null, bgmStep=0, currentBGM=null;
const settings = {bgm:0.5, sfx:0.7};

function ensure(){
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value=settings.bgm*0.35; bgmGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value=settings.sfx; sfxGain.connect(master);
    return true;
  } catch(e){ return false; }
}
export function initAudio(){ if(ensure() && ctx.state==='suspended') ctx.resume(); }
export function setVolumes(bgm, sfx){
  settings.bgm=bgm; settings.sfx=sfx;
  if(bgmGain) bgmGain.gain.value=bgm*0.35;
  if(sfxGain) sfxGain.gain.value=sfx;
}
function tone(freq, dur, type='square', vol=0.2, when=0, dest=null, slide=0){
  if(!ensure()) return;
  const t = ctx.currentTime+when;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide), t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(dest||sfxGain);
  o.start(t); o.stop(t+dur+0.05);
}
function noise(dur, vol=0.2, when=0, filterFreq=1200){
  if(!ensure()) return;
  const t=ctx.currentTime+when;
  const buf=ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const src=ctx.createBufferSource(); src.buffer=buf;
  const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=filterFreq;
  const g=ctx.createGain(); g.gain.value=vol;
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t);
}
export const SFX = {
  click(){ tone(880,0.05,'square',0.12); },
  confirm(){ tone(660,0.07,'square',0.15); tone(990,0.09,'square',0.15,0.06); },
  cancel(){ tone(440,0.08,'square',0.12); tone(330,0.1,'square',0.12,0.06); },
  hit(){ noise(0.12,0.25,0,900); tone(160,0.1,'square',0.18,0,-80); },
  crit(){ noise(0.2,0.3,0,1600); tone(220,0.16,'sawtooth',0.22,0,-120); tone(440,0.12,'square',0.15,0.03); },
  magic(){ tone(520,0.18,'sine',0.18,0,300); tone(780,0.22,'sine',0.14,0.05,200); },
  heal(){ tone(523,0.12,'sine',0.16); tone(659,0.12,'sine',0.16,0.08); tone(784,0.16,'sine',0.16,0.16); },
  buff(){ tone(392,0.1,'triangle',0.16); tone(523,0.12,'triangle',0.16,0.07); },
  debuff(){ tone(300,0.16,'sawtooth',0.14,0,-100); },
  coin(){ tone(1200,0.06,'square',0.12); tone(1600,0.08,'square',0.12,0.05); },
  levelup(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.14,'square',0.16,i*0.09)); },
  victory(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,0.18,'square',0.16,i*0.11)); },
  defeat(){ [392,330,262,196].forEach((f,i)=>tone(f,0.22,'triangle',0.16,i*0.14)); },
  gacha(){ tone(600,0.06,'square',0.1); },
  rare(){ [659,830,988,1318].forEach((f,i)=>tone(f,0.14,'triangle',0.18,i*0.07)); },
  secret(){ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,0.16,'sine',0.2,i*0.08)); noise(0.4,0.1,0.3,3000); },
  awaken(){ [262,392,523,784,1047].forEach((f,i)=>tone(f,0.3,'sine',0.18,i*0.1)); },
};
export function sfx(name){ try{ SFX[name]?.(); }catch(e){} }

// ---- 簡易BGM(コードアルペジオ) ----
const PROGS = {
  title:  {bpm:80, chords:[[262,330,392],[220,262,330],[175,220,262],[196,247,294]], type:'sine'},
  facility:{bpm:90, chords:[[262,330,392],[294,370,440],[220,262,330],[196,247,294]], type:'triangle'},
  battle: {bpm:140, chords:[[220,262,330],[220,262,330],[175,220,262],[196,247,294]], type:'square'},
  boss:   {bpm:150, chords:[[196,233,294],[196,233,294],[165,196,247],[175,220,262]], type:'sawtooth'},
};
export function playBGM(name){
  if (!ensure()) return;
  if (currentBGM===name) return;
  currentBGM=name; bgmStep=0;
  clearInterval(bgmTimer);
  const p = PROGS[name]||PROGS.facility;
  const beat = 60/p.bpm/2;
  const tick=()=>{
    if (settings.bgm<=0) return;
    const chord = p.chords[Math.floor(bgmStep/8)%p.chords.length];
    const note = chord[bgmStep%3] * (bgmStep%8>=4?2:1);
    tone(note, beat*1.6, p.type, 0.10, 0, bgmGain);
    if (bgmStep%8===0) tone(chord[0]/2, beat*3, 'triangle', 0.12, 0, bgmGain);
    bgmStep++;
  };
  tick();
  bgmTimer=setInterval(tick, beat*1000);
}
export function stopBGM(){ clearInterval(bgmTimer); bgmTimer=null; currentBGM=null; }
