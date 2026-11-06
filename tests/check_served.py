#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""配信物の HTTP 検証（no-store / 内容ハッシュ / 画像 200 / 3D 残存ゼロ）。
実行: python3 tests/check_served.py
"""
import hashlib
import http.client
import json
import os
import socket
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def request(port, path, headers=None, method='GET'):
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
    conn.request(method, path, headers=headers or {})
    r = conn.getresponse()
    body = r.read()
    out = (r.status, dict(r.getheaders()), body)
    conn.close()
    return out


def check(cond, label):
    if not cond:
        raise AssertionError(label)
    print('  OK  ' + label)


def main():
    port = free_port()
    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, 'serve.py'), str(port)],
                            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for _ in range(60):
            try:
                request(port, '/__build.json')
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError('serve.py が起動しません')

        print('== 1. no-store と内容ハッシュ ==')
        for path in ('/', '/index.html', '/js/main.js', '/js/state.js', '/js/ui.js',
                     '/js/enemyAssets.js', '/js/enemyArt.js', '/js/story.js',
                     '/js/saveBackup.js', '/js/dataGuard.js', '/js/creatorTools.js',
                     '/js/skillInfo.js', '/css/style.css'):
            status, h, _ = request(port, path)
            cc = h.get('Cache-Control', '')
            check(status == 200 and 'no-store' in cc and 'max-age=0' in cc,
                  f'{path} -> {status} / {cc}')
        status, _, body = request(port, '/', {
            'If-Modified-Since': 'Wed, 01 Jan 2020 00:00:00 GMT',
            'If-None-Match': '"anything"', 'Cache-Control': 'no-cache',
        })
        check(status == 200 and b'__BUILD__' not in body,
              '条件付きリクエストでも 304 ではなく最新の 200')
        _, _, bjson = request(port, '/__build.json')
        build = json.loads(bjson)['build']
        _, _, html = request(port, '/')
        h = html.decode('utf-8')
        check(f"window.__OCF_BUILD__ = '{build}'" in h, f'タイトルのビルドIDが一致 {build}')
        check('css/style.css?h=' in h and 'js/main.js?h=' in h, 'HTML 参照に内容ハッシュ')
        _, _, js = request(port, '/js/main.js?h=x')
        t = js.decode('utf-8')
        check("from './data.js?h=" in t and "from './enemyArt.js?h=" in t
              and "from './story.js?h=" in t and "from './creatorTools.js?h=" in t,
              'ES Module の import も内容ハッシュ付き（製作者ツールを含む）')

        print('== 2. 更新内容が配信されている ==')
        check('updateExistingSave' not in t and 'enemyArtHost' not in t, 'main.js は UI 生成を持たない（責務分離）')
        check('EA.syncEnemyArt' in t and 'storyClaim' in t and 'backupRestore' in t,
              '2D 敵表示・5章・バックアップのハンドラが配信される')
        _, _, state_js = request(port, '/js/state.js?h=x')
        st = state_js.decode('utf-8')
        check('export function updateExistingSave' in st and 'アップデート前の自動バックアップ' in st,
              '既存更新と更新前バックアップが配信される')
        check("from './dataGuard.js?h=" in st and 'validateState(snapshot)' in st
              and '保存前バックアップ' in st and '保存成功後バックアップ' in st
              and 'protectAndRecover' in st and 'autoRecover === true' in st,
              '保護レイヤー・二重バックアップ・読込失敗時の復元チェーンが配信される')
        _, _, dg_js = request(port, '/js/dataGuard.js?h=x')
        dgt = dg_js.decode('utf-8')
        check('export function validateState' in dgt and 'export function assertPreserved' in dgt
              and 'export function mergeAdditive' in dgt and 'MUTABLE_KEYS' in dgt,
              'dataGuard.js 本体が最新ビルドで配信される（将来キーも保護）')
        _, _, ui_js = request(port, '/js/ui.js?h=x')
        ui = ui_js.decode('utf-8')
        check('全 5 章' in ui and 'backup-list' in ui and 'asset-kind' in ui,
              '5章 / バックアップ / 敵素材台帳の UI が配信される')
        check("from './skillInfo.js?h=" in ui and 'SI.skillBadge(' in ui
              and "case 'skillCheck':" in ui,
              '技情報の一元モジュールと全画面表示が配信される')
        _, _, ski_js = request(port, '/js/skillInfo.js?h=x')
        skj = ski_js.decode('utf-8')
        check('export function skillInfo(' in skj and '攻撃力：' in skj
              and "from './battle.js?h=" in skj and 'MP：' in skj,
              '技情報モジュールは実データ (parts / mp / 敵技生成器) を参照')
        for forbidden in ('enemy3d.js', 'enemyModelKey', 'model3d', 'enemy-3d'):
            check(forbidden not in t and forbidden not in ui and forbidden not in st,
                  f'配信 JS に 3D 残存なし: {forbidden}')
        _, _, css = request(port, '/css/style.css?h=x')
        cs = css.decode('utf-8')
        check('.enemy-art' in cs and '.enemy-move-fx' in cs and '.story-chapter' in cs,
              '2D 表示・専用技・ストーリーの CSS が配信される')
        check('.creator-layer' in cs and '.creator-searchbar' in cs
              and '.creator-evolve-one' in cs and '.creator-note' in cs
              and '.creator-evolve-btn' not in cs and '.ftab-story-link' in cs,
              '製作者ツール（小さいボタン） / ストーリータブの CSS が配信される')
        check('.skill-metrics' in cs and '.sk-power' in cs and '.sk-mp' in cs
              and '.skill-detail-modal' in cs and '@media (max-width:640px)' in cs,
              '技バッジ・詳細・スマホ幅の CSS が配信される')
        _, _, creator_js = request(port, '/js/creatorTools.js?h=x')
        cj = creator_js.decode('utf-8')
        check('creatorEvolveOne' in cj and "const PASSWORD = 'kiyo'" in cj
              and 'のLR進化が完了しました！' in cj
              and 'data-creator-action="evolveOne"' in cj
              and '全キャラクターのLR進化が完了しました！' not in cj,
              '製作者ツール本体（認証・キャラ 1 体ずつの一括進化・全員一括なし）が配信される')
        check("from './state.js?h=" in cj and "from './ui.js?h=" in cj,
              '製作者ツールの import も内容ハッシュ付き')
        _, _, data_js = request(port, '/js/data.js?h=x')
        check('育成素材を得たいならストーリーを進めよう' in data_js.decode('utf-8'),
              '新しいヒントが配信される')
        check("if (screen === 'create') initDraft();" in t and "kind:'draft'" in t
              and 'state.draftSave = null;' in t and 'const saved = state.draftSave;' not in t,
              '新規作成画面の毎回初期化・下書き自動復元の撤廃・完全分離が配信される')
        check('const usedIds = new Set(' in st and 'state.characters.push(c)' in st,
              '新しい ID 発行と「追加のみ」の保存処理が配信される')
        check("app.screen !== 'create'" in ui,
              '作成画面に過去キャラの名前・画像を出さない UI が配信される')
        _, _, ea_js = request(port, '/js/enemyArt.js?h=x')
        eaj = ea_js.decode('utf-8')
        check('enemy-art-error' in eaj and 'loading="${battle ? \'eager\' : \'lazy\'}"' in eaj
              and '.asset-file-img' in eaj and 'ART_ERRORS' in eaj
              and 'enemy-art-fallback' not in eaj and 'class="sprite"' not in eaj,
              '敵画像の即時読み込み・エラー表示・代用禁止が配信される')
        check('.combat-sprite{display:flex;justify-content:center;align-items:flex-end;height:210px;width:100%' in cs
              and 'image-rendering:auto' in cs and 'data-pixel-art="1"' in cs and '.enemy-art-error' in cs,
              '幅 0px の根本修正・解像度別の鮮明化・エラー UI の CSS が配信される')
        check('data-pixel-art=' in eaj, '解像度判定が enemyArt.js に配信される')
        check('P.makeEnemySprite(' not in t and 'b.enemy.sprite = null' in t
              and 'enemyArtReport' in ui and 'asset-file-img' in ui,
              '生成スプライトでの代用を止め、台帳 UI のエラー表示も配信される')

        print('== 3. 敵 PNG の配信 ==')
        pngs = sorted(f for f in os.listdir(os.path.join(ROOT, 'assets', 'enemies')) if f.endswith('.png'))
        check(len(pngs) == 36, f'代表 PNG 36 枚（実際 {len(pngs)}）')
        for i, name in enumerate(pngs):
            path = '/assets/enemies/' + name
            status, h, body = request(port, path)
            disk = open(os.path.join(ROOT, 'assets', 'enemies', name), 'rb').read()
            ok = (status == 200 and body == disk and hashlib.sha256(body).hexdigest() == hashlib.sha256(disk).hexdigest()
                  and 'no-store' in h.get('Cache-Control', ''))
            if not ok:
                raise AssertionError(f'画像配信失敗 {path}: {status} / {len(body)} bytes')
        check(True, f'36 枚すべて 200 / 元バイト一致 / no-store（{sum(os.path.getsize(os.path.join(ROOT,"assets","enemies",n)) for n in pngs)//1024} KiB）')
        # 原本フォルダ（ローカル専用）もno-storeで配信できることを確認
        src = sorted(f for f in os.listdir(os.path.join(ROOT, 'assets', 'enemies', 'source')) if f.endswith('.png'))[0]
        status, _, body = request(port, '/assets/enemies/source/' + src)
        check(status == 200 and body[:8] == b'\x89PNG\r\n\x1a\n', 'Drive 原本 PNG も配信可能（ローカル）')

        print('== 3b. Google Drive 原本 180 ファイルが実際に HTTP 配信される ==')
        manifest = json.loads(subprocess.check_output(
            ['node', '--input-type=module', '-e',
             "import {ASSET_FILES} from './js/enemyAssets.js';"
             "console.log(JSON.stringify(ASSET_FILES.map(r=>({src:r.src,bytes:r.bytes,readable:r.readable}))))"],
            cwd=ROOT).decode('utf-8'))
        check(len(manifest) == 180, f'台帳 180 件（実際 {len(manifest)}）')
        bad = []
        for r in manifest:
            if not r['readable']:
                continue
            status, h, _ = request(port, '/' + r['src'], method='HEAD')
            if status != 200 or int(h.get('Content-Length', '0') or 0) != r['bytes']:
                bad.append((r['src'], status, h.get('Content-Length')))
            if 'no-store' not in h.get('Cache-Control', ''):
                bad.append((r['src'], 'cache', h.get('Cache-Control')))
        check(not bad,
              f'原本 180 ファイルすべて 200 / バイト数一致 / no-store（不一致 {len(bad)}）: {bad[:3]}')

        print('== 4. 削除済み 3D 資産は 404 ==')
        for path in ('/assets/models/enemies/ASSETS.md', '/assets/models/enemies/big_demon.glb',
                     '/js/enemy3d.js', '/js/three.module.js'):
            status, _, _ = request(port, path)
            check(status == 404, f'{path} -> {status}')

        print('\nSERVED CHECK OK — 最新ビルド・no-store・画像配信・3D 削除を確認')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == '__main__':
    main()
