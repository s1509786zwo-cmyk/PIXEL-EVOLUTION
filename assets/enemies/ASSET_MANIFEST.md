# 敵キャラクター資産台帳（Google Drive「敵キャラ」）

取得元フォルダ ID: `11SJbYwo1hMgPnoaIrcnUHABGVzmparkI`（33 個のハッシュ名サブフォルダ／33 個の日本語リーフフォルダ）

- 確認したファイル: **180 件**（PNG 177 / ZIP 3）
- 画像としてデコード成功: **177 / 177**
- 読み込み失敗: **0 件**
- 別フォルダへの同一バイト再掲: 36 件
- 登録した個別の敵: **36 種類**
- 敵IDへ紐付いたファイル: 180 / 180

## 読み込めなかったファイルと原因

**該当なし（0 件）**。全 PNG のヘッダ・CRC・デコードを 1 件ずつ確認し、177 枚すべてが RGBA 透過 PNG として正常に読み込めました。

なお 3 件の `.zip` は画像ではなくアーカイブです。内部のファイル名は CP437 / 旧日本語エンコーディングで格納されているため `zipfile` の既定デコードでは文字化けしますが、
中の 12 枚の PNG はすべて正常にデコードでき、フォルダ内の同名 PNG とバイト単位で一致しました（＝画像データの読み込み失敗ではありません）。

また `マップ１` フォルダに 4 件の GLB がありますが、これは「敵キャラ」フォルダ外のため本更新では使用していません。
「敵キャラ」フォルダ内に 3D モデル・アニメーション・動画ファイルは **1 件も存在しません**（すべて静止 2D イラスト PNG）。
したがって 3D 読み込みやアニメーション再生を装うことはせず、元ピクセルをそのまま `<img>` で表示し、
表示サイズ・向き・接地影・攻撃モーション・エフェクトのみを CSS で付与しています。

## 個別の敵と専用技

| 敵ID | 名前 | 帯 | 体格 | 武器 | 専用技 | 威力 | 回数 | 属性 | 状態 | モーション | 代表ファイル |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `imp` | 小悪魔インプ | 0 | 小型・翼あり | 爪と尾 | 影爪の乱舞 | 96 | 2 | dark | poison | multi | `assets/enemies/source/1tdIEJ9CKKAjeJcnEFpp8xPnAXuMYFBXM.png` |
| `goblin_club` | 棍棒ゴブリン | 0 | 小型 | 棍棒 | 脳天割り | 112 | 1 | earth | stun | bash | `assets/enemies/source/1Sd0Sk5N-ml34tHcBRcE0sKGxob9PLEO1.png` |
| `goblin_sword` | 剣ゴブリン | 0 | 小型 | 曲刀 | 錆刃の連斬 | 88 | 2 | wind | — | slash | `assets/enemies/source/1XHgHa71JDel8zMVimxa1IQAeUGbNuf51.png` |
| `goblin_axe` | 斧ゴブリン | 0 | 小型 | 両刃斧 | 斧薙ぎ | 116 | 1 | earth | — | bash | `assets/enemies/source/1oUdaDl_l7tD9dWncT77x7iaV-YFmodEZ.png` |
| `goblin_bow` | 弓ゴブリン | 0 | 小型 | 弓 | 毒矢の雨 | 72 | 3 | wind | poison | shot | `assets/enemies/source/1fWcRQUosdskd_qNWY2ISmZONZaUm8gsu.png` |
| `goblin_archer` | ゴブリンアーチャー | 1 | 中型・筋肉質 | 大弓 | 穿ちの狙撃 | 128 | 1 | wind | — | shot | `assets/enemies/source/1X23boRMyKQzAjL5RV0Q_nitVSOQwv5Pv.png` |
| `goblin_shaman` | ゴブリンシャーマン | 1 | 小型 | 仮面と杖 | 呪面の舞 | 104 | 1 | dark | curse | cast | `assets/enemies/source/1Hhifkr7jMLf8nnqr-o4dQNr0zM8XE7bp.png` |
| `goblin_japan` | ゴブリンジパング | 1 | 小型 | 刀 | 一閃・居合い | 124 | 1 | light | — | slash | `assets/enemies/source/1GbcUFhbCMyH1z50GjeT6SnejXFVzebOD.png` |
| `goblin_king` | ゴブリンキング | 1 | 中型・王冠 | 大剣 | 王威の三連斬 | 96 | 3 | fire | — | multi | `assets/enemies/source/1sRJQ_UEngh9cM_1IMC2GavnsUcoCQsw9.png` |
| `hobgoblin` | ホブゴブリン | 1 | 大型・筋肉質 | 棘付き棍棒 | 剛腕の粉碎 | 142 | 1 | earth | — | bash | `assets/enemies/source/1MBJM6AbAENldnqef6giGJWgWc-5P0guk.png` |
| `chariots` | ゴブリン・チャリオッツ | 2 | 巨大・横長 | 戦車 | 戦車突撃 | 150 | 1 | thunder | paralysis | charge | `assets/enemies/source/1RO82c8Bl6vHJRpQVY1ykcrEWmiGCX8Qc.png` |
| `jack` | ジャックランタン | 0 | 小型 | 南瓜の提灯 | 南瓜の鬼火 | 98 | 2 | fire | burn | cast | `assets/enemies/source/1CZZ8yjRi7RnR2axJe1aT4AeyKOSuN1cC.png` |
| `lesser` | レッサーデーモン | 1 | 痩身・二本角 | 鉤爪 | 飢えた鉤爪 | 110 | 1 | dark | — | bite | `assets/enemies/source/1QixONfHqB2rpdx3davH6fNrSfka2jrTC.png` |
| `skeleton_plain` | スケルトン | 1 | 細身 | 剣と盾 | 骨剣の一突き | 106 | 1 | none | — | thrust | `assets/enemies/source/1yP8KBJn5pYS8Fr62RrCyoYjagWZDFl6w.png` |
| `skeleton_arm` | 六腕スケルトン | 2 | 細身・六本腕 | 六本の剣 | 六腕・千斬り | 70 | 6 | none | — | multi | `assets/enemies/source/1avI3-xfKAInpIBrX9YNXQss280TUjmtq.png` |
| `skeleton_helm` | 兜スケルトン | 1 | 細身・兜 | 剣と盾 | 兜割り | 118 | 1 | earth | — | bash | `assets/enemies/source/1c5jphhb5tl_TTHzMPiKlh4ywXARfF5cD.png` |
| `skeleton_horn` | 角スケルトン | 2 | 細身・角 | 剣と角 | 髏角の突進 | 124 | 1 | dark | — | charge | `assets/enemies/source/1wbJTUP1k0Cv11cRKlBEklkrAEz_T1VVA.png` |
| `lich_m` | リッチ（男） | 2 | 長身・ローブ | 杖と髑髏 | 死の呪文 | 132 | 1 | dark | curse | cast | `assets/enemies/source/1-4XtoV8WaHnpyW8gI7Du7Eu0PelWr2Mj.png` |
| `lich_f` | リッチ（女） | 2 | 長身・ローブ | 杖と魔法陣 | 魂の吸収 | 116 | 1 | dark | — | cast | `assets/enemies/source/1gdYf_9T_Etb411vTXfeL4cZyelR3QD4g.png` |
| `phantom` | ファントム | 1 | 浮遊・髑髏 | 霊体 | 幽影の慟哭 | 100 | 2 | dark | confuse | aura | `assets/enemies/source/1S-hkECGj1AfZHPInUR-ov7PWURuQCLXB.png` |
| `specter` | スペクター | 1 | 浮遊・髑髏 | 霊体 | 眠りの吐息 | 92 | 1 | dark | sleep | aura | `assets/enemies/source/1QnduHSxT4ismF2E_fb1OWLz2lHUlTksS.png` |
| `wraith` | レイス | 2 | 浮遊・蛇の衣 | 霊体 | 怨蛇の纏い | 88 | 3 | dark | — | aura | `assets/enemies/source/1wmd6SJOIEgF4vZNlToNfEBUSsTOu6Yo8.png` |
| `shade` | シェイド | 2 | 巨顔・触手 | 無数の眼 | 千眼の凝視 | 126 | 1 | dark | paralysis | gaze | `assets/enemies/source/1ZQ8GQVCzfWmQoV436vy0w-0yTMH4bQYy.png` |
| `gazer` | ゲイザー | 2 | 一つ目・触手 | 眼球 | 石化の眼光 | 130 | 1 | earth | paralysis | gaze | `assets/enemies/source/1ndgovC8aRN1KslaeXt6d6-Rq9SdX2fP0.png` |
| `gargoyle` | ガーゴイル | 2 | 中型・石翼 | 爪と翼 | 石翼の急襲 | 98 | 2 | wind | — | slash | `assets/enemies/source/1CKyZBpFp_o2xrJUSD5fsYubxyIEeehIt.png` |
| `vampire` | ヴァンパイア | 2 | 長身・翼 | 爪と翼 | 血の収穫 | 120 | 1 | dark | — | bite | `assets/enemies/source/1K7wMspDoht4HiauE8zV6mjOVrM2TWDXE.png` |
| `succubus` | サキュバス | 2 | 中型・翼 | 爪と翼 | 魅惑の囁き | 108 | 1 | dark | confuse | aura | `assets/enemies/source/12L6FFxgptBUboyYalhOw3T0PNzvv1iPB.png` |
| `incubus` | インキュバス | 2 | 中型・翼 | 爪と翼 | 夜の鈎爪 | 114 | 2 | dark | — | slash | `assets/enemies/source/1kBl1hHoZ9li-lUoWnS9l29fRLgwCbm9r.png` |
| `wickerman` | ウィッカーマン | 2 | 巨大・籠 | 燃える枝 | 焼身の業火 | 136 | 1 | fire | burn | breath | `assets/enemies/source/1kcruGYahDwklHPqPdgrnzKkoxHLXbeF-.png` |
| `no_life_king` | ノーライフクイーン | 3 | 長身・王冠 | 骨の王笏 | 不死の王令 | 92 | 3 | dark | — | cast | `assets/enemies/source/1pB-5_VihpZfGY13Pu-FVhvi5nLRnMNJG.png` |
| `archdemon` | アークデーモン | 3 | 巨大・翼と角 | 魔爪 | 魔王の劫火 | 146 | 1 | fire | burn | breath | `assets/enemies/source/1V_sBD6iLbEmVpd3-ebQILT_3A7MCu6fq.png` |
| `greater_plain` | グレーターデーモン | 3 | 巨大・二本角 | 素手の魔爪 | 深淵の角突き | 140 | 1 | earth | — | charge | `assets/enemies/source/130YvF6lYu_TLpyo3pfV91Lwe6E3XhLTj.png` |
| `greater_staff` | 杖のグレーターデーモン | 3 | 巨大・二本角 | 長杖 | 杖の鳴雷 | 138 | 1 | thunder | paralysis | cast | `assets/enemies/source/13hA_Evg96eAM2Nyep23Bv2IQF28AUQLT.png` |
| `greater_magic` | 魔法のグレーターデーモン | 4 | 巨大・二本角 | 魔法球 | 魔法の奔流 | 144 | 1 | star | — | cast | `assets/enemies/source/1eLa_ViYNKJfniryQg63ETz2CRMMpSO6u.png` |
| `greater_both` | 杖と魔法のグレーターデーモン | 4 | 巨大・二本角 | 杖＋魔法球 | 極撃・杖と魔法 | 152 | 1 | star | — | cast | `assets/enemies/source/1wYeYpJqGWSBeTzOr-4n99l1Tz-GdHrKU.png` |
| `founder` | デーモンファウンダー | 4 | 最大級・多角 | 無数の触手 | 原初の触手 | 74 | 4 | dark | — | multi | `assets/enemies/source/1Giqtd6b7EsLvTI-dVhyPH-MZayakZi4D.png` |

## 全ファイル → 敵 対応表（1 件ずつ）

| # | ファイル名 | フォルダ | 種別 | 敵ID | 役割 | サイズ | 画像素材 | 読込 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4.インプ.png | インプ (A) | imp | `imp` | variant | 1,572,160 B | 1550×1750 | OK |
| 2 | 3.インプ.png | インプ (A) | imp | `imp` | variant | 1,579,220 B | 1550×1750 | OK |
| 3 | 2.インプ.png | インプ (A) | imp | `imp` | variant | 1,573,612 B | 1550×1750 | OK |
| 4 | 1.インプ.png | インプ (A) | imp | `imp` | primary | 1,570,449 B | 1550×1750 | OK |
| 5 | 4.インプ.png | インプ (B) | imp | `imp` | duplicate | 1,572,160 B | 1550×1750 | OK |
| 6 | 3.インプ.png | インプ (B) | imp | `imp` | duplicate | 1,579,220 B | 1550×1750 | OK |
| 7 | 2.インプ.png | インプ (B) | imp | `imp` | duplicate | 1,573,612 B | 1550×1750 | OK |
| 8 | 1.インプ.png | インプ (B) | imp | `imp` | duplicate | 1,570,449 B | 1550×1750 | OK |
| 9 | ゴブリン_棍棒3.png | ゴブリン | goblin | `goblin_club` | variant | 667,673 B | 734×1170 | OK |
| 10 | ゴブリン_棍棒2.png | ゴブリン | goblin | `goblin_club` | variant | 636,029 B | 734×1170 | OK |
| 11 | ゴブリン_棍棒1.png | ゴブリン | goblin | `goblin_club` | primary | 669,485 B | 734×1170 | OK |
| 12 | ゴブリン_棍棒.png | ゴブリン | goblin | `goblin_club` | variant | 678,136 B | 734×1170 | OK |
| 13 | ゴブリン_斧3.png | ゴブリン | goblin | `goblin_axe` | variant | 667,044 B | 734×1170 | OK |
| 14 | ゴブリン_斧2.png | ゴブリン | goblin | `goblin_axe` | variant | 635,890 B | 734×1170 | OK |
| 15 | ゴブリン_斧1.png | ゴブリン | goblin | `goblin_axe` | primary | 668,908 B | 734×1170 | OK |
| 16 | ゴブリン_斧.png | ゴブリン | goblin | `goblin_axe` | variant | 678,293 B | 734×1170 | OK |
| 17 | ゴブリン_剣3.png | ゴブリン | goblin | `goblin_sword` | variant | 665,856 B | 734×1170 | OK |
| 18 | ゴブリン_剣2.png | ゴブリン | goblin | `goblin_sword` | variant | 639,710 B | 734×1170 | OK |
| 19 | ゴブリン_剣1.png | ゴブリン | goblin | `goblin_sword` | primary | 668,959 B | 734×1170 | OK |
| 20 | ゴブリン_剣.png | ゴブリン | goblin | `goblin_sword` | variant | 678,350 B | 734×1170 | OK |
| 21 | ゴブリン_弓3.png | ゴブリン | goblin | `goblin_bow` | variant | 681,948 B | 734×1170 | OK |
| 22 | ゴブリン_弓2.png | ゴブリン | goblin | `goblin_bow` | variant | 658,830 B | 734×1170 | OK |
| 23 | ゴブリン_弓1.png | ゴブリン | goblin | `goblin_bow` | primary | 686,313 B | 734×1170 | OK |
| 24 | ゴブリン_弓.png | ゴブリン | goblin | `goblin_bow` | variant | 693,779 B | 734×1170 | OK |
| 25 | 4.リッチ_男.png | 全カラー_リッチ_男 | lich_m | `lich_m` | variant | 1,393,797 B | 1100×1753 | OK |
| 26 | 3.リッチ_男.png | 全カラー_リッチ_男 | lich_m | `lich_m` | variant | 1,438,474 B | 1100×1753 | OK |
| 27 | 2.リッチ_男.png | 全カラー_リッチ_男 | lich_m | `lich_m` | variant | 1,432,930 B | 1100×1753 | OK |
| 28 | 1.リッチ_男.png | 全カラー_リッチ_男 | lich_m | `lich_m` | primary | 1,391,331 B | 1100×1753 | OK |
| 29 | 4.リッチ_女.png | 全カラー_リッチ_女 | lich_f | `lich_f` | variant | 1,364,741 B | 1100×1753 | OK |
| 30 | 3.リッチ_女.png | 全カラー_リッチ_女 | lich_f | `lich_f` | variant | 1,363,715 B | 1100×1753 | OK |
| 31 | 2.リッチ_女.png | 全カラー_リッチ_女 | lich_f | `lich_f` | variant | 1,365,006 B | 1100×1753 | OK |
| 32 | 1.リッチ_女.png | 全カラー_リッチ_女 | lich_f | `lich_f` | primary | 1,342,069 B | 1100×1753 | OK |
| 33 | 4.ファントム.png | 全カラー_ファントム | phantom | `phantom` | variant | 761,679 B | 1450×1100 | OK |
| 34 | 3.ファントム.png | 全カラー_ファントム | phantom | `phantom` | variant | 761,396 B | 1450×1100 | OK |
| 35 | 2.ファントム.png | 全カラー_ファントム | phantom | `phantom` | variant | 762,620 B | 1450×1100 | OK |
| 36 | 1.ファントム.png | 全カラー_ファントム | phantom | `phantom` | primary | 757,342 B | 1450×1100 | OK |
| 37 | 4.ジャックランタン.png | 全カラー_ジャックランタン | jack | `jack` | variant | 1,470,212 B | 1275×1742 | OK |
| 38 | 3.ジャックランタン.png | 全カラー_ジャックランタン | jack | `jack` | variant | 1,459,988 B | 1275×1742 | OK |
| 39 | 2.ジャックランタン.png | 全カラー_ジャックランタン | jack | `jack` | variant | 1,492,147 B | 1275×1742 | OK |
| 40 | 1.ジャックランタン.png | 全カラー_ジャックランタン | jack | `jack` | primary | 1,445,714 B | 1275×1742 | OK |
| 41 | 4.スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_plain` | variant | 617,232 B | 1253×1699 | OK |
| 42 | 4.（腕）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_arm` | variant | 967,019 B | 1253×1699 | OK |
| 43 | 4.（兜）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_helm` | variant | 643,608 B | 1253×1699 | OK |
| 44 | 4.（角）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_horn` | variant | 674,641 B | 1253×1699 | OK |
| 45 | 3.スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_plain` | variant | 617,150 B | 1253×1699 | OK |
| 46 | 3.（腕）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_arm` | variant | 966,621 B | 1253×1699 | OK |
| 47 | 3.（兜）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_helm` | variant | 642,327 B | 1253×1699 | OK |
| 48 | 3.（角）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_horn` | variant | 674,686 B | 1253×1699 | OK |
| 49 | 2.スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_plain` | variant | 608,098 B | 1253×1699 | OK |
| 50 | 2.（腕）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_arm` | variant | 957,926 B | 1253×1699 | OK |
| 51 | 2.（兜）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_helm` | variant | 632,672 B | 1253×1699 | OK |
| 52 | 2.（角）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_horn` | variant | 665,551 B | 1253×1699 | OK |
| 53 | 1.スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_plain` | primary | 598,746 B | 1253×1699 | OK |
| 54 | 1.（腕）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_arm` | primary | 948,358 B | 1253×1699 | OK |
| 55 | 1.（兜）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_helm` | primary | 623,242 B | 1253×1699 | OK |
| 56 | 1.（角）スケルトン.png | 全データ_スケルトン | skeleton | `skeleton_horn` | primary | 656,277 B | 1253×1699 | OK |
| 57 | 4.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_magic` | variant | 1,270,781 B | 1150×1550 | OK |
| 58 | 4.杖_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_staff` | variant | 1,208,912 B | 1150×1550 | OK |
| 59 | 4.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_both` | variant | 1,364,090 B | 1150×1550 | OK |
| 60 | 4.グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_plain` | variant | 1,113,516 B | 1150×1550 | OK |
| 61 | 3.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_magic` | variant | 1,312,501 B | 1150×1550 | OK |
| 62 | 3.杖_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_staff` | variant | 1,251,038 B | 1150×1550 | OK |
| 63 | 3.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_both` | variant | 1,406,950 B | 1150×1550 | OK |
| 64 | 3.グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_plain` | variant | 1,155,820 B | 1150×1550 | OK |
| 65 | 2.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_magic` | variant | 1,306,172 B | 1150×1550 | OK |
| 66 | 2.杖_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_staff` | variant | 1,242,980 B | 1150×1550 | OK |
| 67 | 2.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_both` | variant | 1,399,667 B | 1150×1550 | OK |
| 68 | 2.グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_plain` | variant | 1,147,845 B | 1150×1550 | OK |
| 69 | 1.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_magic` | primary | 1,253,016 B | 1150×1550 | OK |
| 70 | 1.杖_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_staff` | primary | 1,191,075 B | 1150×1550 | OK |
| 71 | 1.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_both` | primary | 1,346,300 B | 1150×1550 | OK |
| 72 | 1.グレーターデーモン.png | 全データ_グレーターデーモン (A) | greater | `greater_plain` | primary | 1,095,500 B | 1150×1550 | OK |
| 73 | 4.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_magic` | duplicate | 1,270,781 B | 1150×1550 | OK |
| 74 | 4.杖_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_staff` | duplicate | 1,208,912 B | 1150×1550 | OK |
| 75 | 4.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_both` | duplicate | 1,364,090 B | 1150×1550 | OK |
| 76 | 4.グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_plain` | duplicate | 1,113,516 B | 1150×1550 | OK |
| 77 | 3.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_magic` | duplicate | 1,312,501 B | 1150×1550 | OK |
| 78 | 3.杖_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_staff` | duplicate | 1,251,038 B | 1150×1550 | OK |
| 79 | 3.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_both` | duplicate | 1,406,950 B | 1150×1550 | OK |
| 80 | 3.グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_plain` | duplicate | 1,155,820 B | 1150×1550 | OK |
| 81 | 2.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_magic` | duplicate | 1,306,172 B | 1150×1550 | OK |
| 82 | 2.杖_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_staff` | duplicate | 1,242,980 B | 1150×1550 | OK |
| 83 | 2.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_both` | duplicate | 1,399,667 B | 1150×1550 | OK |
| 84 | 2.グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_plain` | duplicate | 1,147,845 B | 1150×1550 | OK |
| 85 | 1.魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_magic` | duplicate | 1,253,016 B | 1150×1550 | OK |
| 86 | 1.杖_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_staff` | duplicate | 1,191,075 B | 1150×1550 | OK |
| 87 | 1.杖&魔法_グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_both` | duplicate | 1,346,300 B | 1150×1550 | OK |
| 88 | 1.グレーターデーモン.png | 全データ_グレーターデーモン (B) | greater | `greater_plain` | duplicate | 1,095,500 B | 1150×1550 | OK |
| 89 | 4.ウィッカーマン.png | 全カラー_ウィッカーマン | wickerman | `wickerman` | variant | 1,447,535 B | 1275×1753 | OK |
| 90 | 3.ウィッカーマン.png | 全カラー_ウィッカーマン | wickerman | `wickerman` | variant | 1,466,080 B | 1275×1753 | OK |
| 91 | 2.ウィッカーマン.png | 全カラー_ウィッカーマン | wickerman | `wickerman` | variant | 1,470,198 B | 1275×1753 | OK |
| 92 | 1.ウィッカーマン.png | 全カラー_ウィッカーマン | wickerman | `wickerman` | primary | 1,373,731 B | 1275×1753 | OK |
| 93 | 4.ゲイザー.png | 全カラー_ゲイザー (A) | gazer | `gazer` | variant | 1,899,529 B | 1275×1753 | OK |
| 94 | 3.ゲイザー.png | 全カラー_ゲイザー (A) | gazer | `gazer` | variant | 1,889,288 B | 1275×1753 | OK |
| 95 | 2.ゲイザー.png | 全カラー_ゲイザー (A) | gazer | `gazer` | variant | 1,888,364 B | 1275×1753 | OK |
| 96 | 1.ゲイザー.png | 全カラー_ゲイザー (A) | gazer | `gazer` | primary | 1,873,911 B | 1275×1753 | OK |
| 97 | 4.ゲイザー.png | 全カラー_ゲイザー (B) | gazer | `gazer` | duplicate | 1,899,529 B | 1275×1753 | OK |
| 98 | 3.ゲイザー.png | 全カラー_ゲイザー (B) | gazer | `gazer` | duplicate | 1,889,288 B | 1275×1753 | OK |
| 99 | 2.ゲイザー.png | 全カラー_ゲイザー (B) | gazer | `gazer` | duplicate | 1,888,364 B | 1275×1753 | OK |
| 100 | 1.ゲイザー.png | 全カラー_ゲイザー (B) | gazer | `gazer` | duplicate | 1,873,911 B | 1275×1753 | OK |
| 101 | 4.アークデーモン.png | 全カラー_アークデーモン (A) | archdemon | `archdemon` | variant | 1,546,867 B | 1253×1753 | OK |
| 102 | 3.アークデーモン.png | 全カラー_アークデーモン (A) | archdemon | `archdemon` | variant | 1,545,155 B | 1253×1753 | OK |
| 103 | 2.アークデーモン.png | 全カラー_アークデーモン (A) | archdemon | `archdemon` | variant | 1,606,712 B | 1253×1753 | OK |
| 104 | 1.アークデーモン.png | 全カラー_アークデーモン (A) | archdemon | `archdemon` | primary | 1,536,100 B | 1253×1753 | OK |
| 105 | 4.アークデーモン.png | 全カラー_アークデーモン (B) | archdemon | `archdemon` | duplicate | 1,546,867 B | 1253×1753 | OK |
| 106 | 3.アークデーモン.png | 全カラー_アークデーモン (B) | archdemon | `archdemon` | duplicate | 1,545,155 B | 1253×1753 | OK |
| 107 | 2.アークデーモン.png | 全カラー_アークデーモン (B) | archdemon | `archdemon` | duplicate | 1,606,712 B | 1253×1753 | OK |
| 108 | 1.アークデーモン.png | 全カラー_アークデーモン (B) | archdemon | `archdemon` | duplicate | 1,536,100 B | 1253×1753 | OK |
| 109 | 4.スペクター.png | 全カラー_スペクター | specter | `specter` | variant | 1,232,383 B | 1500×1275 | OK |
| 110 | 3.スペクター.png | 全カラー_スペクター | specter | `specter` | variant | 1,291,811 B | 1500×1275 | OK |
| 111 | 2.スペクター.png | 全カラー_スペクター | specter | `specter` | variant | 1,252,849 B | 1500×1275 | OK |
| 112 | 1.スペクター.png | 全カラー_スペクター | specter | `specter` | primary | 1,224,914 B | 1500×1275 | OK |
| 113 | 4.レイス.png | 全カラー_レイス | wraith | `wraith` | variant | 1,220,195 B | 1747×1275 | OK |
| 114 | 3.レイス.png | 全カラー_レイス | wraith | `wraith` | variant | 1,254,325 B | 1747×1275 | OK |
| 115 | 2.レイス.png | 全カラー_レイス | wraith | `wraith` | variant | 1,207,505 B | 1747×1275 | OK |
| 116 | 1.レイス.png | 全カラー_レイス | wraith | `wraith` | primary | 1,196,469 B | 1747×1275 | OK |
| 117 | 4.デーモンファウンダー.png | 全カラー_デーモンファウンダー (A) | founder | `founder` | variant | 1,826,931 B | 1720×1237 | OK |
| 118 | 3.デーモンファウンダー.png | 全カラー_デーモンファウンダー (A) | founder | `founder` | variant | 1,831,362 B | 1720×1237 | OK |
| 119 | 2.デーモンファウンダー.png | 全カラー_デーモンファウンダー (A) | founder | `founder` | variant | 1,803,293 B | 1720×1237 | OK |
| 120 | 1.デーモンファウンダー.png | 全カラー_デーモンファウンダー (A) | founder | `founder` | primary | 1,860,722 B | 1720×1237 | OK |
| 121 | 4.デーモンファウンダー.png | 全カラー_デーモンファウンダー (B) | founder | `founder` | duplicate | 1,826,931 B | 1720×1237 | OK |
| 122 | 3.デーモンファウンダー.png | 全カラー_デーモンファウンダー (B) | founder | `founder` | duplicate | 1,831,362 B | 1720×1237 | OK |
| 123 | 2.デーモンファウンダー.png | 全カラー_デーモンファウンダー (B) | founder | `founder` | duplicate | 1,803,293 B | 1720×1237 | OK |
| 124 | 1.デーモンファウンダー.png | 全カラー_デーモンファウンダー (B) | founder | `founder` | duplicate | 1,860,722 B | 1720×1237 | OK |
| 125 | 4.サキュバス.png | 全カラー_サキュバス (A) | succubus | `succubus` | variant | 1,350,742 B | 1600×1275 | OK |
| 126 | 3.サキュバス.png | 全カラー_サキュバス (A) | succubus | `succubus` | variant | 1,348,784 B | 1600×1275 | OK |
| 127 | 2.サキュバス.png | 全カラー_サキュバス (A) | succubus | `succubus` | variant | 1,341,482 B | 1600×1275 | OK |
| 128 | 1.サキュバス.png | 全カラー_サキュバス (A) | succubus | `succubus` | primary | 1,351,609 B | 1600×1275 | OK |
| 129 | 4.サキュバス.png | 全カラー_サキュバス (B) | succubus | `succubus` | duplicate | 1,350,742 B | 1600×1275 | OK |
| 130 | 3.サキュバス.png | 全カラー_サキュバス (B) | succubus | `succubus` | duplicate | 1,348,784 B | 1600×1275 | OK |
| 131 | 2.サキュバス.png | 全カラー_サキュバス (B) | succubus | `succubus` | duplicate | 1,341,482 B | 1600×1275 | OK |
| 132 | 1.サキュバス.png | 全カラー_サキュバス (B) | succubus | `succubus` | duplicate | 1,351,609 B | 1600×1275 | OK |
| 133 | 4.シェイド.png | 全カラー_シェイド | shade | `shade` | variant | 1,837,101 B | 1400×1753 | OK |
| 134 | 3.シェイド.png | 全カラー_シェイド | shade | `shade` | variant | 2,083,326 B | 1400×1753 | OK |
| 135 | 2.シェイド.png | 全カラー_シェイド | shade | `shade` | variant | 2,080,960 B | 1400×1753 | OK |
| 136 | 1.シェイド.png | 全カラー_シェイド | shade | `shade` | primary | 2,051,179 B | 1400×1753 | OK |
| 137 | 4.インキュバス.png | 全データ_ダウンロード / インキュバス | incubus | `incubus` | variant | 1,794,821 B | 1264×1600 | OK |
| 138 | 3.インキュバス.png | 全データ_ダウンロード / インキュバス | incubus | `incubus` | variant | 1,750,825 B | 1264×1600 | OK |
| 139 | 2.インキュバス.png | 全データ_ダウンロード / インキュバス | incubus | `incubus` | variant | 1,795,563 B | 1264×1600 | OK |
| 140 | 1.インキュバス.png | 全データ_ダウンロード / インキュバス | incubus | `incubus` | primary | 1,770,751 B | 1264×1600 | OK |
| 141 | レッサーデーモン4.png | 全カラー_レッサーデーモン | lesser | `lesser` | variant | 1,200,698 B | 1064×1731 | OK |
| 142 | レッサーデーモン3.png | 全カラー_レッサーデーモン | lesser | `lesser` | variant | 1,086,412 B | 1064×1731 | OK |
| 143 | レッサーデーモン2.png | 全カラー_レッサーデーモン | lesser | `lesser` | variant | 1,110,560 B | 1064×1731 | OK |
| 144 | レッサーデーモン.png | 全カラー_レッサーデーモン | lesser | `lesser` | primary | 1,116,514 B | 1064×1731 | OK |
| 145 | 4.ゴブリンジパング.png | ゴブリンジャパン | goblin_japan | `goblin_japan` | variant | 1,029,741 B | 1350×1650 | OK |
| 146 | 3.ゴブリンジパング.png | ゴブリンジャパン | goblin_japan | `goblin_japan` | variant | 1,026,415 B | 1350×1650 | OK |
| 147 | 2.ゴブリンジパング.png | ゴブリンジャパン | goblin_japan | `goblin_japan` | variant | 1,044,166 B | 1350×1650 | OK |
| 148 | 1.ゴブリンジパング.png | ゴブリンジャパン | goblin_japan | `goblin_japan` | primary | 1,010,461 B | 1350×1650 | OK |
| 149 | 4.ゴブリンシャーマン.png | ゴブリンシャーマン | goblin_shaman | `goblin_shaman` | variant | 555,373 B | 650×1089 | OK |
| 150 | 3.ゴブリンシャーマン.png | ゴブリンシャーマン | goblin_shaman | `goblin_shaman` | variant | 557,483 B | 650×1089 | OK |
| 151 | 2.ゴブリンシャーマン.png | ゴブリンシャーマン | goblin_shaman | `goblin_shaman` | variant | 563,019 B | 650×1089 | OK |
| 152 | 1.ゴブリンシャーマン.png | ゴブリンシャーマン | goblin_shaman | `goblin_shaman` | primary | 556,538 B | 650×1089 | OK |
| 153 | ホブゴブリン4.png | ホブゴブリン | hobgoblin | `hobgoblin` | variant | 1,099,976 B | 1188×1477 | OK |
| 154 | ホブゴブリン3.png | ホブゴブリン | hobgoblin | `hobgoblin` | variant | 1,061,873 B | 1188×1477 | OK |
| 155 | ホブゴブリン2.png | ホブゴブリン | hobgoblin | `hobgoblin` | variant | 1,066,134 B | 1188×1477 | OK |
| 156 | ホブゴブリン.png | ホブゴブリン | hobgoblin | `hobgoblin` | primary | 1,066,777 B | 1188×1477 | OK |
| 157 | 4.ゴブリンアーチャー.png | ゴブリンアーチャー | goblin_archer | `goblin_archer` | variant | 937,936 B | 1275×1600 | OK |
| 158 | 3.ゴブリンアーチャー.png | ゴブリンアーチャー | goblin_archer | `goblin_archer` | variant | 988,775 B | 1275×1600 | OK |
| 159 | 2.ゴブリンアーチャー.png | ゴブリンアーチャー | goblin_archer | `goblin_archer` | variant | 1,003,458 B | 1275×1600 | OK |
| 160 | 1.ゴブリンアーチャー.png | ゴブリンアーチャー | goblin_archer | `goblin_archer` | primary | 987,120 B | 1275×1600 | OK |
| 161 | 4.ノーライフクイーン.png | 全カラー_ノーライフキング | no_life_king | `no_life_king` | variant | 1,438,676 B | 1275×1753 | OK |
| 162 | 3.ノーライフクイーン.png | 全カラー_ノーライフキング | no_life_king | `no_life_king` | variant | 1,438,243 B | 1275×1753 | OK |
| 163 | 2.ノーライフクイーン.png | 全カラー_ノーライフキング | no_life_king | `no_life_king` | variant | 1,444,266 B | 1275×1753 | OK |
| 164 | 1.ノーライフクイーン.png | 全カラー_ノーライフキング | no_life_king | `no_life_king` | primary | 1,404,855 B | 1275×1753 | OK |
| 165 | ゴブリンキング4.png | ゴブリンキング | goblin_king | `goblin_king` | variant | 1,015,219 B | 869×1569 | OK |
| 166 | ゴブリンキング3.png | ゴブリンキング | goblin_king | `goblin_king` | variant | 972,095 B | 869×1569 | OK |
| 167 | ゴブリンキング2.png | ゴブリンキング | goblin_king | `goblin_king` | variant | 944,188 B | 869×1569 | OK |
| 168 | ゴブリンキング.png | ゴブリンキング | goblin_king | `goblin_king` | primary | 932,558 B | 869×1569 | OK |
| 169 | 4.ヴァンパイア.png | 全カラー_ヴァンパイア | vampire | `vampire` | variant | 1,444,632 B | 1275×1500 | OK |
| 170 | 3.ヴァンパイア.png | 全カラー_ヴァンパイア | vampire | `vampire` | variant | 1,411,999 B | 1275×1500 | OK |
| 171 | 2.ヴァンパイア.png | 全カラー_ヴァンパイア | vampire | `vampire` | variant | 1,413,219 B | 1275×1500 | OK |
| 172 | 1.ヴァンパイア.png | 全カラー_ヴァンパイア | vampire | `vampire` | primary | 1,391,654 B | 1275×1500 | OK |
| 173 | 4.ガーゴイル.png | 全カラー_ガーゴイル | gargoyle | `gargoyle` | variant | 1,424,199 B | 1499×1242 | OK |
| 174 | 3.ガーゴイル.png | 全カラー_ガーゴイル | gargoyle | `gargoyle` | variant | 1,398,851 B | 1499×1242 | OK |
| 175 | 2.ガーゴイル.png | 全カラー_ガーゴイル | gargoyle | `gargoyle` | variant | 1,379,806 B | 1499×1242 | OK |
| 176 | 1.ガーゴイル.png | 全カラー_ガーゴイル | gargoyle | `gargoyle` | primary | 1,410,679 B | 1499×1242 | OK |
| 177 | ゴブリン・チャリオッツ.png | ゴブリン・チャリオッツ | chariots | `chariots` | primary | 2,126,780 B | 1726×1215 | OK |
| 178 | cfbad317d088e375e71d6df408c215d9.zip | (直下 / ZIP) | wraith | `wraith` | archive | 4,838,855 B | 0×0 | OK |
| 179 | c25633b927e784671ddb0504626baf7b.zip | (直下 / ZIP) | jack | `jack` | archive | 5,842,383 B | 0×0 | OK |
| 180 | 41f31b9ae9e7f76877456493ba309327.zip | (直下 / ZIP) | phantom | `phantom` | archive | 3,009,133 B | 0×0 | OK |

> `role`: `primary` = その敵の代表画像 / `variant` = 色違い / `duplicate` = 別フォルダの同一バイト再掲 / `archive` = ZIP。
> 元ファイルは `assets/enemies/source/<DriveID>.png` にそのまま保存され、変換・再圧縮・改名・加工は一切行っていません。
> `assets/enemies/<敵ID>.png` は代表画像をバイト単位でコピーした配信用ファイルです（元画像と同一内容）。
> アプリの既定表示はこの配信用 PNG、色違い切り替え時は `assets/enemies/source/` の別ファイルをそのまま参照します。
> `assets/enemies/source/` は大容量の原本置き場のため Git 管理外とし、全ファイルの Drive ID・SHA256・対応敵は本台帳で管理します。
