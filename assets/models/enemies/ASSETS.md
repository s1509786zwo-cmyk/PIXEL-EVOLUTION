# 敵キャラクター用 外部3Dアセット

このディレクトリの `.glb` は **実際に取得した外部アセットのバイナリ** です。
自作の図形・プレースホルダー・色違いではありません。形状・色・テクスチャ・
リグ・アニメーションは取得したファイルのものをそのまま使用し、
ゲーム側で変更しているのは「カメラに合わせた一様な拡大縮小」「向き」「接地位置」
だけです。

## 取得元と利用許諾

| パック | 作者 | ライセンス | 原本 |
| --- | --- | --- | --- |
| Ultimate Monsters (October 2022) | Quaternius | **CC0 1.0 Universal (Public Domain)** | https://quaternius.com/packs/ultimatemonsters.html |
| Cute Animated Monsters Pack | Quaternius | **CC0 1.0 Universal (Public Domain)** | https://quaternius.com/packs/cutemonsters.html |
| Adventurers Character Pack (2.0) | Kay Lousberg / KayKit | **CC0 1.0 (商用利用可)** | https://kaylousberg.com/ |
| Skeletons Character Pack | Kay Lousberg / KayKit | **CC0 1.0 (商用利用可)** | https://kaylousberg.com/ |

CC0 1.0 は著作権者が権利を放棄しており、ゲーム内利用・改変・再配布・商用利用が
認められています（クレジット表記は任意）。原本のライセンス文は
`licenses/quaternius_cc0.txt`, `licenses/kk_abenteurer.txt`,
`licenses/kk_skelette.txt` に同梱しています。出典一覧は
`licenses/CREDITS-upstream.md` を参照してください。

実バイナリの取得には GitHub の CC0 アセット館
`https://github.com/Tulkor/TDHub` (`assets/models/pakete/...`) を使いました。
同リポジトリの `assets/models/CREDITS.md` は全パックが CC0 であることを明記しています。
各 `.glb` が参照する共有パレットテクスチャは `texturen/` にそのまま配置しています。

描画には three.js r160 (`https://www.npmjs.com/package/three`, MIT) を
`js/three.module.js` / `js/three.GLTFLoader.js` /
`js/three.BufferGeometryUtils.js` として同梱しています。ライセンスは
`assets/models/enemies/LICENSE-three.txt` です。

## ファイル一覧

| ファイル | 元パック / モデル名 | 形式 | 用途（ゲーム内） | テクスチャ | リグ | アニメーション |
| --- | --- | --- | --- | --- | --- | --- |
| `big_demon.glb` | Ultimate Monsters / Big Demon | GLB 2.0 (binary glTF) | 悪魔 | 共有アトラス PNG / 1 マテリアル | Skinned | Death, Duck, HitReact, Idle, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Walk, Wave, Weapon, Yes |
| `big_alien.glb` | Ultimate Monsters / Big Alien | GLB 2.0 | 怪物 | 共有アトラス PNG / 1 マテリアル | Skinned | 上と同じ 14 クリップ |
| `flying_hywirl.glb` | Ultimate Monsters / Hywirl | GLB 2.0 | 天使相当（翼を持つ浮遊型） | 共有アトラス PNG / 1 マテリアル | Skinned | Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes |
| `flying_dragon.glb` | Ultimate Monsters / Flying Dragon | GLB 2.0 | 竜 | 共有アトラス PNG / 1 マテリアル | Skinned | Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes |
| `flying_ghost_skull.glb` | Ultimate Monsters / Flying Ghost Skull | GLB 2.0 | 死神 | 共有アトラス PNG / 1 マテリアル | Skinned | Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes |
| `flying_goleling.glb` | Ultimate Monsters / Goleling | GLB 2.0 | 古代の守護者 | 共有アトラス PNG / 1 マテリアル | Skinned | Death, Fast_Flying, Flying_Idle, Headbutt, HitReact, No, Punch, Yes |
| `big_mushroom_king.glb` | Ultimate Monsters / Mushroom King | GLB 2.0 | 巨人 | 共有アトラス PNG / 1 マテリアル | Skinned | 上記 14 クリップ |
| `cthulhu.glb` | Cute Animated Monsters / Cthulhu | GLB 2.0 | 深海の異形 | 共有アトラス PNG / 1 マテリアル | Skinned | Bite_Front, Death, Flying, HitRecieve |
| `knight.glb` | KayKit Adventurers / Knight | GLB 2.0 | 堕ちた聖騎士 | 共有アトラス PNG / 1 マテリアル | Skinned | クリップ同梱なし（待機ポーズ） |
| `skeleton_mage.glb` | KayKit Skeletons / Skeleton Mage | GLB 2.0 | 死者の魔導士 | 共有アトラス PNG / 2 マテリアル | Skinned | クリップ同梱なし（待機ポーズ） |

`texturen/*.png` は各 GLB の `images[].uri` が指す共有パレットテクスチャです。
GLTFLoader が GLB からの相対パスで読み込みます。

## 天使モデルについて（正直な注記）

利用許諾を確認できた取得先（GitHub / npm）には **純粋な「天使」の CC0 3D モデルは
ありませんでした**。そのため「天使」枠には上記の `flying_hywirl.glb`
（翼を持つ浮遊型の人型モンスター）を **「堕天使／天翔る使徒」という別シルエットの敵**
として割り当てています。天使そのものを名乗るモデルではなく、仮の図形でもありません。
本物の天使モデルが必要な場合は、例えば下記のような CC0 / CC-BY のモデルを
`assets/models/enemies/angel.glb` として追加し、`js/enemy3d.js` の
`ENEMY_MODELS.angel.file` を差し替えてください。

- https://quaternius.com/packs/ultimatemonsters.html （CC0、天使は未収録）
- https://poly.pizza/ （CC0 / CC-BY の 3D モデル。要個別の利用許諾確認）
