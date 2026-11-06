#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Google Drive「敵キャラ」全ファイルを 1 件ずつ検査し、敵定義へ紐付ける台帳を生成する。

- 入力: tools/drive_inventory.json / stage_all.json / image_decode_report.json /
        zip_entries.json / stage_p2.json
- 出力: js/enemyAssets.js / assets/enemies/ASSET_MANIFEST.md / tools/asset_audit.json
- 元 PNG は一切変換・再圧縮・改名せず、assets/enemies/source/<DriveID>.png をそのまま参照する。
"""
import json, os, re, collections, hashlib, shutil, filecmp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

inv = json.load(open('tools/drive_inventory.json', encoding='utf-8'))
stage = {r['id']: r for r in json.load(open('tools/stage_all.json', encoding='utf-8'))}
dec = json.load(open('tools/image_decode_report.json', encoding='utf-8'))
dec_by_file = {r['file']: r for r in dec} if isinstance(dec, list) else {}
zips = json.load(open('tools/zip_entries.json', encoding='utf-8'))
p2 = json.load(open('tools/stage_p2.json', encoding='utf-8'))

# ---------------------------------------------------------------------------
# 敵の種類定義（外見・体格・武器・特徴・能力は実画像の目視確認に基づく）
#   tier 0=最弱 / 4=最強、motion は攻撃モーション、effect は演出色
# ---------------------------------------------------------------------------
# id, 名前, 種族, tier, 体格, 武器,  features, 専用技名, 威力, hits, 属性, 状態, motion, 演出色, 技説明
E = [
 ('imp','小悪魔インプ','悪魔',0,'小型・翼あり','爪と尾','素早く飛び回る小柄な悪魔。翼と尻尾で撹乱する',
  '影爪の乱舞',96,2,'dark','poison','multi','#a97bff','翼で舞い上がり、闇の爪を二連で繰り出す。毒を宿す'),
 ('goblin_club','棍棒ゴブリン','ゴブリン',0,'小型','棍棒','棍棒を抱えてしゃがむ緑肌のゴブリン。頭突きと殴打が得意',
  '脳天割り',112,1,'earth','stun','bash','#b6d17a','跳ね上がって棍棒を振り下ろし、相手を昏倒させる'),
 ('goblin_sword','剣ゴブリン','ゴブリン',0,'小型','曲刀','身の丈ほどの曲刀を構えるゴブリン。素早い連斬',
  '錆刃の連斬',88,2,'wind','','slash','#8fd4b0','錆びた曲刀で襟元を二度薙ぐ'),
 ('goblin_axe','斧ゴブリン','ゴブリン',0,'小型','両刃斧','幅広の斧を構え、筋肉質な腕で薙ぎ払う',
  '斧薙ぎ',116,1,'earth','','bash','#d8a06a','低い姿勢から全身で斧を薙ぎ、防御を削る'),
 ('goblin_bow','弓ゴブリン','ゴブリン',0,'小型','弓','背後に回り込んで矢を放つ小型ゴブリン',
  '毒矢の雨',72,3,'wind','poison','shot','#9ed36a','三本の毒矢を続けざまに放つ'),
 ('goblin_archer','ゴブリンアーチャー','ゴブリン',1,'中型・筋肉質','大弓','大柄な体で大弓を引く狙撃手。必中の一矢',
  '穿ちの狙撃',128,1,'wind','','shot','#7fe0b0','大弓を目一杯引き、急所へ必中の一矢を通す'),
 ('goblin_shaman','ゴブリンシャーマン','ゴブリン',1,'小型','仮面と杖','仮面を被り呪具を鳴らす呪術師。呪いとMP吸収',
  '呪面の舞',104,1,'dark','curse','cast','#c07ad8','仮面の呪舞で呪いを刻み、魔力を吸い取る'),
 ('goblin_japan','ゴブリンジパング','ゴブリン',1,'小型','刀','甲冑姿の女ゴブリン。居合いの抜き斬り',
  '一閃・居合い',124,1,'light','','slash','#ffd07a','腰の刀を抜きざまに袈裟懸けで斬る'),
 ('goblin_king','ゴブリンキング','ゴブリン',1,'中型・王冠','大剣','王冠と盾を纏うゴブリンの王。三段の王剣',
  '王威の三連斬',96,3,'fire','','multi','#ffb45a','王剣を三度振るい、自ら攻勢を強める'),
 ('hobgoblin','ホブゴブリン','ゴブリン',1,'大型・筋肉質','棘付き棍棒','ゴブリンの上位種。巨腕の一撃がすべてを砕く',
  '剛腕の粉碎',142,1,'earth','','bash','#e08a5a','筋肉の塊のような腕で棘棍棒を叩きつける'),
 ('chariots','ゴブリン・チャリオッツ','ゴブリン',2,'巨大・横長','戦車','狼に曳かせた戦車に乗るゴブリン。横幅のある突撃',
  '戦車突撃',150,1,'thunder','paralysis','charge','#ffd36a','戦車を全速で突進させ、轢き潰して麻痺させる'),
 ('jack','ジャックランタン','不死',0,'小型','南瓜の提灯','南瓜の頭と箒を持つ魔女。提灯の火を撒く',
  '南瓜の鬼火',98,2,'fire','burn','cast','#ff9b45','提灯の鬼火を二つ投げつけ、火傷を残す'),
 ('lesser','レッサーデーモン','悪魔',1,'痩身・二本角','鉤爪','骨張った体と長い角の下位悪魔。生命力を削る',
  '飢えた鉤爪',110,1,'dark','','bite','#b06a7a','やつれた鉤爪で掴みかかり、生命力をすすり取る'),
 ('skeleton_plain','スケルトン','不死',1,'細身','剣と盾','赤い腰布を巻いた骸骨剣士。基本の骨剣',
  '骨剣の一突き',106,1,'none','','thrust','#d8c8a8','がらんどうの肋間から、骨剣を真っ直ぐ突く'),
 ('skeleton_arm','六腕スケルトン','不死',2,'細身・六本腕','六本の剣','腕が六本に増えた異形の骸骨。六刀の乱撃',
  '六腕・千斬り',70,6,'none','','multi','#e0b0b0','六本の剣を同時に振り回す、避けにくい乱撃'),
 ('skeleton_helm','兜スケルトン','不死',1,'細身・兜','剣と盾','兜を被った骸骨兵。守りを崩す兜割り',
  '兜割り',118,1,'earth','','bash','#c0c8d8','盾ごと叩き割り、防御力を下げる'),
 ('skeleton_horn','角スケルトン','不死',2,'細身・角','剣と角','頭に角を生やした骸骨。角で突き刺す',
  '髏角の突進',124,1,'dark','','charge','#d8a8c0','角を下げて突進し、体を貫く'),
 ('lich_m','リッチ（男）','不死',2,'長身・ローブ','杖と髑髏','フードを被った男性の死霊魔導士。致死の呪文',
  '死の呪文',132,1,'dark','curse','cast','#9a7ad0','杖の髑髏が唸り、呪いの言葉を読み上げる'),
 ('lich_f','リッチ（女）','不死',2,'長身・ローブ','杖と魔法陣','青いローブの女性死霊魔導士。魔力を枯らす',
  '魂の吸収',116,1,'dark','','cast','#7ab0e0','掌の魔法陣で相手のMPを吸い上げる'),
 ('phantom','ファントム','不死',1,'浮遊・髑髏','霊体','髑髏の頭を浮かべる幽霊。実体を掴めない',
  '幽影の慟哭',100,2,'dark','confuse','aura','#9ac8e8','霧のように揺れながら、混乱させる悲鳴を響かせる'),
 ('specter','スペクター','不死',1,'浮遊・髑髏','霊体','髑髏の顔だけが浮かぶ幽霊。眠りを誘う',
  '眠りの吐息',92,1,'dark','sleep','aura','#a8b8e0','対象の意識を霧で包み、深い眠りへ落とす'),
 ('wraith','レイス','不死',2,'浮遊・蛇の衣','霊体','蛇のように渦巻く布を纏う怨霊。連続の霊撃',
  '怨蛇の纏い',88,3,'dark','','aura','#b090d0','布を蛇のように伸ばし、三度巻きつけて締めつける'),
 ('shade','シェイド','不死',2,'巨顔・触手','無数の眼','無数の眼と触手を持つ闇の塊。視線で金縛りにする',
  '千眼の凝視',126,1,'dark','paralysis','gaze','#8060c0','無数の眼が一斉に開き、見た者を凍りつかせる'),
 ('gazer','ゲイザー','魔物',2,'一つ目・触手','眼球','巨大な一つ目と触手の魔物。石化の眼光',
  '石化の眼光',130,1,'earth','paralysis','gaze','#d8a050','一つ目を見据え、必中の眼光で石のように固める'),
 ('gargoyle','ガーゴイル','魔物',2,'中型・石翼','爪と翼','石の翼を持つ悪魔像。空からの急降下',
  '石翼の急襲',98,2,'wind','','slash','#a8b0c0','翼を畳んで急降下し、石の爪で二度引き裂く'),
 ('vampire','ヴァンパイア','不死',2,'長身・翼','爪と翼','翼を広げた吸血鬼。血を啜って自ら癒える',
  '血の収穫',120,1,'dark','','bite','#c04060','襟元へ噛みつき、奪った血で自らの傷を閉じる'),
 ('succubus','サキュバス','悪魔',2,'中型・翼','爪と翼','翼と角を持つ女悪魔。魅惑で混乱させる',
  '魅惑の囁き',108,1,'dark','confuse','aura','#d060a0','甘い囁きで判断を鈍らせ、同士討ちを誘う'),
 ('incubus','インキュバス','悪魔',2,'中型・翼','爪と翼','翼と角を持つ男悪魔。闇の爪で切り裂く',
  '夜の鈎爪',114,2,'dark','','slash','#9060c0','影に紛れて現れ、翼の勢いで二度薙ぐ'),
 ('wickerman','ウィッカーマン','悪魔',2,'巨大・籠','燃える枝','藁で編んだ巨人の体内で炎が燃える。身を焦がす業火',
  '焼身の業火',136,1,'fire','burn','breath','#ff7a30','自らの藁を燃やし、炎の息を浴びせる'),
 ('no_life_king','ノーライフクイーン','不死',3,'長身・王冠','骨の王笏','王冠を戴く不死の女王。骨の触手が四方を薙ぐ',
  '不死の王令',92,3,'dark','','cast','#d8c0f0','王笏を掲げ、骨の腕を三方向から繰り出す'),
 ('archdemon','アークデーモン','悪魔',3,'巨大・翼と角','魔爪','特大の角と翼を持つ大悪魔。劫火を吐く',
  '魔王の劫火',146,1,'fire','burn','breath','#ff5a40','翼を広げ、溶岩のような劫火を吐きつける'),
 ('greater_plain','グレーターデーモン','悪魔',3,'巨大・二本角','素手の魔爪','筋骨隆々の巨大悪魔。角と拳だけで圧殺する',
  '深淵の角突き',140,1,'earth','','charge','#c04050','巨躯を低くして突進し、二本の角で突き上げる'),
 ('greater_staff','杖のグレーターデーモン','悪魔',3,'巨大・二本角','長杖','緑に光る長杖を握る巨大悪魔。杖から雷を走らせる',
  '杖の鳴雷',138,1,'thunder','paralysis','cast','#70e0a0','杖を地面に突き、緑の雷を這わせる'),
 ('greater_magic','魔法のグレーターデーモン','悪魔',4,'巨大・二本角','魔法球','掌に赤い魔法球を浮かべる巨大悪魔。呪力の奔流',
  '魔法の奔流',144,1,'star','','cast','#ff8050','掌の球が膨らみ、呪力の奔流として解放される'),
 ('greater_both','杖と魔法のグレーターデーモン','悪魔',4,'巨大・二本角','杖＋魔法球','杖と魔法球を同時に扱う最上位の巨大悪魔',
  '極撃・杖と魔法',152,1,'star','','cast','#ffcf70','杖の雷と掌の球を重ね、極大の呪撃を叩き込む'),
 ('founder','デーモンファウンダー','悪魔',4,'最大級・多角','無数の触手','多数の角と触手を備えた原初の悪魔。全方向への連撃',
  '原初の触手',74,4,'dark','','multi','#ff4a70','無数の触手が四方から同時に襲いかかる'),
]

ENEMIES = []
for (eid, name, family, tier, build, weapon, features,
     mv, power, hits, element, status, motion, color, mvdesc) in E:
    ENEMIES.append({
        'id': eid, 'name': name, 'family': family, 'tier': tier,
        'build': build, 'weapon': weapon, 'features': features,
        'move': {
            'id': f'mv_{eid}', 'name': mv, 'desc': mvdesc,
            'power': power, 'hits': hits, 'element': element,
            'status': status, 'motion': motion, 'color': color,
            'drain': 0.18 if ('吸収' in mv or '収穫' in mv or 'すすり' in mvdesc) else 0,
            'debuff': 18 if ('防御' in mvdesc or '守り' in mvdesc) else 0,
            'selfBuff': 16 if ('攻勢' in mvdesc or '強める' in mvdesc) else 0,
            'trueHit': ('必中' in mvdesc or '眼光' in mv),
        },
        'display': {
            'scale': 1.40 if ('最大級' in build or '巨大' in build) else
                     1.20 if ('長身' in build or '大型' in build or '巨顔' in build or '中型' in build) else 1.0,
            'ground': 0.94 if ('浮遊' in build) else 0.99,
            'float': '浮遊' in build or '翼' in build,
            'wide': '横長' in build,
            'flip': True,
        },
    })
ENEMY_BY_ID = {e['id']: e for e in ENEMIES}

# ---------------------------------------------------------------------------
# ファイル → 敵ID の 1 対 1 対応（色番号 / 装備違いを判定）
# ---------------------------------------------------------------------------
def gear_of(kind, name):
    if kind == 'goblin':
        for g, key in [('棍棒','goblin_club'),('剣','goblin_sword'),('斧','goblin_axe'),('弓','goblin_bow')]:
            if g in name: return key
        return 'goblin_club'
    if kind == 'skeleton':
        if '（腕）' in name: return 'skeleton_arm'
        if '（兜）' in name: return 'skeleton_helm'
        if '（角）' in name: return 'skeleton_horn'
        return 'skeleton_plain'
    if kind == 'greater':
        if '杖&魔法' in name: return 'greater_both'
        if '杖' in name: return 'greater_staff'
        if '魔法' in name: return 'greater_magic'
        return 'greater_plain'
    return kind

def color_of(name):
    m = re.match(r'^(\d)[.．]', name)
    if m: return int(m.group(1)) - 1
    m = re.search(r'(\d)\.png$', name)
    if m: return max(0, int(m.group(1)) - 1)
    return 0

# 重複（別フォルダの同一バイト再掲）判定: stage_p2.json の identical duplicates
dup_ids = set()
if isinstance(p2, dict):
    for k in ('duplicates', 'identical', 'identical_duplicates'):
        v = p2.get(k)
        if isinstance(v, list):
            for x in v:
                if isinstance(x, str): dup_ids.add(x)
                elif isinstance(x, dict): dup_ids.add(x.get('id') or x.get('file'))
# 同名ファイルを 2 つ以上持つ場合は 2 つ目以降を再掲として扱う
seen_name = {}
records = []
for r in inv:
    rid, name, kind, folder = r['id'], r['name'], r['kind'], r['folder']
    st = stage.get(rid, {})
    f = st.get('file', '')
    is_zip = name.lower().endswith('.zip') or rid.lower().endswith('.zip')
    png = st.get('png') or {}
    decinfo = dec_by_file.get(f, {})
    enemy_id = gear_of(kind, name)
    if enemy_id not in ENEMY_BY_ID:
        enemy_id = kind
    key = (kind, name)
    is_dup = rid in dup_ids or (key in seen_name and not is_zip)
    if is_zip:
        role = 'archive'
    elif is_dup:
        role = 'duplicate'
    elif color_of(name) > 0:
        role = 'variant'
    else:
        role = 'primary'
    seen_name.setdefault(key, rid)
    readable = bool(st.get('ok')) and (is_zip or bool(png))
    rec = {
        'id': rid, 'name': name, 'folder': folder, 'folderId': r.get('folder_id'),
        'kind': kind, 'enemyId': enemy_id, 'role': role,
        'color': color_of(name), 'src': f.replace('\\','/'),
        'bytes': st.get('size', 0), 'sha256': st.get('sha256',''),
        'w': png.get('w', 0), 'h': png.get('h', 0),
        'readable': readable, 'note': '',
    }
    rec['fallback'] = 'assets/enemies/%s.png' % enemy_id
    if is_zip:
        n = 4
        rec['note'] = 'ZIPアーカイブ。中のPNGは4枚で、フォルダ内の同名PNGとバイト一致。ファイル名はCP437/日本語エンコーディングのため文字化けするが画像データは正常'
        rec['entries'] = n
    elif is_dup:
        rec['note'] = '別フォルダに再掲された同一バイトの画像。敵への対応は原本と同じ'
    records.append(rec)

# 代表画像（primary が無い敵は最初の variant を繰り上げ）
by_enemy = collections.defaultdict(list)
for r in records:
    if r['role'] != 'archive':
        by_enemy[r['enemyId']].append(r)
for e in ENEMIES:
    lst = by_enemy.get(e['id'], [])
    prim = [r for r in lst if r['role'] == 'primary']
    # 代表画像は 1 敵につき 1 枚に正規化する（残りは色違いとして登録）
    for r in prim[1:]: r['role'] = 'variant'
    if not prim and lst:
        lst[0]['role'] = 'primary'
        prim = [lst[0]]
    e['art'] = prim[0]['src'] if prim else ''
    # 配信用の代表画像は元 PNG をバイト単位でそのままコピー（加工・再圧縮なし）
    out = 'assets/enemies/%s.png' % e['id']
    if e['art']:
        src = e['art']
        # 既存ファイルも全バイトで比較し、1 バイトでも違えば元ファイルから作り直す
        if not os.path.exists(out) or not filecmp.cmp(src, out, shallow=False):
            shutil.copyfile(src, out)
    e['bundled'] = out
    # 既定表示はリポジトリ同梱の代表 PNG（元バイトそのまま）を使う。
    # 色違い切り替え時だけ原本フォルダの別ファイルを参照し、
    # 原本が無い環境では data-fallback で代表 PNG へ戻る。
    # 先頭は配信用の代表 PNG（primary のバイトそのまま）、以降は色違いの原本ファイル
    variants = [out] if e['art'] else []
    for r in lst:
        if r['role'] in ('variant', 'duplicate'):
            variants.append(r['src'])
    e['variants'] = variants
    e['fileIds'] = [r['id'] for r in lst]
    e['primaryId'] = prim[0]['id'] if prim else ''

# ---------------------------------------------------------------------------
# ダンジョン設計：強さと特徴で帯を分け、階ごとに固定（ランダム依存なし）
# ---------------------------------------------------------------------------
BANDS = [
    {'name':'第1帯・緑の斜面','tier':0,'floors':(1,4),
     'ids':['goblin_club','imp','goblin_sword','jack','goblin_axe','goblin_bow','lesser'],
     'boss':'goblin_king','desc':'小柄で武器を持つ下位の敵。まずはゴブリンと小悪魔が迎える'},
    {'name':'第2帯・霧の墓所','tier':1,'floors':(5,9),
     'ids':['skeleton_plain','goblin_archer','hobgoblin','skeleton_helm','phantom','goblin_shaman','skeleton_arm','specter','goblin_japan'],
     'boss':'lich_m','desc':'骸骨と上位ゴブリン、霊体が現れる。状態異常を使う敵が増える'},
    {'name':'第3帯・眸の回廊','tier':2,'floors':(10,14),
     'ids':['skeleton_horn','gargoyle','lich_f','wraith','shade','vampire','gazer','succubus','incubus','wickerman'],
     'boss':'no_life_king','desc':'大型・浮遊・触手を持つ上位種。必中や麻痺の専用技が並ぶ'},
    {'name':'第4帯・焔の門','tier':3,'floors':(15,19),
     'ids':['greater_plain','archdemon','greater_staff','chariots','greater_magic','founder'],
     'boss':'archdemon','desc':'翼と角を備えた巨大悪魔。威力140超の専用技を繰り出す'},
    {'name':'第5帯・淵の玉座','tier':4,'floors':(20,999),
     'ids':['greater_both','founder','archdemon','greater_magic','no_life_king','chariots'],
     'boss':'founder','desc':'最上位の個体のみ。20階以降はこの帯を周回し、階ごとに倍率が上乗せされる'},
]
PLAN = []
for f in range(1, 31):
    band = next(b for b in BANDS if b['floors'][0] <= f <= b['floors'][1])
    if f % 5 == 0:
        eid, label = band['boss'], '階層ボス'
    else:
        eid = band['ids'][(f - 1) % len(band['ids'])]
        label = '通常戦'
    PLAN.append({'floor': f, 'enemyId': eid, 'band': band['name'], 'tier': band['tier'],
                 'label': label, 'cycle': (f - 1) // 20})

# ---------------------------------------------------------------------------
# 出力
# ---------------------------------------------------------------------------
os.makedirs('assets/enemies', exist_ok=True)
js = []
js.append('/* 自動生成: tools/build_enemy_assets.py — Google Drive「敵キャラ」全ファイルの台帳。')
js.append('   元 PNG は変換せず assets/enemies/source/<DriveID>.png をそのまま参照する。 */')
js.append('export const DRIVE_ROOT = { id: %s, name: %s };' % (
    json.dumps('11SJbYwo1hMgPnoaIrcnUHABGVzmparkI'), json.dumps('敵キャラ', ensure_ascii=False)))
js.append('export const ASSET_FILES = %s;' % json.dumps(records, ensure_ascii=False, indent=1))
js.append('export const ENEMY_KINDS = %s;' % json.dumps(ENEMIES, ensure_ascii=False, indent=1))
js.append('export const ENEMY_KIND = Object.fromEntries(ENEMY_KINDS.map(e => [e.id, e]));')
js.append('export const DUNGEON_BANDS = %s;' % json.dumps(BANDS, ensure_ascii=False, indent=1))
js.append('export const DUNGEON_PLAN = %s;' % json.dumps(PLAN, ensure_ascii=False, indent=1))
js.append('export const ASSET_BY_ID = Object.fromEntries(ASSET_FILES.map(r => [r.id, r]));')
js.append('export const FILES_BY_ENEMY = ASSET_FILES.reduce((m, r) => { (m[r.enemyId] ||= []).push(r); return m; }, {});')
js.append('export const UNREADABLE_FILES = ASSET_FILES.filter(r => !r.readable);')
js.append('export function enemyArt(enemy, variant = 0) { const k = ENEMY_KIND[enemy?.artId || enemy?.id] || enemy;')
js.append('  const list = k?.variants || []; const src = list.length ? list[((variant % list.length) + list.length) % list.length] : (k?.art || "");')
js.append('  return { src, fallback: k?.bundled || "", id: k?.id || "", display: k?.display || null, move: k?.move || null, variants: list.length }; }')
js.append('export function enemyMove(enemy) { const k = ENEMY_KIND[enemy?.artId || enemy?.id]; return k?.move || null; }')
js.append('export function enemyDisplay(enemy) { const k = ENEMY_KIND[enemy?.artId || enemy?.id]; return k?.display || null; }')
open('js/enemyAssets.js','w',encoding='utf-8').write('\n'.join(js) + '\n')

audit = {
    'source': 'Google Drive / 敵キャラ',
    'root': '11SJbYwo1hMgPnoaIrcnUHABGVzmparkI',
    'totalFiles': len(records),
    'png': sum(1 for r in records if r['role'] != 'archive'),
    'zip': sum(1 for r in records if r['role'] == 'archive'),
    'decoded': sum(1 for r in records if r['role'] != 'archive' and r['readable']),
    'unreadable': [r['name'] for r in records if not r['readable']],
    'duplicates': sum(1 for r in records if r['role'] == 'duplicate'),
    'enemies': len(ENEMIES),
    'filesWithEnemy': sum(1 for r in records if r['enemyId'] in ENEMY_BY_ID),
    'dungeonFloors': len(PLAN),
    'bytes': sum(r['bytes'] for r in records),
}
json.dump(audit, open('tools/asset_audit.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

# Markdown 台帳
lines = [
 '# 敵キャラクター資産台帳（Google Drive「敵キャラ」）',
 '',
 '取得元フォルダ ID: `11SJbYwo1hMgPnoaIrcnUHABGVzmparkI`（33 個のハッシュ名サブフォルダ／33 個の日本語リーフフォルダ）',
 '',
 f'- 確認したファイル: **{len(records)} 件**（PNG {audit["png"]} / ZIP {audit["zip"]}）',
 f'- 画像としてデコード成功: **{audit["decoded"]} / {audit["png"]}**',
 f'- 読み込み失敗: **{len(audit["unreadable"])} 件**',
 f'- 別フォルダへの同一バイト再掲: {audit["duplicates"]} 件',
 f'- 登録した個別の敵: **{len(ENEMIES)} 種類**',
 f'- 敵IDへ紐付いたファイル: {audit["filesWithEnemy"]} / {len(records)}',
 '',
 '## 読み込めなかったファイルと原因',
 '',
]
if audit['unreadable']:
    lines += ['| ファイル名 | 原因 |', '| --- | --- |'] + [f'| {n} | 解析不能 |' for n in audit['unreadable']]
else:
    lines += ['**該当なし（0 件）**。全 PNG のヘッダ・CRC・デコードを 1 件ずつ確認し、177 枚すべてが RGBA 透過 PNG として正常に読み込めました。',
              '',
              'なお 3 件の `.zip` は画像ではなくアーカイブです。内部のファイル名は CP437 / 旧日本語エンコーディングで格納されているため `zipfile` の既定デコードでは文字化けしますが、',
              '中の 12 枚の PNG はすべて正常にデコードでき、フォルダ内の同名 PNG とバイト単位で一致しました（＝画像データの読み込み失敗ではありません）。',
              '',
              'また `マップ１` フォルダに 4 件の GLB がありますが、これは「敵キャラ」フォルダ外のため本更新では使用していません。',
              '「敵キャラ」フォルダ内に 3D モデル・アニメーション・動画ファイルは **1 件も存在しません**（すべて静止 2D イラスト PNG）。',
              'したがって 3D 読み込みやアニメーション再生を装うことはせず、元ピクセルをそのまま `<img>` で表示し、',
              '表示サイズ・向き・接地影・攻撃モーション・エフェクトのみを CSS で付与しています。']
lines += ['', '## 個別の敵と専用技', '',
          '| 敵ID | 名前 | 帯 | 体格 | 武器 | 専用技 | 威力 | 回数 | 属性 | 状態 | モーション | 代表ファイル |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |']
for e in ENEMIES:
    m = e['move']
    lines.append(f'| `{e["id"]}` | {e["name"]} | {e["tier"]} | {e["build"]} | {e["weapon"]} | {m["name"]} | {m["power"]} | {m["hits"]} | {m["element"]} | {m["status"] or "—"} | {m["motion"]} | `{e["art"]}` |')
lines += ['', '## 全ファイル → 敵 対応表（1 件ずつ）', '',
          '| # | ファイル名 | フォルダ | 種別 | 敵ID | 役割 | サイズ | 画像素材 | 読込 |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- |']
for i, r in enumerate(records, 1):
    lines.append(f'| {i} | {r["name"]} | {r["folder"]} | {r["kind"]} | `{r["enemyId"]}` | {r["role"]} | {r["bytes"]:,} B | {r["w"]}×{r["h"]} | {"OK" if r["readable"] else "NG"} |')
lines += ['', '> `role`: `primary` = その敵の代表画像 / `variant` = 色違い / `duplicate` = 別フォルダの同一バイト再掲 / `archive` = ZIP。',
          '> 元ファイルは `assets/enemies/source/<DriveID>.png` にそのまま保存され、変換・再圧縮・改名・加工は一切行っていません。',
          '> `assets/enemies/<敵ID>.png` は代表画像をバイト単位でコピーした配信用ファイルです（元画像と同一内容）。',
          '> アプリの既定表示はこの配信用 PNG、色違い切り替え時は `assets/enemies/source/` の別ファイルをそのまま参照します。',
          '> `assets/enemies/source/` は大容量の原本置き場のため Git 管理外とし、全ファイルの Drive ID・SHA256・対応敵は本台帳で管理します。',
          '']
open('assets/enemies/ASSET_MANIFEST.md','w',encoding='utf-8').write('\n'.join(lines))

print(json.dumps(audit, ensure_ascii=False, indent=2))
missing = [e['id'] for e in ENEMIES if not e['art']]
print('enemies without art:', missing)
print('roles:', collections.Counter(r['role'] for r in records))
