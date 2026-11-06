#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""大型アップデートの静的検証。

- Google Drive「敵キャラ」の全原本を 1 件ずつハッシュ照合
- 配信する代表 PNG 36 枚が原本とバイト単位で一致すること
- 3D / アニメーション / 外部アセットの残存が 0 件であること
- 章データ・敵登録・セーブ分離・UI アクションの整合性
実行: python3 tests/check_update.py
"""
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def check(cond, label):
    if not cond:
        raise AssertionError(label)
    print('  OK  ' + label)


def node(script):
    return subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=ROOT).decode('utf-8').strip()


def main():
    print('== 1. 全 180 ファイルの原本照合 ==')
    staged = json.load(open('tools/stage_all.json', encoding='utf-8'))
    check(len(staged) == 180, f'ステージ済み原本 180 件（実際 {len(staged)}）')
    bad = []
    for r in staged:
        path = r['file']
        if not os.path.isfile(path):
            bad.append('missing ' + path)
            continue
        data = open(path, 'rb').read()
        if len(data) != r['size'] or hashlib.sha256(data).hexdigest() != r['sha256']:
            bad.append('hash ' + path)
        if path.endswith('.png') and data[:8] != b'\x89PNG\r\n\x1a\n':
            bad.append('header ' + path)
    check(not bad, f'180 件すべてバイト・PNG ヘッダ一致（不一致 {len(bad)}）: {bad[:3]}')

    print('== 2. 配信用代表 PNG が原本と完全に同一 ==')
    kinds = json.loads(node(
        "import {ENEMY_KIND} from './js/enemyAssets.js';"
        "console.log(JSON.stringify(Object.values(ENEMY_KIND).map(k=>({id:k.id,art:k.art,bundled:k.bundled}))))"))
    check(len(kinds) == 36, f'敵 36 種類（実際 {len(kinds)}）')
    mismatch = []
    for k in kinds:
        b, a = k['bundled'], k['art']
        if not os.path.isfile(b) or not os.path.isfile(a):
            mismatch.append('missing ' + k['id'])
            continue
        if open(b, 'rb').read() != open(a, 'rb').read():
            mismatch.append('bytes ' + k['id'])
    check(not mismatch, f'36 枚が原本のバイト列と完全一致（不一致 {len(mismatch)}）: {mismatch[:3]}')

    print('== 3. 台帳と敵の対応 ==')
    audit = json.loads(node(
        "import {ASSET_FILES,ENEMY_KIND,UNREADABLE_FILES,ENEMY_KINDS,DUNGEON_PLAN} from './js/enemyAssets.js';"
        "console.log(JSON.stringify({files:ASSET_FILES.length,readable:ASSET_FILES.filter(f=>f.readable).length,"
        "mapped:ASSET_FILES.filter(f=>ENEMY_KIND[f.enemyId]).length,unreadable:UNREADABLE_FILES.length,"
        "kinds:ENEMY_KINDS.length,plan:DUNGEON_PLAN.length,"
        "noArtKinds:ENEMY_KINDS.filter(k=>!k.art||!k.bundled).length}))"))
    check(audit['files'] == 180 and audit['readable'] == 180 and audit['mapped'] == 180,
          f'全 180 ファイルが読込可能かついずれかの敵へ割り当て済み: {audit}')
    check(audit['unreadable'] == 0, '読み込み失敗ファイル 0 件')
    check(audit['kinds'] == 36 and audit['noArtKinds'] == 0 and audit['plan'] == 30,
          f'36 敵すべてに代表画像 / 30 階分の出現計画: {audit}')

    print('== 4. 外部 3D / アニメーション資産の残存ゼロ ==')
    text_ext = ('.js', '.css', '.html', '.md', '.py', '.mjs', '.json', '.cjs')
    # 文字列を分割して組む（この検証ファイル自身が検査対象に当たらないようにする）
    j = lambda *p: ''.join(p)
    forbidden = (j('enemy', '3d.js'), j('enemy', '3dHost'), j('enemy', 'ModelKey'),
                 j('model', '3d'), j('three', '.module.js'), j('GLTF', 'Loader'),
                 j('enemy', '-3d'), j('E3.', 'initEnemy3D'), j('play', 'Enemy3D'),
                 j('sync', 'Enemy3D'))
    hits = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # 検証スクリプト自身は禁止文字列を「探す側」なので検査対象外にする
        dirnames[:] = [d for d in dirnames if d not in ('.git', '__pycache__', 'node_modules', '.cache', 'tests')]
        for name in filenames:
            if not name.endswith(text_ext):
                continue
            path = os.path.join(dirpath, name)
            try:
                t = open(path, encoding='utf-8').read()
            except (OSError, UnicodeDecodeError):
                continue
            for f in forbidden:
                if f in t:
                    hits.append(f'{os.path.relpath(path, ROOT)}:{f}')
    check(not hits, f'3D 参照の残存 0 件: {hits[:5]}')
    binaries = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d != '.git']
        for name in filenames:
            if name.lower().endswith(('.glb', '.gltf', '.fbx', '.dae', '.mp4', '.webm')):
                binaries.append(os.path.relpath(os.path.join(dirpath, name), ROOT))
    check(not binaries, f'3D モデル / 動画ファイル 0 件: {binaries[:5]}')
    check('assets/enemies/source/' in open('.gitignore', encoding='utf-8').read(),
          '224MB の原本は .gitignore でリポジトリ除外')

    print('== 5. アプリの登録・章・セーブ分離 ==')
    app = json.loads(node(
        "import * as D from './js/data.js';import * as T from './js/story.js';"
        "console.log(JSON.stringify({version:D.VERSION,enemies:D.ENEMIES.length,"
        "model3d:D.ENEMIES.filter(e=>e.model3d).length,noArt:D.ENEMIES.filter(e=>!e.artId).length,"
        "chapters:T.STORY_CHAPTERS.length,ranks:T.STORY_CHAPTERS.map(c=>c.rank).join(','),"
        "integrity:T.storyIntegrity()}))"))
    check(app['version'] == 8, 'VERSION = 8')
    check(app['enemies'] == 67 and app['model3d'] == 0 and app['noArt'] == 0,
          f'CPU 67 体（既存 31 + Drive 36）すべてに Drive 画像: {app["enemies"]}/{app["model3d"]}/{app["noArt"]}')
    check(app['chapters'] == 5 and app['ranks'] == 'R,SR,SSR,UR,LR',
          f'5 章 / R,SR,SSR,UR,LR: {app["ranks"]}')
    it = app['integrity']
    check(all([it['objectivesUnique'], it['endingsUnique'], it['exactPerChapter'],
               it['rewardCoversFullEvolution']]) and len(set(it['structures'].split(','))) == 5,
          '章の目的・展開・結末がすべて異なり、報酬が必要数と完全一致')

    st = open('js/state.js', encoding='utf-8').read()
    body = st[st.index('export function updateExistingSave(s) {'):st.index('export function storyIntegrityReport')]
    check('newState(' not in body and 'fillMissing' in body,
          '既存プレイヤー更新は newState() を呼ばず不足キーだけ補完')
    check('export function newState() { return defaultSaveFields(); }' in st,
          '新規ゲーム初期化は newState() に分離')
    check('saveGuard' in st and 'quarantineRaw' in st and 'アップデート前の自動バックアップ' in st,
          '破損セーブ隔離・上書き停止・更新前バックアップが実装済み')
    check("storyIntegrity" in st and 'claimStoryReward' in st and 'arc.claimed.includes' in st,
          '章クリア / 報酬受取の保存と二重防止が実装済み')

    print('== 6. UI アクションと CSS ==')
    ui = open('js/ui.js', encoding='utf-8').read()
    mn = open('js/main.js', encoding='utf-8').read()
    actions = set(re.findall(r'data-action="([A-Za-z0-9_]+)"', ui))
    cases = set(re.findall(r"case '([A-Za-z0-9_]+)':", mn))
    check(not (actions - cases), f'全 {len(actions)} アクションにハンドラあり（欠落 {sorted(actions - cases)}）')
    for name in ('backupCreate', 'backupRestore', 'backupExport', 'storyOpen', 'storyNext',
                 'storyStage', 'storyClaim', 'assetEnemy', 'assetPage', 'enemyVariant'):
        check(f"case '{name}'" in mn, f'新アクション {name} のハンドラ')
    css = open('css/style.css', encoding='utf-8').read()
    check(css.count('{') == css.count('}'), f'CSS 波括弧 {css.count("{")}/{css.count("}")}')
    for cls in ('.enemy-art', '.enemy-art-img', '.enemy-move-fx', '.story-chapter',
                '.stage-card', '.backup-row', '.asset-file', '.band-row'):
        check(cls in css, f'CSS ルール {cls}')
    check('@media (max-width:640px)' in css and 'prefers-reduced-motion' in css,
          'スマホ幅・動きを減らす設定への配慮')

    print('== 7. ストーリータブ・ヒント・製作者ツール ==')
    dt = open('js/data.js', encoding='utf-8').read()
    check('育成素材を得たいならストーリーを進めよう' in dt and "id:'storyMaterials'" in dt,
          'ヒントに「育成素材を得たいならストーリーを進めよう」を追加')
    check('CPU対戦・ダンジョン・ストーリー・戦績' in dt, 'ギルドの説明にもストーリーを明記')
    check('ftab-story-link' in ui and 'data-to="story"' in ui,
          'ダンジョンの隣にストーリー専用の小タブを追加')
    check("f.tabs.map((t,i)=>" in ui and 'tabButtons.splice(2, 0' in ui,
          '既存タブの data-i 添字をずらさない挿入方法')
    mn = open('js/main.js', encoding='utf-8').read()
    check('initCreatorTools(' in mn and 'toggleCreator()' in mn and "ev.key.toLowerCase() !== 'c'" in mn,
          'C キー入力と製作者ツールの初期化を main.js に配線')
    check("CREATOR: { toggle:" in mn and 'syncCreatorTools()' in mn,
          'CREATOR API と一覧自動同期を公開')
    cjs = open('js/creatorTools.js', encoding='utf-8').read()
    check("const PASSWORD = 'kiyo'" in cjs and 'value !== PASSWORD' in cjs,
          'パスワードは半角小文字 kiyo との完全一致のみ')
    check('全キャラクターのLR進化が完了しました！' in cjs and 'パスワードが間違っています' in cjs
          and 'パスワードを入力してください' in cjs and 'CREATOR TOOLS' in cjs,
          '認証文言・完了文言・専用タイトルを保持')
    creator_actions = set(re.findall(r'data-creator-action="([a-zA-Z]+)"', cjs))
    check(creator_actions == {'decide', 'close', 'done', 'evolve'},
          f'ツールの 4 ボタンが揃っている: {sorted(creator_actions)}')
    for a in creator_actions:
        check(f"act === '{a}'" in cjs, f'ツールのボタン {a} にハンドラ')
    check('creatorBulkEvolve(ctx.getState())' in cjs and 'await ctx.save(true)' in cjs,
          '一括進化は同期適用→1 回の即時保存')
    check('busy' in cjs and 'if (!ctx || busy) return false' in cjs,
          '処理中は閉じず二重実行も防ぐ')
    body = st[st.index('export function creatorBulkEvolve(state) {'):st.index('export function equipmentEvolvePreview')]
    check('addCoins(' not in body and 'removeItem(' not in body and 'checkAchievements(' not in body,
          '一括進化は通貨・素材を消費せず実績報酬も発生させない')
    check('creatorLRTheory(state, c)' in body and 'maxEvolutionBonus' in body
          and 'EVOLUTION_RULES' in body,
          '通常進化 4 回分の理論値を不足分だけ適用')
    check('creatorTool: { completed:false' in st and 'state.creatorTool = ' in body,
          '完了状態は後方互換の追加フィールドに保存')
    for cls in ('.creator-layer', '.creator-searchbar', '.creator-shell', '.creator-evolve-btn',
                '.creator-scroll', '.creator-done-btn', '.ftab-story-link'):
        check(cls in css, f'CSS ルール {cls}')
    check(os.path.isfile('tests/check_story_hint.mjs') and os.path.isfile('tests/check_creator.mjs'),
          'ストーリータブ / 製作者ツールの実動作テストが存在')

    print('\nUPDATE STATIC CHECK OK — 全ファイル照合・3D 残存ゼロ・章/セーブ/UI 整合性・新機能')
    return 0


if __name__ == '__main__':
    sys.exit(main())
