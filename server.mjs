// 静的配信サーバー(コードは常に最新を取得 / 画像・フォントはキャッシュ)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8000;
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
};
// コード系はキャッシュさせない(常に最新)。画像・フォントは1日キャッシュ。
const NO_CACHE = new Set(['.html','.js','.mjs','.css','.json']);

const server = http.createServer(async (req, res)=>{
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
    const st = await stat(file).catch(()=>null);
    if (!st || !st.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (NO_CACHE.has(ext)) headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
    else headers['Cache-Control'] = 'public, max-age=86400';
    const body = await readFile(file);
    res.writeHead(200, headers);
    res.end(body);
  } catch(e){ res.writeHead(500); res.end('Server Error'); }
});
server.listen(PORT, '0.0.0.0', ()=>console.log(`オリキャラファイターズ serving on http://0.0.0.0:${PORT} (code: no-store)`));
