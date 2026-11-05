#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""キャッシュ事故の回帰テスト。

2026-11-05 に起きた「コードを更新しても強制再読み込みで画面が変わらない」事故の再発を防ぐ。
`python3 -m http.server` は Cache-Control を送らず 304 を返すため、
ブラウザ / プレビュー用プロキシが古い ES モジュールを使い続けた。

実行: python3 tests/check_cache.py
"""
import http.client
import json
import os
import socket
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBE = os.path.join(ROOT, 'js', '_cache_probe.js')


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def request(port, path, headers=None):
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    conn.request('GET', path, headers=headers or {})
    r = conn.getresponse()
    body = r.read()
    result = (r.status, dict(r.getheaders()), body)
    conn.close()
    return result


def check(cond, label):
    if not cond:
        raise AssertionError(label)
    print('  OK  ' + label)


def main():
    port = free_port()
    proc = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, 'serve.py'), str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    try:
        for _ in range(50):
            try:
                request(port, '/__build.json')
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError('serve.py が起動しません: ' + proc.stderr.read().decode())

        print('== 1. 全レスポンスが no-store で、304 を返さない ==')
        for path in ('/', '/index.html', '/js/main.js', '/js/ui.js', '/css/style.css',
                     '/assets/title_bg.jpg'):
            status, headers, _ = request(port, path)
            cc = headers.get('Cache-Control', '')
            check(status == 200 and 'no-store' in cc and 'max-age=0' in cc,
                  f'{path} -> {status} / {cc}')
        status, headers, body = request(port, '/', {
            'If-Modified-Since': 'Wed, 01 Jan 2020 00:00:00 GMT',
            'If-None-Match': '"anything"',
            'Cache-Control': 'no-cache',
        })
        check(status == 200 and b'__BUILD__' not in body,
              '条件付きリクエストでも 304 ではなく 200（古いHTMLを返さない）')

        print('== 2. 参照URLが内容ハッシュで一意化されている ==')
        status, _, html = request(port, '/')
        h = html.decode()
        check('css/style.css?h=' in h, 'HTML の CSS 参照に ?h= が付く')
        check('js/main.js?h=' in h, 'HTML のエントリJS参照に ?h= が付く')
        check("window.__OCF_BUILD__ = '" in h and '__BUILD__' not in h,
              'HTML のビルドIDが実値に置換されている')
        status, _, js = request(port, '/js/main.js?h=x')
        check("from './data.js?h=" in js.decode(),
              'JS の import 指定子にも ?h= が付く（モジュール単位でキャッシュ不可）')

        print('== 3. ソースが変わるとビルドIDと全URLが変わる ==')
        _, _, b1 = request(port, '/__build.json')
        build1 = json.loads(b1)['build']
        _, _, first = request(port, '/')
        with open(PROBE, 'w', encoding='utf-8') as f:
            f.write('// cache probe\n')
        try:
            _, _, b2 = request(port, '/__build.json')
            build2 = json.loads(b2)['build']
            check(build1 != build2, f'ビルドIDが変化 {build1} -> {build2}')
            _, _, second = request(port, '/')
            check(first != second, 'HTML の参照URLも変化（サーバー再起動不要）')
        finally:
            os.remove(PROBE)

        print('== 4. ドット絵変換UIが配信物に残っていない ==')
        _, _, ui = request(port, '/js/ui.js?h=x')
        t = ui.decode()
        check('ドットの細かさ' not in t and 'createGenerate' not in t,
              '旧・ドット絵変換設定UIが存在しない')
        check('あなたの画像を<b>そのまま</b>使います' in t,
              '新・元画像そのままエディタが配信されている')

        print('\nCACHE CHECK OK — キャッシュによる旧画面の残存を防止できています')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if os.path.exists(PROBE):
            os.remove(PROBE)


if __name__ == '__main__':
    main()
