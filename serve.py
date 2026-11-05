#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""オリキャラファイターズ専用の静的サーバー（キャッシュ事故の恒久対策）。

なぜ `python3 -m http.server` を使わないか
------------------------------------------------
SimpleHTTPRequestHandler は Cache-Control を一切送らず、さらに
If-Modified-Since に対して 304 Not Modified を返します。その結果
ブラウザ / プレビュー用プロキシが古い ES モジュールを再利用し、
「強制再読み込みをしても画面が変わらない」状態になります。
実際に 2026-11-05 のログでは、コード更新後もユーザー側リクエストが
`GET / -> 304` だけで、js/*.js が 1 本も再取得されていませんでした。

このサーバーの保証
------------------------------------------------
1. 全レスポンスに `Cache-Control: no-store` / `Pragma: no-cache` / `Expires: 0`
2. 条件付きリクエストを破棄し、**304 を絶対に返さない**（常に 200 + 最新ボディ）
3. HTML / JS / CSS 内のローカル参照に、全ソース内容のハッシュ `?h=xxxx` を付与。
   コードが 1 文字でも変われば全 URL が変わるため、どんなキャッシュ層も
   古いモジュールを返せません。ハッシュはリクエストごとに再計算するので
   サーバー再起動すら不要です。
4. `/__build.json` で現在配信中のビルドを確認可能。
   タイトル画面にもビルド ID を表示するため、古い画面かどうか一目で判別できます。

起動: python3 serve.py [port]   （デフォルト 4174 / 0.0.0.0 にバインド）
"""
import hashlib
import io
import json
import os
import re
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT_EXT = ('.html', '.js', '.css')
MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
}

# バージョン付き参照（?v=2 / ?h=xxxx など）を、毎回の内容ハッシュで上書きする
RE_HTML_REF = re.compile(
    r'((?:css|js|assets)/[A-Za-z0-9_./-]+\.(?:html|css|js|jpg|jpeg|png|webp|gif|svg))'
    r'(?:\?[^\s"\'<>)]*)?'
)
RE_JS_SPECIFIER = re.compile(r"(?P<q>['\"])(?P<p>\./[A-Za-z0-9_.-]+\.js)(?:\?[^'\"]*)?(?P=q)")


def build_hash():
    """配信対象の全テキストソースから内容ハッシュを作る（リクエストごとに呼ぶ）。"""
    h = hashlib.sha256()
    targets = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames
                       if d not in ('.git', '__pycache__', 'node_modules', '.arena', '.cache')]
        for name in filenames:
            if name.endswith(TEXT_EXT):
                targets.append(os.path.join(dirpath, name))
    for path in sorted(targets):
        h.update(os.path.relpath(path, ROOT).replace(os.sep, '/').encode('utf-8'))
        with open(path, 'rb') as f:
            h.update(f.read())
    return h.hexdigest()[:12]


def transform(path, raw, build):
    """HTML / JS / CSS のローカル参照を内容ハッシュ付き URL に書き換える。"""
    ext = os.path.splitext(path)[1].lower()
    text = raw.decode('utf-8')

    if ext == '.html':
        text = RE_HTML_REF.sub(lambda m: m.group(1) + '?h=' + build, text)
        text = text.replace('__BUILD__', build)
    elif ext == '.js':
        text = RE_JS_SPECIFIER.sub(
            lambda m: m.group('q') + m.group('p') + '?h=' + build + m.group('q'), text)
        text = text.replace('__BUILD__', build)
    elif ext == '.css':
        text = RE_HTML_REF.sub(lambda m: m.group(1) + '?h=' + build, text)

    return text.encode('utf-8')


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # --- 1. 全レスポンスに no-store。end_headers なので 304/エラーにも乗る ---
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    # --- 2. 条件付きリクエストを捨て、304 を発生させない ---
    def _drop_conditionals(self):
        for header in ('If-Modified-Since', 'If-None-Match', 'If-Match',
                       'If-Unmodified-Since', 'If-Range', 'Range'):
            while header in self.headers:
                del self.headers[header]

    def _resolved_path(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            for index in ('index.html', 'index.htm'):
                candidate = os.path.join(path, index)
                if os.path.isfile(candidate):
                    return candidate
        return path

    def send_head(self):
        self._drop_conditionals()
        parsed = urllib.parse.urlparse(self.path)

        # 診断用エンドポイント
        if parsed.path == '/__build.json':
            build = build_hash()
            body = json.dumps({
                'build': build,
                'root': ROOT,
                'cacheControl': 'no-store',
                'note': 'この値がタイトル画面の build と一致すれば最新です',
            }, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', MIME['.json'])
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            return io.BytesIO(body)

        path = self._resolved_path()
        ext = os.path.splitext(path)[1].lower()
        if ext in TEXT_EXT and os.path.isfile(path):
            try:
                with open(path, 'rb') as f:
                    body = transform(path, f.read(), build_hash())
                self.send_response(200)
                self.send_header('Content-Type', MIME.get(ext, 'application/octet-stream'))
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                return io.BytesIO(body)
            except OSError:
                pass

        # 画像などは親クラスに任せる（no-store ヘッダは end_headers で付く）
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4174
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    server.daemon_threads = True
    print('オリキャラファイターズ / no-store server  http://0.0.0.0:%d/  build=%s'
          % (port, build_hash()), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
