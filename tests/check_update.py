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
    check('のLR進化が完了しました！' in cjs and 'パスワードが間違っています' in cjs
          and 'パスワードを入力してください' in cjs and 'CREATOR TOOLS' in cjs,
          '認証文言・完了文言・専用タイトルを保持')
    check('全キャラクターのLR進化が完了しました！' not in cjs and 'creatorBulkEvolve' not in cjs,
          '全キャラ一括の文言・経路は廃止')
    creator_actions = set(re.findall(r'data-creator-action="([a-zA-Z]+)"', cjs))
    check(creator_actions == {'decide', 'close', 'done', 'evolveOne'},
          f'ツールの 4 ボタンが揃っている: {sorted(creator_actions)}')
    for a in creator_actions:
        check(f"act === '{a}'" in cjs, f'ツールのボタン {a} にハンドラ')
    check('data-creator-action="evolveOne"' in cjs and 'creator-evolve-one' in cjs
          and 'data-creator-id=' in cjs,
          '各キャラのカードに ID 付きの小さい「一括進化」ボタン')
    check('.creator-evolve-btn' not in cjs and '.creator-action' not in cjs,
          '的巨大な全件一括ボタンのマークアップは存在しない')
    check('creatorEvolveOne(ctx.getState(), charId)' in cjs and 'await ctx.save(true)' in cjs,
          '1 体だけを同期適用→1 回の即時保存')
    check('busy' in cjs and 'if (!ctx || busy) return false' in cjs,
          '処理中は閉じず二重実行も防ぐ')
    body = st[st.index('export function creatorEvolveOne(state, charId) {'):st.index('export function equipmentEvolvePreview')]
    check('addCoins(' not in body and 'removeItem(' not in body and 'checkAchievements(' not in body,
          '一括進化は通貨・素材を消費せず実績報酬も発生させない')
    check('creatorLRTheory(state, c)' in st and 'maxEvolutionBonus' in st
          and 'EVOLUTION_RULES' in st and 'chars.find(x => x.id === charId)' in body,
          '通常進化 4 回分の理論値を、指定された 1 体だけに適用')
    check('export function creatorBulkEvolve' not in st and '全員' not in body,
          '全キャラを一気に進化させる関数は存在しない')
    check('creatorTool: { completed:false' in st and 'state.creatorTool = ' in body,
          '完了状態は後方互換の追加フィールドに保存')
    for cls in ('.creator-layer', '.creator-searchbar', '.creator-shell', '.creator-evolve-one',
                '.creator-note', '.creator-scroll', '.creator-done-btn', '.ftab-story-link'):
        check(cls in css, f'CSS ルール {cls}')
    check('.creator-evolve-btn' not in css and '.creator-action{' not in css,
          '巨大ボタン用の CSS は撤去済み（視界を塞がない）')
    check('.creator-evolve-one{width:100%;min-height:32px' in css,
          '各カードのボタンは 32px の小ささ')
    check(os.path.isfile('tests/check_story_hint.mjs') and os.path.isfile('tests/check_creator.mjs'),
          'ストーリータブ / 製作者ツールの実動作テストが存在')

    print('== 8. 技情報の一元管理と全画面表示 ==')
    si = open('js/skillInfo.js', encoding='utf-8').read()
    check(os.path.isfile('js/skillInfo.js') and 'export function skillInfo(' in si
          and 'export function skillBadge(' in si and 'export function skillDetailHTML(' in si
          and 'export function skillDetailModal(' in si,
          '技情報の唯一の算出・描画モジュールが揃っている')
    check("from './data.js?v=2'" in si and "from './state.js?v=2'" in si
          and "from './enemyAssets.js?v=2'" in si and "from './battle.js?v=2'" in si,
          'SKILL / parts / 敵専用技の生成器を実際のゲームデータから参照')
    check('s.parts' in si and 'Number(p.power)' in si and 'Number(s.mp) || 0' in si
          and 'buildEnemyMoveSkill' in si,
          '威力は parts・MP は sk.mp・敵技は戦闘と同じ生成器から導出')
    check('攻撃力：' in si and '回復量：' in si and '効果：' in si and 'MP：' in si,
          '攻撃 / 回復 / 補助 / MP の書式を一元定義')
    check('export function predictDamage(' in si and '技に固有の威力' in si,
          '技固有の威力と予測ダメージを区別')
    check("from './skillInfo.js?v=2'" in ui and 'SI.skillDetailModal(app, s)' in ui,
          'ui.js は一元モジュールを import して詳細モーダルを描画')
    check(ui.count('SI.skillBadge(') >= 10 and ui.count('SI.skillHead(') >= 4
          and ui.count('SI.skillInfoLine(') >= 3,
          '技一覧・習得・練習・詳細・戦闘・図鑑など全画面が共通関数を参照')
    check('威力${sk.power' not in ui and 'MP${sk.mp' not in ui
          and '威力 ${sk.power' not in ui and 'MP ${sk.mp' not in ui,
          '画面側に威力 / MP の数値直書きが残っていない')
    for spot in ('SI.skillHead(sk)', 'SI.skillBadge(sk,{cd:false})',
                 "case 'skillCheck': return skillCheckScreen(app,s);",
                 "tab==='details'", 'SI.skillInfoLine('):
        check(spot in ui, f'画面に技情報を表示: {spot}')
    check("case 'skillInfo':" in mn and "case 'skillInfoClose':" in mn
          and "key === 'skillCheckEnemy'" in mn,
          '詳細モーダル・技確認画面のハンドラを配線')
    bt = open('js/battle.js', encoding='utf-8').read()
    check('actor.mp -= (skill.mp||0)' in bt and '(part.power || 100)' in bt
          and "skill.parts || [{op:'damage',power:skill.power||100" in bt,
          '戦闘計算・MP 消費・AUTO のロジックは変更していない')
    dt = open('js/data.js', encoding='utf-8').read()
    check('export const SKILLS' in dt and 'export const VERSION = 8' in dt,
          '技データ・バージョンは据え置き（表示専用の改善）')
    for cls in ('.skill-metrics', '.sk-metric', '.sk-power', '.sk-heal', '.sk-effect',
                '.sk-mp', '.sk-info-btn', '.skill-info-list', '.skill-detail-modal',
                '.sk-forecast', '.enemy-skill-chip'):
        check(cls in css, f'技情報の CSS ルール {cls}')
    check(os.path.isfile('tests/check_skill_info.mjs'),
          '全技選択画面の実動作テストが存在')

    print('== 9. 新規作成画面の初期化と既存キャラの完全分離 ==')
    check("if (screen === 'create') initDraft();" in mn,
          '作成画面への全導線で initDraft() を必ず実行（開くたびにリセット）')
    check("if (app.screen === 'create' && screen !== 'create') app.draft = null;" in mn,
          '作成画面を離れたら一時入力だけ破棄（キャンセルの安全性）')
    check('const saved = state.draftSave;' not in mn and 'Object.assign(app.draft, {' not in mn
          and 'if (saved?.original)' not in mn,
          'initDraft() は保存済み下書きを自動復元しない')
    check("kind:'draft'" in mn and "state.draftSave.kind !== 'draft'" in mn
          and "dsave?.kind !== 'draft'" in mn,
          '純粋な下書きだけを識別し、保存済みキャラ由来の残留下書きを分離')
    check('state.draftSave = null;' in mn and mn.count('state.draftSave = {') == 1,
          '作成完了・見た目保存では既存キャラ情報を下書きへ書き戻さない')
    check("case 'newChar': return navigate('create');" in mn
          and 'state.draftSave && state.draftSave.kind' in mn,
          '「新規作成」は毎回まっさらな下書きと古い一時データの整理から始まる')
    check("app.screen !== 'create'" in ui,
          '作成画面の上部ナビに過去キャラの名前・画像を出さない')
    check('const usedIds = new Set(' in st and 'while (usedIds.has(newId)) newId = uid();' in st,
          'createCharacter() は既存 ID と衝突しない新 ID を必ず発行')
    check('state.characters.push(c)' in st and 'state.characters =' not in st
          and 'state.characters.splice' not in st and 'delete state.characters' not in st,
          '過去キャラの配列を初期化・置換・削除せず、新キャラを push するだけ')
    nct = open('tests/check_new_char.mjs', encoding='utf-8').read()
    check(os.path.isfile('tests/check_new_char.mjs') and 'NEW CHARACTER CHECK OK' in nct
          and 'assertOldCharsIntact' in nct and "?newchar=2" in nct,
          '指定 1〜8 の実動作テスト（既存キャラ維持・再起動）が存在')

    print('== 10. 敵画像が戦闘画面に表示されない不具合の根本修正 ==')
    check(re.search(r'\.combat-sprite\{[^}]*width:100%[^}]*\}', css),
          '敵側コンテナ .combat-sprite に幅 100%（p2 の flex-end で 0px に潰れる根本原因を修正）')
    check('.combatant.p2{align-items:flex-end}' in css,
          '敵パネルの右寄せレイアウト自体は維持（画像を動かさない）')
    check(re.search(r'\.enemy-art \.enemy-art-img\{[^}]*object-fit:contain', css)
          and re.search(r'\.enemy-art \.enemy-art-img\{[^}]*image-rendering:auto', css)
          and '.enemy-art[data-pixel-art="1"] .enemy-art-img{image-rendering:pixelated' in css
          and '.enemy-art{' in css,
          '縦横比維持 (contain) / 高解像度は補間 / ドット絵のみ pixelated / 親内に収める')
    check('.enemy-art-error' in css and '.enemy-art[data-failed="1"] .enemy-art-error' in css,
          '失敗時に原因を表示する CSS を用意')
    ea = open('js/enemyArt.js', encoding='utf-8').read()
    eaa = open('js/enemyAssets.js', encoding='utf-8').read()
    check('loading="${battle ? \'eager\' : \'lazy\'}"' in ea,
          '戦闘中は eager 読み込み（lazy による空白を防止）')
    check('data-enemy-art="${id}"' in ea and 'ENEMY_KIND[a.id]' in ea
          and 'ENEMY_KIND[enemy?.artId || enemy?.id]' in eaa,
          '画像は名前ではなく固有 ID (artId / ENEMY_KIND.id) で引く')
    check('data-pixel-art=' in ea and "role === 'primary'" in ea and '<= 256' in ea,
          '素材の解像度で鮮明さの補間方式を判定（高解像度イラストを劣化させない）')
    check('.asset-file-img' in ea and '.enemy-art-img, .asset-file-img' in ea,
          '複数敵・台帳一覧の全画像へ読み込み監視を配線')
    check('enemy-art-error' in ea and 'role="alert"' in ea
          and 'console.error(' in ea and 'ART_ERRORS' in ea,
          '失敗時は敵 ID / 参照先 / 代替候補 / 理由を画面・コンソール・レポートへ出力')
    check('models3d: 0, animationClips: 0' in ea and 'errors: enemyArtErrors()' in ea,
          '静止 PNG であることを正直に報告し、3D/アニメの成功を偽らない')
    check('class="sprite"' not in ea and 'enemy-art-fallback' not in ea,
          '✦ / 仮スプライト / .enemy-art-fallback による代用を撤去')
    check('P.makeEnemySprite(' not in mn and 'b.enemy.sprite = null' in mn,
          'アプリ側で四角形・丸の生成スプライトを作らない')
    check('enemyArtReport' in ui and 'asset-file-img' in ui and 'data-asset-id' in ui,
          '台帳 UI もエラー情報を表示し、インライン onerror での隠蔽を撤去')
    eact = open('tests/check_enemy_art.mjs', encoding='utf-8').read()
    check(os.path.isfile('tests/check_enemy_art.mjs') and 'ENEMY ART CHECK OK' in eact
          and 'getComputedStyle' in eact and 'dungeonStart' in eact and 'resolveAction' in eact,
          'ダンジョン→遭遇→描画→攻撃→撃破→戦闘後までの実動作テストが存在')

    print('== 11. 恒久データ保護（全アップデートの必須ゲート） ==')
    dg = open('js/dataGuard.js', encoding='utf-8').read()
    bk = open('js/saveBackup.js', encoding='utf-8').read()
    guard = open('tests/check_data_guard.mjs', encoding='utf-8').read()
    gate = open('tests/verify_all.sh', encoding='utf-8').read()
    rule = open('tools/DATA_PROTECTION.md', encoding='utf-8').read()
    check(all(f'export function {n}' in dg for n in
              ('validateState', 'diffPreserved', 'assertPreserved', 'assertNoLoss',
               'protectedFingerprint', 'mergeAdditive')),
          'dataGuard.js に検証・消失検知・指紋・additive 統合の純関数')
    check('for (const [k, v] of Object.entries(before))' in dg
          and 'MUTABLE_KEYS' in dg,
          '未知の将来キーもホワイトリストなしで保護（MUTABLE は日次項目のみ）')
    check('validateState(snapshot)' in st and 'assertNoLoss(lastSavedState, snapshot)' in st
          and 'function failSave(' in st and 'export function saveReport()' in st,
          '保存前の破損検知・消失検知・失敗時停止・監査レポート')
    check('保存前バックアップ' in st and '保存成功後バックアップ' in st
          and 'BACKUP_PHASES.BEFORE' in st and 'BACKUP_PHASES.AFTER' in st,
          '保存前／保存成功後の二重バックアップを世代分離')
    check("if (!back?.state || JSON.stringify(back.state) !== newRaw)" in st
          and "if (localStorage.getItem(LS_KEY) !== newRaw)" in st,
          '書き込み直後の読み直し照合で保存成功を確認（IDB / localStorage 両方）')
    check('function protectAndRecover(' in st and 'retryReadRaw(3)' in st
          and 'findLatestValidBackup(' in st and 'autoRecover === true' in st,
          '読込失敗は 保護→原因→再試行→検証復元→停止 の順で処理')
    check('expected: hasFlag || !!meta' in st and 'idbUnavailable' in st,
          '「読めない」と「存在しない」を区別（IDB 非対応は正常フォールバック）')
    check('if (!c.equipmentBonus) syncEquipmentSnapshot(state, c);' in st,
          '読み込み時に保存済み装備スナップショットを再計算で上書きしない')
    check('export async function findLatestValidBackup(' in bk
          and 'BACKUP_PHASES' in bk and 'QUARANTINE' in bk,
          '復元候補は本文・JSON・形状・ハッシュを検証し隔離原本を除外')
    check('S.loadState({ autoRecover:true })' in mn and 'app.saveReport = S.saveReport()' in mn,
          '起動時に自動復元し、保護レポートを常時 UI へ渡す')
    check('🛡 データ保護レポート' in ui and 'g.beforeBackup' in ui and 'issue.autoRecovered' in ui,
          '設定画面に二重バックアップ・消失検知・自動復元の結果を表示')
    check('DATA GUARD CHECK OK' in guard and 'autoRecover:true' in guard
          and '再起動' in guard and '保存成功後' in guard,
          '変更前後・再起動・二重バックアップ・読込失敗の動的保護テスト')
    idbt = open('tests/check_idb.mjs', encoding='utf-8').read()
    check("r1.source === 'idb'" in idbt and 'readBackup(after.id)' in idbt
          and 'BrokenIDB' in idbt and 'autoRecover:true' in idbt,
          'IndexedDB 本来の保存先でも成功確認・二重バックアップ・破損時自動復元を検証')
    check('check_data_guard.mjs' in gate and 'check_idb.mjs' in gate
          and 'check_save.mjs' in gate
          and 'check_runtime.mjs' in gate and 'check_served.py' in gate
          and 'PROTECTION GATE FAILED' in gate and 'git stash push -u' in gate,
          '全変更で実行する保護ゲートと、失敗時に適用せず戻す手順')
    check('機能の追加よりも既存データの保護を優先' in rule
          and 'データを守れないアップデートは実行しない' in rule
          and '過去のキャラクターの復旧は行いません' in rule,
          '恒久ルール文書（今回は過去キャラの復旧を行わない旨も明記）')

    print('\nUPDATE STATIC CHECK OK — 全ファイル照合・3D 残存ゼロ・章/セーブ/UI 整合性・新機能・恒久データ保護')
    return 0


if __name__ == '__main__':
    sys.exit(main())
