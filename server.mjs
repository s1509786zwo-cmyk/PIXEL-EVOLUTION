// 静的配信サーバー
// - コード(html/js/css/json)はブラウザにもプロキシ/CDNにも一切キャッシュさせない
// - 画像・フォントのみ1日キャッシュ
// - 全リクエストをログ出力(原因調査用)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8000;
const BUILD = '20261105c';
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
};
const NO_CACHE = new Set(['.html','.js','.mjs','.css','.json']);
// ブラウザキャッシュ AND 共有キャッシュ(プロキシ/CDN)の両方を無効化
const NO_STORE_HEADERS = {
  'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'Pragma':'no-cache',
  'Expires':'0',
};

function log(req, status, path){
  const ip = (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const cc = req.headers['cache-control'] || '-';
  const t = new Date().toISOString().slice(11,19);
  console.log(`[${t}] ${ip} ${req.method} ${path} -> ${status} (req-cc:${cc})`);
}

const server = http.createServer(async (req, res)=>{
  const url = new URL(req.url, 'http://x');
  const full = url.pathname + url.search;
  try {
    // 診断用エンドポイント: サーバーが配信しているビルドを返す(絶対にキャッシュされない)
    if (url.pathname === '/__build') {
      res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', ...NO_STORE_HEADERS });
      res.end(JSON.stringify({ build: BUILD, serverTime: new Date().toISOString(), ok:true }));
      log(req, 200, full); return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); log(req,403,full); return; }
    const st = await stat(file).catch(()=>null);
    if (!st || !st.isFile()) { res.writeHead(404, NO_STORE_HEADERS); res.end('Not Found'); log(req,404,full); return; }
    const ext = extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (NO_CACHE.has(ext)) Object.assign(headers, NO_STORE_HEADERS);
    else headers['Cache-Control'] = 'public, max-age=86400';
    const body = await readFile(file);
    res.writeHead(200, headers);
    res.end(body);
    log(req, 200, full);
  } catch(e){ res.writeHead(500); res.end('Server Error'); log(req,500,full); }
});
server.listen(PORT, '0.0.0.0', ()=>console.log(`オリキャラファイターズ build ${BUILD} serving on http://0.0.0.0:${PORT} (code: no-store + proxy-revalidate, logging ON)`));
