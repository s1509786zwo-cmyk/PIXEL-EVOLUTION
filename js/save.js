// ============ セーブシステム (IndexedDB + localStorageフォールバック) ============
const DB_NAME = 'orichara-fighters';
const STORE = 'saves';
const KEY = 'main';
let _db = null;

function openDB(){
  return new Promise((res, rej)=>{
    if (typeof indexedDB === 'undefined') return rej(new Error('no idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => { _db = req.result; res(_db); };
    req.onerror = () => rej(req.error);
  });
}
async function db(){ return _db || openDB(); }

export async function saveGame(state){
  const data = JSON.stringify(state);
  try {
    const d = await db();
    await new Promise((res, rej)=>{
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch(e){
    try { localStorage.setItem('ocf-save', data); } catch(e2){ console.error('save failed', e2); throw e2; }
  }
  try { localStorage.setItem('ocf-save-time', String(Date.now())); } catch(e){}
}
export async function loadGame(){
  try {
    const d = await db();
    const data = await new Promise((res, rej)=>{
      const tx = d.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(KEY);
      rq.onsuccess = ()=>res(rq.result); rq.onerror = ()=>rej(rq.error);
    });
    if (data) return JSON.parse(data);
  } catch(e){ /* fallback below */ }
  try {
    const data = localStorage.getItem('ocf-save');
    if (data) return JSON.parse(data);
  } catch(e){}
  return null;
}
export async function deleteSave(){
  try {
    const d = await db();
    await new Promise((res, rej)=>{
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = res; tx.onerror = ()=>rej(tx.error);
    });
  } catch(e){}
  try { localStorage.removeItem('ocf-save'); localStorage.removeItem('ocf-save-time'); } catch(e){}
}
export function hasSaveHint(){
  try { return !!localStorage.getItem('ocf-save-time'); } catch(e){ return false; }
}
export function exportSave(state){
  const blob = new Blob([JSON.stringify(state, null, 1)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `orichara-fighters-save-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
}
