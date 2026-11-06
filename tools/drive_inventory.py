# -*- coding: utf-8 -*-
"""Google Drive「敵キャラ」フォルダの全ファイル台帳（実 ID のみ）。

フォルダ ID: 11SJbYwo1hMgPnoaIrcnUHABGVzmparkI
直下 33 フォルダ → 各 1 つの日本語名サブフォルダ（＝敵の種類）→ PNG。
重複してアップロードされた同名フォルダ (1) も別 ID として全件記録する。
"""
import json, os, hashlib

ROOT = '11SJbYwo1hMgPnoaIrcnUHABGVzmparkI'

# (ハッシュフォルダID, 日本語サブフォルダID, サブフォルダ名, 敵Kind, [(ファイル名, Drive ID), ...])
def p4(base, ids):
    """4.,3.,2.,1.<base>.png の順"""
    return [(f'{i}.{base}.png', x) for i, x in zip([4, 3, 2, 1], ids)]

def s4(base, ids):
    """<base>4.png, 3, 2, <base>.png の順"""
    return [(f'{base}{i}.png' if i else f'{base}.png', x) for i, x in zip([4, 3, 2, 0], ids)]

def s3(base, ids):
    """<base>3.png, 2, 1, <base>.png の順（ゴブリン武器）"""
    return [(f'{base}{i}.png' if i else f'{base}.png', x) for i, x in zip([3, 2, 1, 0], ids)]

def skel(base, ids):
    """4色 × [素体, (腕), (兜), (角)] の 16 枚"""
    out = []
    for i in [4, 3, 2, 1]:
        for j, suf in enumerate(['', '（腕）', '（兜）', '（角）']):
            out.append((f'{i}.{suf}{base}.png', ids[(4 - i) * 4 + j]))
    return out

def demon(base, ids):
    """4色 × [魔法_, 杖_, 杖&魔法_, 素体] の 16 枚"""
    out = []
    for i in [4, 3, 2, 1]:
        for j, pre in enumerate(['魔法_', '杖_', '杖&魔法_', '']):
            out.append((f'{i}.{pre}{base}.png', ids[(4 - i) * 4 + j]))
    return out

GROUPS = [
 ('1DHSy1YzxouWmGDyFrUKSDUDsfjkAXXUf', '12dJkvqJtLMpzakazLwMSDOp8uCV-E756', 'インプ (A)', 'imp',
  p4('インプ', ['1RdPp9TUu6eEFIa40DLk3RojFdB_Mq2re','1Wnw_9eZK4JCYM2qmJ6k0AV2kDGDnM6FH','1MNC0daFqe-jKp2wOTigx3D1ebGExSDSC','1tdIEJ9CKKAjeJcnEFpp8xPnAXuMYFBXM'])),
 ('17zO4u2i8fOy6b4YJ9QXSBRWAMtWdGHwZ', '19w4_4IxNGt2JOdcw2u7iDq5zfUjhXVTM', 'インプ (B)', 'imp',
  p4('インプ', ['1fDt_dnGFN3hnKoFIwUrAvwjg3umTzXwD','1E6aIW6OXy9i_ln67qEPlckxcI8MRi0Gw','1fowjTHhb0i12jdgVGwtJ85fYl089hc2D','19vaJOH-UuDg5AAnSo6HCtY5p_92rqY1x'])),
 ('1ktymYfRPj4ozSt2o27dcjfwCUo_wfOY-', '1n9rrXsRbDd3oE0eoMTOpJPwRzNuXRi34', 'ゴブリン', 'goblin',
  s3('ゴブリン_棍棒', ['1mFFarhShWDXbL3oSjGBzh3ILKVWSd741','1-7y-HB7VCl6NRpyiyckZOkiqXy1AS8vS','1Sd0Sk5N-ml34tHcBRcE0sKGxob9PLEO1','1trwdEMgLERN6r_RMkhGAimEbKqOd7n2I'])
  + s3('ゴブリン_斧', ['1nsNEFKYF3VNWNFc3xItLiFu33fvk-xZL','197ygeAcKFwhW5ePgXgaRGPY7lnUuSXpG','1oUdaDl_l7tD9dWncT77x7iaV-YFmodEZ','1vAheawFvbvdGb9l9Sc479y2VsVRLWGQw'])
  + s3('ゴブリン_剣', ['1_oOpxKPLMmkHRR9lUY6LRWfM3EoGfyh6','1PDVu1agPNWyDN37s3UyQOTvH_OHm2XOh','1XHgHa71JDel8zMVimxa1IQAeUGbNuf51','1Sf77knWA3fbE_I-8cP8-2L_lkICzh1wD'])
  + s3('ゴブリン_弓', ['1H6ceVuYP7j92AmJkeQBfn3BPALTQx8R5','1UqreksrL__KXvNr9qRpKaaLSFYnlFM9P','1fWcRQUosdskd_qNWY2ISmZONZaUm8gsu','1ToKKbcdmrFGedDNth0g1Yg7e_QQGcsJ-'])),
 ('1uYISFPnK_Z7YUuU_-kDOHKQx1cXmqq4v', '1H5au_q3TqE73iBQP56raKlz2HuroGrTd', '全カラー_リッチ_男', 'lich_m',
  p4('リッチ_男', ['12onljfEwgvD_RkjlCO_P6dTW6Ed1rdNS','1arTTfsZtv1Lbqhz_PBGNJHnqzaT9BkAy','12wAiXbZ6MKtdOCvyD4gsUPK-6cIWOZWX','1-4XtoV8WaHnpyW8gI7Du7Eu0PelWr2Mj'])),
 ('17A5iYcIhVyvF6_GmKTR7M4bEKx6fc6ee', '1-hMNZ6oX21XCZJI3-vsqSVGXrBWi2mGL', '全カラー_リッチ_女', 'lich_f',
  p4('リッチ_女', ['11bZFbuVMld_Pb2nVKMSX9aOdMRfi2yC6','17VXZ-sDxiWBYKMrYyv2D4dXAa-rxv75F','1Js_HPX0ZA4GiVoNwFgFPfWebwV_LpEjw','1gdYf_9T_Etb411vTXfeL4cZyelR3QD4g'])),
 ('1imJHMjEhKoyDdcw8WGIHy4oV1wbyJhaq', '1AUNoVCYgwmds1kE553QayCov2lfl0kFp', '全カラー_ファントム', 'phantom',
  p4('ファントム', ['1FkubVPrj8gr1TuPWq_dQp9E1GaXM8Xbt','1lFyo86HQBjtSvZlKhL1xOC6RKyX_RRRe','1l2NiAcH69OG0QaUa4YrU3ih7kUhMjhsY','1S-hkECGj1AfZHPInUR-ov7PWURuQCLXB'])),
 ('1FbeEia5oFMZVQvT99G-067Xbhem1fmZJ', '1Wc5tkeslKv2vbGeF_RYsNeYESSS45FlA', '全カラー_ジャックランタン', 'jack',
  p4('ジャックランタン', ['1BbhGNW2LqAQJdCOe7_2_uZXHIs_KxKC6','1RPvQ6BUvUvDwSetT9v6X_LpYq7Szlqcq','1z8RsButkftzMX23e9SK2Z2FMLwbNsd7T','1CZZ8yjRi7RnR2axJe1aT4AeyKOSuN1cC'])),
 ('1vlG1lJd4aOXGEyqVB5P3blCkIk1SaRqw', '1qF5DjJl2T3TLdfJNlsNao8XDe3RBlphU', '全データ_スケルトン', 'skeleton',
  skel('スケルトン', ['1ODLIewrR3Yaz2JcKYcueV_u1YoOQWurP','1S0LaIUuiKtTKR4b_W_6QxhfKXvkjcCVF','1u4bLZfA37ilyFZocU2eHIgr_b1EbxiHB','1_Ck0buJPMZoW42qFbgnOdPUw2pqXIcTd',
                  '1r0_QP_CJP648OiLaQ0sL5swh-AqrSZDq','1PnRTKFeBxQHIpmzk8rHdSPX_YxsgPcSX','1l3jUs2OVTRo4-IG5ll9HGvRC3DQ6BeO3','1yHwGXrp6cfZQR1cPsk5cua83mi37Tupx',
                  '1pJfk8OiBRWpFzAo8yFDKzgn-_epJF9mM','1p0km4Hz1Va4EYnliPvQnB96pVBclB6Uq','1CT9gyprzjjlk3Em6Aw6blvOCV7BXMK3R','1y4UnyB9Tjtl1ShikyoXgJAfDxp9MtPID',
                  '1yP8KBJn5pYS8Fr62RrCyoYjagWZDFl6w','1avI3-xfKAInpIBrX9YNXQss280TUjmtq','1c5jphhb5tl_TTHzMPiKlh4ywXARfF5cD','1wbJTUP1k0Cv11cRKlBEklkrAEz_T1VVA'])),
 ('1YVjChVXwATe1UnRnke4J-NGDAt8kb25A', '1pXxwXbeUQNDHGFBdl1hoCuxVt2AkP8LE', '全データ_グレーターデーモン (A)', 'greater',
  demon('グレーターデーモン', ['1isc9uka2EkqSDA111wHRm-j9fkfIFF2W','1L7PJpt9LmDD2haAtqMtitgmjnkVOxxcA','1c-L-KXJoIdjR6cY5f6ndoeU7Ukl98KlZ','1uRm9Q0Swkc109-BUD0cQ1TVT_nY3nIC2',
                     '1Sbambd8q_qBPOExutylDtmoMhuGrsVM3','1ReCoxZKiDpKQ84iWxykZ22_Pv0pIm7lD','1pb544PPgZrn236bJ_g13O5D0U76Fx10C','1UOYwxeJA44aJr9zHkMlKAvb9u9qwdTwd',
                     '19lMG_UCU1nOc3hgR9oHweuav3R3PgM8N','1gDuhz6wjFs2YEhZm9MnP-13rNN3bMhAt','1gWYnMDjUABUnw2cpHgfEpOtO7jhYG5c2','1MLxn3PgNLsppbaxGnXFV3mzsTpkSkZHx',
                     '1eLa_ViYNKJfniryQg63ETz2CRMMpSO6u','13hA_Evg96eAM2Nyep23Bv2IQF28AUQLT','1wYeYpJqGWSBeTzOr-4n99l1Tz-GdHrKU','130YvF6lYu_TLpyo3pfV91Lwe6E3XhLTj'])),
 ('1q-T0_o_jQziFNcuK3nXcgAAhU_elZP6e', '1LiN9ewAJKyjbfOnkRzhz05DGhAEMReRw', '全データ_グレーターデーモン (B)', 'greater',
  demon('グレーターデーモン', ['1IUNlF5qIfiPsdPwkcgq5TYEQNhNG0H2R','1MNMAywUHBlLKoIM68RNh6LlX9VXYpBG_','1vpC3zsUCb1yBMwlhSxsLUE1ovWkfXHb_','1fdF1Q4o7yyhl6R7_dRePdmCwVh_Swop2',
                     '1v3cS_PtHM7Yx9-93Hpm_lhCBsLa8EFr_','12KzjQO7udAHy6hmI7dQtLqA2QLgIs8nV','17QPo6cKgS-GKsepSxPkdZga8a-gYNLOW','1RtR9v8uHbqK_FPSLjk4KDbDr9YPf8gRD',
                     '1oPo_9JQTUBfDQzjIVQcTgRykuKddBY_q','1AsLvUNpAUgrmF6BhtiWXBeWT1mBD-AqD','1iTKlO3JGfMs0Pa1UFiUf3qOxDjfDOxAU','1xXfpWfCaCsJbJrNbHPsjbfy7I75UkKuj',
                     '1cOzJlMBBk9_Z_vwQESvwUNVN-1n39wO9','19tAm-TivhAuZ6nIsjyUzgXnZ14RhtboH','1110VrFbkvYh4m7Wshwi16mjNNt08FFer','1ORAGXykudHAgMA0dTcKs88g0MJLPdfW0'])),
 ('1KRZHiGrxpz2ILo_V1kdtCcLN1pWn4KwC', '1PNdfaxUoAEQp_olGCaGCPawIQIw-Uoiy', '全カラー_ウィッカーマン', 'wickerman',
  p4('ウィッカーマン', ['1UK7BeF3lYz7RmYvEPJeJlTcN_AONTO-Z','1JOapUQ5TIeZY9kp6rRMSyv2drwzqMRdK','1UszoDsm9WdcCX0noG7LAtmeGTzfvgJCi','1kcruGYahDwklHPqPdgrnzKkoxHLXbeF-'])),
 ('1OICEtm5IEvocykXxdSE0thomdjXaNdRv', '1pGyQgU98zPrh9o0Mz0vz-9BrcYoVGZ3e', '全カラー_ゲイザー (A)', 'gazer',
  p4('ゲイザー', ['1T4V0O_gNzjhU69WSVB04j_4mCKoQd4rq','1KjdqWheBp5HpSu70L-XIHpzJKWSs4opN','1obkKBCGtuLchcTXyRvds-4GxmxSIcve-','1ndgovC8aRN1KslaeXt6d6-Rq9SdX2fP0'])),
 ('11jud_291vF94cjebMKqC9YfLisuUFP5b', '1d67IJpAo8SY2LQ9_Li48m8VhXcdFw6Is', '全カラー_ゲイザー (B)', 'gazer',
  p4('ゲイザー', ['1zoJ4Cxcbn39zkak8LBnB5IYT_GIrzTp6','1uAooOiYWCQKi2RaHxnX4zsJDSuxOn8TY','1kQzCnPxICOckHRJKBa1TJak08juHAoe7','1L7q2jw2TaeO-0qG8h0aKn5duFg410ud_'])),
 ('1TiKxBT4wHvvRR7XSUH-0Te-ftftlqlE6', '1mISuQLnn1InlCszSV8EcpHC-MIv1s7P2', '全カラー_アークデーモン (A)', 'archdemon',
  p4('アークデーモン', ['19l5HsF5IARyuMRCULquwbsP-jfEvhzAQ','14W4J5MUkkVh6qdN5WmB6DkbL6Nj3MM5k','1WdoqyHGfQIYv4_MXq5C4wUvWKqVUWW_c','1V_sBD6iLbEmVpd3-ebQILT_3A7MCu6fq'])),
 ('1drW4OHoxD_AhaOtKIatv_GjswfW1FAgH', '1HB7YoDV-uitTT9MKB4KW7dwz79Ic8rs9', '全カラー_アークデーモン (B)', 'archdemon',
  p4('アークデーモン', ['1shC69d8JQSea_BqPyDK-j7i91Z3sAD5k','1PgdMHa9qEml0V-kiJvaXT9-dI4HVxWqn','1CzinD_3cIQdhZMVkHkh7Du_cCeqxwuf0','14La-EcSOBmtB9zc9ZEgaRXo5-tb8IWfO'])),
 ('1k6fI1VfY92OPpxL_Wc869JY--drqrHcl', '1a4GumJmICpg_MlwzN1LfzGTrvbfu0At0', '全カラー_スペクター', 'specter',
  p4('スペクター', ['1LRdEzf9lcsLKKn02tZKARbCMO_iYx7Ns','1nWc8pobkvUpqhX1ep02xh5suRkejPmxe','1DIYTvaRaAC9mCLzX7HRWWLXFqHOwWtp5','1QnduHSxT4ismF2E_fb1OWLz2lHUlTksS'])),
 ('1kJ_xfJPPVzF61HZeUU6p53qi8Ls13O-A', '1uTn_qZMy3OyC92GMzJbeEfLGgQxJHzBK', '全カラー_レイス', 'wraith',
  p4('レイス', ['1L94ufZYdHhP64u41HIXcNRI5wvZL7B9Y','1zM62lWJmRO5kP_9NkClLnodomFnCCzo1','15xr3Ac_hK8qwXEoAxTUnPqe-i6j0VjCG','1wmd6SJOIEgF4vZNlToNfEBUSsTOu6Yo8'])),
 ('1rGjfP_x_K76KnsdzOyAn3YAcAEwSQDZc', '1BmycDS3YqIn6NGTQDVn1qi6gxdYZexuj', '全カラー_デーモンファウンダー (A)', 'founder',
  p4('デーモンファウンダー', ['1IiwyofQJSo9rFEIXiF-FMtv3LFIROPlj','1tvW5jDojRHDLNB40aEdqqJN2NnsEpfOd','13G93GH8xdNI7Gn5P6v3T1LQeLl7FfvZr','1Giqtd6b7EsLvTI-dVhyPH-MZayakZi4D'])),
 ('13i8O112siqRCm5FobIxrlbJUtKKMEsxg', '1rR60sh9cVvgFlxWEdx0El-MH2smDk0Lc', '全カラー_デーモンファウンダー (B)', 'founder',
  p4('デーモンファウンダー', ['1UM6RMO1QqEpHmLEMUzMEEgz9_f2URV65','1SO6CkTwt1nRZfySEIFiM-qm7trgc1pND','1NqSWK4CjCHfhE8T0AmyvuV8w16BjvL-4','11HH2MuBml84CjsPVGJqP_dDjTrE7Ark-'])),
 ('1U_hnMoOpXB-dhMjcU0QonQV863WFXYAg', '140S7qGGSwx9PtZBsH-lv7NCTEKGudCeq', '全カラー_サキュバス (A)', 'succubus',
  p4('サキュバス', ['14dcdf2oDMkDR5HWNlABgaM2KyQukmEqn','18J9fPejOW40i-qlOefp1J4dfLLrYFZrn','1AK0DrC-HIajoqebP91Yxh3yD2ogdagMb','12L6FFxgptBUboyYalhOw3T0PNzvv1iPB'])),
 ('1Qre-lAF__JVwMzd1O2PLNWG3GpHtDqLj', '1BKlQ6dTMcEIHUEImp0xvjCocn4CaC9nQ', '全カラー_サキュバス (B)', 'succubus',
  p4('サキュバス', ['1TNuxwRl6ioqLfzXLSN30S3WXs4P3gzw7','1kqNYZDR1ZXgU5Zh0N0EdDs_gpFe7dH9r','1R6qW0kxjeXjxPpu6pRp4rxkEGThR7rjG','16c9yUI3zz9H16wa9ZOYqdhkekFYIaNxQ'])),
 ('1DxesLIG1hiTvAng1EvxV_hR8CLBgqkZd', '1u3Z-oFv2f_GEb5xVRHStTwDUKoCCCT9-', '全カラー_シェイド', 'shade',
  p4('シェイド', ['1SPDaM0HGiKeW4YK6etApneU8rUv2JA7t','1xFtvEsYgexHlCu3c-BLLhLilQY4Y0hA6','18OlZZTT6V-Pd125Xigpd7CGSNw0jnl3w','1ZQ8GQVCzfWmQoV436vy0w-0yTMH4bQYy'])),
 ('1NNTw1r-0krjkvlnQsTJRnWQlXf6ovdJw', '1x0c02x1vjfvKgRjHArFu06Pjn0NLt1LJ', '全データ_ダウンロード / インキュバス', 'incubus',
  p4('インキュバス', ['1VqeWuol-Ax1XIw5DAhVGg_Vadg7UpzAZ','14r44wi_UzxmVN-MdkfgsH6wD41zulH6C','1E-bMcaQpYZEZMBaa2YTZUgutG8hc-9if','1kBl1hHoZ9li-lUoWnS9l29fRLgwCbm9r'])),
 ('1kU6gXtPkFfW3w9BzgQexgo6Zh2tjCXbE', '1GrvCNfvIrVwZYL3rDlA825vfr6DAGu29', '全カラー_レッサーデーモン', 'lesser',
  s4('レッサーデーモン', ['1K9vPotFdD2eiR5eaTNFEkKrBjLIq8b08','1OlBKn1eS6M99JORR-MtJUvGdD3PosT4b','12HPhQfrq5zNId3zf7lkM_C6nk-TMW6yn','1QixONfHqB2rpdx3davH6fNrSfka2jrTC'])),
 ('1LfAzN5sBymwXCuagJqUw1rJyBTM8UG5r', '1gv_CShpyekcMohzbQNv9vIavTaYJVffl', 'ゴブリンジャパン', 'goblin_japan',
  p4('ゴブリンジパング', ['1eoDEWwlvkmcDqZZaCWtksGPgkyZei01z','1py3UXVwgETPFRGTuPf_vZp55A14nCGCM','12qbXueyugof_3RiHU_QJ_DioZk_dBhxB','1GbcUFhbCMyH1z50GjeT6SnejXFVzebOD'])),
 ('1U0fJIqgvrZUnPVGC63omkf6CL_OjySSq', '1LLDtEzXPfACMrw7ntAXu2McbAfJJjJRc', 'ゴブリンシャーマン', 'goblin_shaman',
  p4('ゴブリンシャーマン', ['1sOA1P8BfHGInU4DGh5eBhzR5cxgbCMZ4','1_DygbQvRptmI4jJ76JDxXp2dFfe3n-6l','1z5eZhTMSQlKWP8freWbFtiiefrHO_kG5','1Hhifkr7jMLf8nnqr-o4dQNr0zM8XE7bp'])),
 ('1c_LgXdgmJ3qP6_8nz4uFe-ez4Ax9ZBvv', '1qKXsyzYaXjEbvVjccXQ2ZhSkD-3mQSZC', 'ホブゴブリン', 'hobgoblin',
  s4('ホブゴブリン', ['1KzcdwsvCwGNd7zl8-bGXYkBTtIC0zx5U','1Pe9S1eFAF5H79ASQac4Vb6bTwRaYAi9x','1s7AJLuWV1L2tRZlNoCCmlTELuvuUbVkj','1MBJM6AbAENldnqef6giGJWgWc-5P0guk'])),
 ('15SExjSh_NyeJYn9D9_DjnSVMmDAAPqgD', '1BUXCJ8sT7mERrzkb1iQ3sZEA34XmtEtM', 'ゴブリンアーチャー', 'goblin_archer',
  p4('ゴブリンアーチャー', ['1llIequmXvhsb18MgPp4-5o9zhz2i_G1O','12NNVxsXPM9kTqsrX7N_h2hkf16NN9laq','1L7e6pFyz_cplaYJyJoYePZ8J-HOFOLyz','1X23boRMyKQzAjL5RV0Q_nitVSOQwv5Pv'])),
 ('1nXB0NbgWoO4MxOVMNbVZfXsCPtuypfe1', '1YwE7eSyGG-e827f2ah32LKLtmbkdoNFR', '全カラー_ノーライフキング', 'no_life_king',
  p4('ノーライフクイーン', ['12fxYbkaas-GHaRZ-6xfmlcN68pz9UTXV','1XOOzQxbJWb3OLVCxAeAIJFnLPU320y_h','1QjV3j4RPkjRAzefqcukp5t7DoLX87ODT','1pB-5_VihpZfGY13Pu-FVhvi5nLRnMNJG'])),
 ('1WgKKs-imM2MMk3WS3P58fbYv8RfatSQd', '1D6V08IL5eUjO3Cynd5YtXaNsVT9wLmup', 'ゴブリンキング', 'goblin_king',
  s4('ゴブリンキング', ['1q-2DPGY7d75k1vB00f3mU_stoZOer_YL','1Zi4Rnb5-gS_84lGL748UGt560v42ffyG','1KrSbn7lBRJ4XRiYwkUhXC_GlFh8jNQnu','1sRJQ_UEngh9cM_1IMC2GavnsUcoCQsw9'])),
 ('1vgEmOXuysTyNihqA7xpbe5nrmlelefXw', '1nsY_ef99oRH5VJzoeMem2MWyJFGrhKUd', '全カラー_ヴァンパイア', 'vampire',
  p4('ヴァンパイア', ['10Wd_Sn3ojFLJBJwZIXfdiClq-wqjaiDi','1ymjNDvrurZaaBuzmM0b4QA2vTLgVKqwv','1A2FrO6eLcPobOnCNZJcHJGijQ3sJez5p','1K7wMspDoht4HiauE8zV6mjOVrM2TWDXE'])),
 ('1A89wZNPgNQAK8-IAuS4C0x9IfuWgKCuK', '1q0BUkGgB8XVaYa37hVp3cEL7xdIfpy_y', '全カラー_ガーゴイル', 'gargoyle',
  p4('ガーゴイル', ['1fWwKtrjdZbCBVF5q6HwPYE1l-u5J30GS','1spIUK583BXMi2kSmTFEcU9bl6DYt3wZr','1tpOe1vCJ9IcyYoY8EzP4SUFwHy2ONFlw','1CKyZBpFp_o2xrJUSD5fsYubxyIEeehIt'])),
 ('1xFb2UWN-G7-98wz1bifjR51pF9haDTmP', '1Eop6VNrjmuVJMjNFTGDQ8wNP7fjyZwL8', 'ゴブリン・チャリオッツ', 'chariots',
  [('ゴブリン・チャリオッツ.png', '1RO82c8Bl6vHJRpQVY1ykcrEWmiGCX8Qc')]),
]

ZIPS = [
 ('cfbad317d088e375e71d6df408c215d9.zip', '1SepTPZl-WLo4KRo7N2hcqtV8SDoSGYDZ', 4838855, 'wraith'),
 ('c25633b927e784671ddb0504626baf7b.zip', '1QgXImZOuCpwRL9mJFVewaoIAgvGvfL5C', 5842383, 'jack'),
 ('41f31b9ae9e7f76877456493ba309327.zip', '1DNfvWG-sWTMNm5BjCACWqP0UaV7H5nnv', 3009133, 'phantom'),
]

def flat():
    out = []
    for h, sub, folder, kind, files in GROUPS:
        for name, fid in files:
            out.append(dict(id=fid, name=name, folder=folder, folder_id=sub,
                            parent_hash_id=h, kind=kind, root=ROOT))
    for name, fid, size, kind in ZIPS:
        out.append(dict(id=fid, name=name, folder='(直下 / ZIP)', folder_id=h,
                        parent_hash_id=h, kind=kind, root=ROOT, size=size, mime='application/zip'))
    return out

if __name__ == '__main__':
    f = flat()
    print('groups', len(GROUPS), 'png', sum(len(g[4]) for g in GROUPS), 'zip', len(ZIPS), 'total', len(f))
    ids = [x['id'] for x in f]
    print('unique ids', len(set(ids)))
    names = [x['name'] for x in f]
    print('unique names', len(set(names)))
    dup = sorted({n for n in names if names.count(n) > 1})
    print('duplicate names', len(dup))
    print('kinds', sorted({x['kind'] for x in f}))
    os.makedirs('tools', exist_ok=True)
    with open('tools/drive_inventory.json', 'w', encoding='utf-8') as fp:
        json.dump(f, fp, ensure_ascii=False, indent=1)
    # ダウンロード用バッチ（同名ファイルが同一バッチ内で衝突しないよう分割）
    seen, batches = {}, []
    cur = []
    for x in f:
        if x['name'] in seen:
            batches.append(cur); cur = []; seen = {}
        seen[x['name']] = 1
        cur.append(x['id'])
        if len(cur) >= 22:
            batches.append(cur); cur = []; seen = {}
    if cur: batches.append(cur)
    with open('tools/download_batches.json', 'w') as fp:
        json.dump(batches, fp, indent=1)
    print('batches', len(batches), [len(b) for b in batches])
