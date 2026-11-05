// ============ エントリーポイント ============
import { loadGame } from './save.js';
import { S, setState, defaultState, regenStamina, persist } from './state.js';
import { register, go, toast } from './ui.js';
import { initAudio, setVolumes } from './audio.js';
import { bus } from './util.js';
import { renderTitle } from './screens/title.js';
import { renderCreate } from './screens/create.js';
import { renderHub } from './screens/hub.js';
import { renderHall } from './screens/hall.js';
import { renderForge } from './screens/forge.js';
import { renderDojo } from './screens/dojo.js';
import { renderGuild } from './screens/guild.js';
import { renderShop } from './screens/shop.js';
import { renderCodex } from './screens/codex.js';
import { renderSettings } from './screens/settings.js';

async function boot(){
  // セーブロード
  try {
    const data = await loadGame();
    if (data && data.version){
      // マイグレーション/欠損補完
      const base = defaultState();
      setState(Object.assign(base, data, {
        settings: Object.assign(base.settings, data.settings||{}),
        counters: Object.assign(base.counters, data.counters||{}),
        codex: Object.assign(base.codex, data.codex||{}),
        pity: Object.assign(base.pity, data.pity||{}),
      }));
    }
  } catch(e){ console.error('load failed', e); }
  setVolumes(S.settings.bgm, S.settings.sfx);
  regenStamina();

  register('title', renderTitle);
  register('create', renderCreate);
  register('hub', renderHub);
  register('hall', renderHall);
  register('forge', renderForge);
  register('dojo', renderDojo);
  register('guild', renderGuild);
  register('shop', renderShop);
  register('codex', renderCodex);
  register('settings', renderSettings);

  // 初回ユーザー操作でオーディオ解禁
  const unlock = ()=>{ initAudio(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock);

  // スタミナ回復の定期反映
  setInterval(()=>{ regenStamina(); bus.emit('state:changed'); }, 30000);

  // 画面離脱時にセーブ
  window.addEventListener('beforeunload', ()=>{ try{ persist(); }catch(e){} });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) persist(); });

  go('title');
}
boot();
