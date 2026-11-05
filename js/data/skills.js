// ============ 技データ(200種以上) ============
// cat: phys/magic/heal/buff/debuff/guard/counter/summon/ultimate
// b:自バフ[[stat,pct,dur]] d:敵デバフ[[stat,pct,dur,chance]] st:敵状態異常[名前,dur,chance]
// sb:自状態異常[名前,dur] h:ヒット数 g:闘志ゲージ消費 dr:吸収 pr:防御貫通 cr:会心補正
export const ELEMENTS = {
  none:{name:'無', ico:'⚪', color:'#cfd8ec'},
  fire:{name:'火', ico:'🔥', color:'#ff8a50'},
  ice:{name:'氷', ico:'❄️', color:'#7fd4ff'},
  bolt:{name:'雷', ico:'⚡', color:'#ffe066'},
  wind:{name:'風', ico:'🌪️', color:'#9fe8b0'},
  light:{name:'光', ico:'✨', color:'#fff3b0'},
  dark:{name:'闇', ico:'🌑', color:'#b48cf2'},
};
// 相性: 火>氷>風>雷>火 / 光↔闇
export const ELEM_CHART = { fire:'ice', ice:'wind', wind:'bolt', bolt:'fire', light:'dark', dark:'light' };

const S = (id,name,cat,elem,power,mp,cd,ex={}) => ({id,name,cat,elem,power,mp,cd,hits:1,gauge:0,...ex});

export const SKILLS = [
  // ===== 戦士系 =====
  S('power_strike','強撃','phys','none',150,4,0,{fx:'slash'}),
  S('double_slash','二段斬り','phys','none',90,6,1,{hits:2,fx:'slash'}),
  S('war_cry','雄叫び','buff','none',0,8,4,{b:[['atk',30,3]],fx:'buff'}),
  S('whirlwind','回転斬り','phys','wind',170,10,2,{fx:'wind'}),
  S('earth_breaker','大地割り','phys','none',230,16,3,{d:[['def',-20,3,60]],fx:'quake'}),
  S('berserk_axe','バーサクブロウ','phys','none',260,18,3,{b:[['def',-15,2]],cr:10,fx:'slash'}),
  S('iron_wall','鉄壁','guard','none',0,7,4,{sb:['guard',2],b:[['def',35,3]],fx:'buff'}),
  S('giga_slash','ギガスラッシュ','phys','none',300,24,4,{fx:'slash',cr:8}),
  S('titan_blow','タイタンブロー','phys','none',380,32,5,{pr:.3,fx:'quake'}),
  // ===== 剣士系 =====
  S('quick_slash','クイックスラッシュ','phys','none',110,3,0,{fx:'slash'}),
  S('triple_thrust','三段突き','phys','none',80,8,1,{hits:3,fx:'thrust'}),
  S('sonic_blade','ソニックブレード','phys','wind',180,11,2,{fx:'wind'}),
  S('blade_dance','剣の舞','phys','none',75,14,2,{hits:4,fx:'slash'}),
  S('cross_slash','十字斬り','phys','none',210,15,3,{hits:2,fx:'slash'}),
  S('iai_slash','居合斬り','phys','none',240,14,3,{cr:25,fx:'iai'}),
  S('phantom_blade','幻影剣','phys','dark',130,16,2,{hits:3,fx:'dark'}),
  S('thousand_cuts','千本斬り','phys','none',60,26,4,{hits:6,fx:'slash'}),
  // ===== 騎士系 =====
  S('shield_bash','シールドバッシュ','phys','none',130,5,1,{st:['stun',1,25],fx:'bash'}),
  S('guard_stance','守護の構え','guard','none',0,6,3,{sb:['guard',2],fx:'buff'}),
  S('holy_lance','ホーリーランス','phys','light',190,12,2,{fx:'light'}),
  S('aegis_field','イージスフィールド','guard','light',0,18,5,{sb:['shield',3],b:[['def',40,3]],fx:'buff'}),
  S('counter_stance','カウンター構え','counter','none',0,8,4,{sb:['counter',2],fx:'buff'}),
  S('fortress','フォートレス','guard','none',0,20,5,{sb:['guard',3],b:[['def',60,3]],fx:'buff'}),
  S('paladin_oath','騎士の誓い','buff','light',0,16,5,{b:[['atk',20,3],['def',30,3]],sb:['regen',3],fx:'buff'}),
  // ===== 魔法使い系 =====
  S('fire_ball','ファイアボール','magic','fire',160,6,0,{st:['burn',3,20],fx:'fire'}),
  S('ice_shard','アイスシャード','magic','ice',150,6,1,{st:['spd',0,0],d:[['spd',-20,2,50]],fx:'ice'}),
  S('thunder_bolt','サンダーボルト','magic','bolt',175,8,1,{st:['stun',1,15],fx:'bolt'}),
  S('wind_cutter','ウィンドカッター','magic','wind',155,7,1,{hits:2,fx:'wind'}),
  S('mana_shield','マナシールド','guard','none',0,12,4,{sb:['shield',3],fx:'buff'}),
  S('flame_burst','フレイムバースト','magic','fire',240,16,3,{st:['burn',3,45],fx:'fire'}),
  S('blizzard','ブリザード','magic','ice',260,20,3,{d:[['spd',-30,3,70]],fx:'ice'}),
  S('arcane_bolt','アーケインボルト','magic','none',200,12,2,{pr:.2,fx:'arcane'}),
  S('element_nova','エレメントノヴァ','magic','none',280,24,4,{fx:'nova'}),
  S('meteor_rain','メテオレイン','magic','fire',150,30,4,{hits:3,st:['burn',3,40],fx:'meteor'}),
  // ===== 僧侶系 =====
  S('heal','ヒール','heal','light',180,6,0,{fx:'heal'}),
  S('holy_light','ホーリーライト','magic','light',150,7,1,{fx:'light'}),
  S('bless','ブレス','buff','light',0,9,4,{b:[['mag',25,3],['acc',15,3]],fx:'buff'}),
  S('regen','リジェネ','heal','light',0,12,4,{sb:['regen',4],fx:'heal'}),
  S('cure_wave','キュアウェーブ','heal','light',300,16,3,{cure:true,fx:'heal'}),
  S('sanctuary','サンクチュアリ','heal','light',0,24,5,{sb:['regen',4],b:[['def',30,4]],fx:'heal'}),
  S('resurrect_light','再生の光','heal','light',520,30,5,{sb:['regen',3],fx:'heal'}),
  S('grand_heal','グランドヒール','heal','light',420,20,3,{fx:'heal'}),
  S('holy_ray','ホーリーレイ','magic','light',270,18,3,{pr:.25,fx:'light'}),
  S('divine_prayer','神への祈り','heal','light',0,28,6,{healPct:55,cure:true,sb:['regen',3],fx:'heal'}),
  // ===== 盗賊系 =====
  S('poison_dagger','ポイズンダガー','phys','none',120,5,1,{st:['poison',3,70],fx:'thrust'}),
  S('steal_strike','スティールストライク','phys','none',140,7,2,{coinSteal:true,fx:'slash'}),
  S('smoke_veil','煙幕','buff','none',0,8,4,{b:[['eva',25,3]],d:[['acc',-20,3,80]],fx:'buff'}),
  S('shadow_step','シャドウステップ','phys','dark',170,10,2,{cr:15,fx:'dark'}),
  S('venom_fang','ヴェノムファング','phys','none',200,14,3,{st:['poison',4,85],fx:'thrust'}),
  S('mug','かすめ取り','phys','none',160,9,2,{coinSteal:true,cr:10,fx:'slash'}),
  S('trick_edge','トリックエッジ','phys','dark',185,12,2,{d:[['def',-20,3,60]],fx:'dark'}),
  S('assassinate','暗殺剣','phys','dark',280,20,4,{cr:35,fx:'iai'}),
  // ===== 弓使い系 =====
  S('aimed_shot','エイムドショット','phys','none',145,4,0,{cr:10,fx:'shoot'}),
  S('double_arrow','ダブルアロー','phys','none',95,7,1,{hits:2,fx:'shoot'}),
  S('piercing_arrow','ピアシングアロー','phys','none',180,10,2,{pr:.35,fx:'shoot'}),
  S('rain_of_arrows','アローレイン','phys','none',80,14,2,{hits:3,fx:'shoot'}),
  S('eagle_eye','鷹の目','buff','none',0,8,4,{b:[['acc',30,3],['atk',15,3]],fx:'buff'}),
  S('storm_arrow','ストームアロー','phys','wind',230,16,3,{hits:2,fx:'wind'}),
  S('snipe','狙撃','phys','none',250,14,3,{cr:30,pr:.2,fx:'shoot'}),
  S('hunter_mark','猟師の刻印','debuff','none',0,10,4,{d:[['def',-30,4,100],['eva',-20,4,100]],fx:'debuff'}),
  S('comet_arrow','コメットアロー','phys','light',320,24,4,{pr:.3,fx:'light'}),
  // ===== 武闘家系 =====
  S('palm_strike','掌底打ち','phys','none',140,4,0,{fx:'punch'}),
  S('combo_fist','連続拳','phys','none',85,7,1,{hits:3,fx:'punch'}),
  S('focus','気合溜め','buff','none',0,5,3,{b:[['atk',25,2]],gaugeGain:30,fx:'buff'}),
  S('rising_kick','昇天脚','phys','wind',190,11,2,{cr:12,fx:'punch'}),
  S('hundred_fists','百裂拳','phys','none',55,22,4,{hits:6,fx:'punch'}),
  S('chi_burst','気功波','phys','none',260,18,3,{pr:.2,fx:'arcane'}),
  S('iron_body','鉄身','guard','none',0,8,4,{b:[['def',40,3]],sb:['regen',2],fx:'buff'}),
  S('dragon_fist','龍撃拳','phys','fire',290,20,4,{fx:'fire'}),
  S('asura_strike','阿修羅連撃','phys','none',70,30,5,{hits:7,fx:'punch'}),
  // ===== 銃士系 =====
  S('quick_shot','クイックショット','phys','none',135,4,0,{fx:'shoot'}),
  S('double_tap','ダブルタップ','phys','none',100,6,1,{hits:2,cr:8,fx:'shoot'}),
  S('fire_round','炎弾','phys','fire',170,9,1,{st:['burn',3,30],fx:'fire'}),
  S('ice_round','氷弾','phys','ice',170,9,1,{d:[['spd',-20,2,60]],fx:'ice'}),
  S('bullet_storm','バレットストーム','phys','none',70,18,3,{hits:4,fx:'shoot'}),
  S('headshot','ヘッドショット','phys','none',280,18,4,{cr:40,fx:'shoot'}),
  S('ricochet','跳弾','phys','none',130,10,2,{hits:2,pr:.2,fx:'shoot'}),
  S('full_burst','フルバースト','phys','none',85,24,4,{hits:5,fx:'shoot'}),
  S('railgun_shot','レールガン','phys','bolt',340,26,5,{pr:.5,fx:'bolt'}),
  // ===== 召喚士系 =====
  S('spirit_wolf','霊狼召喚','summon','wind',160,8,1,{fx:'summon'}),
  S('flame_spirit','炎霊召喚','summon','fire',185,11,2,{st:['burn',3,30],fx:'summon'}),
  S('frost_spirit','氷霊召喚','summon','ice',185,11,2,{d:[['spd',-25,2,60]],fx:'summon'}),
  S('thunder_bird','雷鳥召喚','summon','bolt',220,15,2,{st:['stun',1,20],fx:'summon'}),
  S('guardian_golem','守護巨像','guard','none',0,18,5,{sb:['shield',4],b:[['def',35,4]],fx:'summon'}),
  S('drake_call','飛竜召喚','summon','fire',280,22,4,{fx:'summon'}),
  S('fairy_bless','妖精の祝福','heal','light',0,14,4,{healPct:30,sb:['regen',3],fx:'heal'}),
  S('behemoth','ベヒーモス召喚','summon','none',340,28,5,{pr:.25,fx:'summon'}),
  S('bahamut_call','バハムート召喚','summon','dark',180,40,6,{hits:3,fx:'summon'}),
  // ===== 錬金術師系 =====
  S('acid_flask','酸のフラスコ','magic','none',140,6,1,{d:[['def',-25,3,70]],fx:'poison'}),
  S('heal_potion_art','回復薬錬成','heal','none',200,8,1,{fx:'heal'}),
  S('bomb_flask','爆弾フラスコ','magic','fire',190,11,2,{fx:'fire'}),
  S('transmute_guard','錬成防壁','guard','none',0,10,4,{sb:['shield',3],fx:'buff'}),
  S('plague_flask','疫病フラスコ','magic','dark',170,14,3,{st:['poison',4,80],fx:'poison'}),
  S('philosopher_burst','賢者石爆ぜ','magic','light',290,22,4,{fx:'nova'}),
  S('elixir_art','エリクシル錬成','heal','none',0,24,5,{healPct:45,cure:true,fx:'heal'}),
  S('gold_transmute','黄金錬成','buff','none',0,12,5,{coinSteal:true,b:[['atk',20,3]],fx:'buff'}),
  S('homunculus','ホムンクルス','summon','dark',260,20,4,{dr:.3,fx:'summon'}),
  // ===== 忍者系 =====
  S('shuriken','手裏剣','phys','wind',120,4,0,{hits:2,fx:'shoot'}),
  S('fire_jutsu','火遁の術','magic','fire',170,9,1,{st:['burn',3,30],fx:'fire'}),
  S('shadow_clone','影分身','buff','dark',0,12,4,{b:[['eva',30,3],['spd',20,3]],fx:'dark'}),
  S('water_jutsu','水遁の術','magic','ice',165,9,1,{d:[['spd',-20,2,60]],fx:'ice'}),
  S('lightning_jutsu','雷遁の術','magic','bolt',240,16,3,{st:['stun',1,25],fx:'bolt'}),
  S('vanish','雲隠れ','buff','none',0,10,4,{sb:['dodge',2],b:[['eva',40,2]],fx:'buff'}),
  S('dual_shuriken','双連手裏剣','phys','wind',100,10,2,{hits:4,fx:'shoot'}),
  S('izuna_drop','飯綱落とし','phys','bolt',300,22,4,{cr:20,fx:'bolt'}),
  // ===== 狂戦士系 =====
  S('rage','闘争本能','buff','fire',0,10,4,{b:[['atk',45,3],['def',-20,3]],fx:'buff'}),
  S('blood_slash','ブラッドスラッシュ','phys','dark',220,14,2,{dr:.35,fx:'dark'}),
  S('rampage','暴走乱撃','phys','none',90,20,3,{hits:4,b:[['def',-15,2]],fx:'slash'}),
  S('doom_cleave','破滅の一閃','phys','dark',360,28,5,{cr:15,fx:'iai'}),
  S('war_frenzy','戦鬼の咆哮','buff','fire',0,16,5,{b:[['atk',55,3],['spd',20,3],['def',-25,3]],fx:'buff'}),
  S('skull_crush','頭蓋砕き','phys','none',330,24,4,{st:['stun',1,35],pr:.3,fx:'quake'}),
  S('apocalypse_axe','終焉の大斧','phys','dark',420,36,6,{pr:.35,fx:'quake'}),
  // ===== 聖騎士系 =====
  S('judgment','裁きの光','magic','light',280,20,3,{fx:'light'}),
  S('immortal_guard','不滅の守護','guard','light',0,26,6,{sb:['guard',3],sb2:['regen',3],b:[['def',50,3]],fx:'buff'}),
  S('divine_wall','神聖防壁','guard','light',0,22,5,{sb:['shield',4],b:[['def',45,4]],fx:'buff'}),
  S('holy_counter','聖なる反撃','counter','light',0,14,4,{sb:['counter',3],b:[['atk',20,3]],fx:'buff'}),
  S('avalon','理想郷の加護','heal','light',0,36,6,{healPct:60,cure:true,b:[['def',30,4]],fx:'heal'}),
  // ===== 賢者系 =====
  S('mana_burst','マナバースト','magic','none',300,24,4,{pr:.3,fx:'arcane'}),
  S('wisdom_aura','叡智のオーラ','buff','none',0,18,5,{b:[['mag',40,4],['def',20,4]],fx:'buff'}),
  S('spell_mastery','魔導の極意','buff','none',0,20,5,{b:[['mag',50,3],['acc',20,3]],fx:'buff'}),
  S('cataclysm','大災厄','magic','dark',340,32,5,{st:['poison',3,50],fx:'dark'}),
  S('forbidden_tome','禁断の魔導書','magic','dark',400,40,6,{dr:.25,b:[['def',-15,2]],fx:'dark'}),
  // ===== レンジャー系 =====
  S('beast_companion','獣の相棒','summon','wind',240,16,3,{hits:2,fx:'summon'}),
  S('nature_wrath','自然の怒り','magic','wind',300,24,4,{hits:2,fx:'wind'}),
  S('gale_volley','疾風の連矢','phys','wind',110,18,3,{hits:4,fx:'wind'}),
  S('lethal_aim','必殺の狙い','buff','none',0,14,4,{sb:['focus',2],b:[['acc',25,3]],fx:'buff'}),
  S('artemis_arrow','月女神の矢','phys','light',380,30,5,{cr:30,pr:.4,fx:'light'}),
  // ===== 剣聖系 =====
  S('moon_slash','月光斬り','phys','light',300,20,3,{cr:20,fx:'iai'}),
  S('heaven_blade','天翔ける剣','phys','light',380,30,5,{hits:2,fx:'light'}),
  S('zero_stance','無の構え','counter','none',0,16,4,{sb:['counter',3],b:[['eva',25,3]],fx:'buff'}),
  S('dimension_cut','次元斬','phys','dark',420,34,5,{pr:.6,fx:'dark'}),
  S('sword_god','剣神一閃','ultimate','none',560,20,4,{gauge:100,cr:35,pr:.4,fx:'iai'}),
  // ===== 魔導士系 =====
  S('judgment_thunder','裁きの雷槌','magic','bolt',360,28,4,{st:['stun',1,35],fx:'bolt'}),
  S('gravity_well','重力渦','magic','dark',320,26,4,{d:[['spd',-40,3,90]],pr:.3,fx:'dark'}),
  S('ultima','アルテマ','magic','none',480,44,6,{pr:.4,fx:'nova'}),
  S('mana_overflow','魔力暴走','buff','none',0,20,5,{b:[['mag',60,3]],sb:['regen',2],fx:'buff'}),
  S('element_lord','元素支配','magic','none',160,34,5,{hits:3,fx:'nova'}),
  S('big_bang','ビッグバン','ultimate','fire',620,30,5,{gauge:100,hits:2,fx:'nova'}),
  // ===== 暗殺者系 =====
  S('death_mark','死の刻印','debuff','dark',0,14,4,{d:[['def',-40,4,100],['eva',-30,4,100]],fx:'debuff'}),
  S('shadow_reaper','影の死神','phys','dark',340,24,4,{cr:30,dr:.2,fx:'dark'}),
  S('execution','処刑執行','phys','dark',450,34,5,{cr:50,execute:true,fx:'iai'}),
  S('silent_kill','静寂なる死','phys','dark',300,20,3,{st:['silence',3,70],cr:20,fx:'dark'}),
  S('phantom_rush','幻影ラッシュ','phys','dark',110,26,4,{hits:5,fx:'dark'}),
  S('god_slayer','神殺しの一撃','ultimate','dark',600,26,5,{gauge:100,cr:45,pr:.5,fx:'iai'}),
  // ===== 竜騎士系 =====
  S('dragon_lance','竜撃槍','phys','fire',260,16,2,{pr:.25,fx:'thrust'}),
  S('wyvern_dive','飛竜降下','phys','wind',320,22,4,{cr:20,fx:'thrust'}),
  S('dragon_roar','竜の咆哮','debuff','fire',0,14,4,{d:[['atk',-30,3,90],['def',-20,3,90]],fx:'debuff'}),
  S('fire_breath','竜の火炎','magic','fire',300,24,3,{hits:2,st:['burn',3,50],fx:'fire'}),
  S('bahamut_lance','バハムートランス','phys','dark',430,34,5,{pr:.45,fx:'dark'}),
  S('dragon_scale','竜鱗の加護','guard','fire',0,18,5,{b:[['def',45,4]],sb:['regen',3],fx:'buff'}),
  S('sky_dominion','天空支配','phys','wind',360,28,4,{hits:2,cr:15,fx:'wind'}),
  S('dragon_king','竜王降臨','ultimate','fire',580,28,5,{gauge:100,hits:2,st:['burn',3,60],fx:'summon'}),
  // ===== 魔剣士系 =====
  S('flame_blade','炎の魔剣','phys','fire',220,12,2,{st:['burn',3,35],fx:'fire'}),
  S('frost_blade','氷の魔剣','phys','ice',220,12,2,{d:[['spd',-25,3,70]],fx:'ice'}),
  S('thunder_blade','雷の魔剣','phys','bolt',240,14,2,{st:['stun',1,20],fx:'bolt'}),
  S('spell_combo','魔剣連舞','phys','none',130,22,3,{hits:3,fx:'slash'}),
  S('rune_storm','ルーンストーム','magic','none',340,28,4,{hits:2,fx:'arcane'}),
  S('magic_edge','魔力の刃','buff','none',0,14,4,{b:[['atk',30,3],['mag',30,3]],fx:'buff'}),
  S('arcane_slash','魔導斬','phys','none',320,24,4,{pr:.35,fx:'arcane'}),
  S('eclipse_blade','蝕の魔剣','ultimate','dark',550,26,5,{gauge:100,hits:2,dr:.3,fx:'dark'}),
  // ===== 神の使徒系 =====
  S('genesis_light','創世の光','magic','light',380,30,4,{hits:2,fx:'light'}),
  S('seraph_wing','熾天使の翼','buff','light',0,24,5,{b:[['mag',35,4],['eva',25,4]],sb:['regen',3],fx:'buff'}),
  S('divine_judgment','神罰','magic','light',480,40,6,{pr:.4,fx:'light'}),
  S('miracle','奇跡','heal','light',0,40,7,{healPct:80,cure:true,b:[['atk',20,3]],fx:'heal'}),
  S('heaven_gate','天国の門','magic','light',240,44,6,{hits:3,fx:'light'}),
  S('god_hand','ゴッドハンド','ultimate','light',640,30,5,{gauge:100,pr:.5,fx:'light'}),
  // ===== 破壊神系 =====
  S('world_breaker','世界破壊','phys','none',480,36,5,{pr:.4,fx:'quake'}),
  S('ruin_fist','滅びの拳','phys','dark',420,30,4,{hits:2,fx:'punch'}),
  S('extinction','絶滅の宣告','phys','dark',560,44,6,{execute:true,fx:'quake'}),
  S('wrath_of_god','破壊神の憤怒','buff','dark',0,22,5,{b:[['atk',65,3],['spd',25,3]],fx:'buff'}),
  S('star_crusher','星砕き','phys','none',520,40,6,{pr:.5,cr:20,fx:'quake'}),
  S('universe_end','万象終焉','ultimate','dark',720,36,6,{gauge:100,pr:.5,fx:'nova'}),
  // ===== 時空術師系 =====
  S('time_slow','時間減速','debuff','none',0,14,4,{d:[['spd',-50,3,100],['eva',-25,3,100]],fx:'debuff'}),
  S('space_rift','空間断裂','magic','dark',340,26,4,{pr:.45,fx:'dark'}),
  S('chrono_heal','時間巻き戻し','heal','none',0,26,5,{healPct:50,cure:true,fx:'heal'}),
  S('time_stop','時間停止','debuff','none',0,36,6,{st:['stun',2,90],fx:'arcane'}),
  S('infinity_break','無限崩壊','magic','none',460,40,6,{hits:2,pr:.4,fx:'nova'}),
  S('accel_world','加速世界','buff','none',0,20,5,{b:[['spd',60,3],['eva',30,3]],gaugeGain:25,fx:'buff'}),
  S('parallel_strike','並行世界斬','phys','none',150,32,5,{hits:4,pr:.3,fx:'arcane'}),
  S('event_horizon','事象の地平','ultimate','dark',660,32,6,{gauge:100,hits:2,pr:.5,fx:'nova'}),
  // ===== 汎用技(レベル習得) =====
  S('first_aid','応急手当','heal','none',0,5,2,{healPct:18,req:{lv:3},fx:'heal'}),
  S('spirit_charge','闘志充填','buff','none',0,4,3,{gaugeGain:40,req:{lv:6},fx:'buff'}),
  S('see_through','見切り','buff','none',0,6,3,{b:[['eva',20,3]],req:{lv:10},fx:'buff'}),
  S('fighting_spirit','闘志の炎','buff','fire',0,9,4,{b:[['atk',25,3]],req:{lv:15},fx:'buff'}),
  S('concentration','精神統一','buff','none',0,8,4,{b:[['acc',25,3],['mag',15,3]],req:{lv:18},fx:'buff'}),
  S('life_breath','生命の息吹','heal','light',0,14,4,{sb:['regen',3],req:{lv:24},fx:'heal'}),
  S('all_out','渾身の一撃','phys','none',290,18,4,{cr:15,req:{lv:30},fx:'quake'}),
  S('limit_break','リミットブレイク','ultimate','none',480,18,4,{gauge:100,req:{lv:40},cr:20,fx:'nova'}),
  // ===== 技の書(ショップ・ドロップ) =====
  S('book_meteor','隕石招来','magic','fire',350,28,4,{hits:2,req:{book:true},fx:'meteor'}),
  S('book_absolute_zero','絶対零度','magic','ice',330,26,4,{st:['freeze',2,45],req:{book:true},fx:'ice'}),
  S('book_thunder_god','雷神の怒り','magic','bolt',370,30,5,{st:['stun',1,40],req:{book:true},fx:'bolt'}),
  S('book_dark_eclipse','暗黒蝕','magic','dark',340,28,4,{dr:.35,req:{book:true},fx:'dark'}),
  S('book_life_steal','生命吸収','magic','dark',240,20,3,{dr:.6,req:{book:true},fx:'dark'}),
  S('book_full_cure','完全治癒','heal','light',0,30,5,{healPct:65,cure:true,req:{book:true},fx:'heal'}),
  S('book_dragon_wave','竜波動','phys','fire',330,24,4,{pr:.3,req:{book:true},fx:'fire'}),
  S('book_phantom_nine','九連幻影','phys','none',65,32,5,{hits:9,req:{book:true},fx:'slash'}),
  // ===== ボス撃破習得 =====
  S('boss_flame_lord','炎帝の覇気','phys','fire',360,26,4,{b:[['atk',25,3]],req:{boss:'flame_lord'},fx:'fire'}),
  S('boss_frost_queen','氷皇の絶界','magic','ice',350,26,4,{st:['freeze',2,40],req:{boss:'frost_queen'},fx:'ice'}),
  S('boss_storm_king','嵐王の天罰','magic','bolt',380,30,5,{hits:2,req:{boss:'storm_king'},fx:'bolt'}),
  S('boss_dragon_heart','竜帝の心臓','buff','fire',0,24,6,{b:[['atk',40,4],['def',40,4]],req:{boss:'dragon_emperor'},fx:'buff'}),
  S('boss_demon_eye','魔王の魔眼','debuff','dark',0,20,5,{d:[['atk',-35,4,100],['mag',-35,4,100]],req:{boss:'demon_lord'},fx:'debuff'}),
  S('boss_void_touch','虚無の接吻','magic','dark',420,34,5,{dr:.4,pr:.4,req:{boss:'nameless_king'},fx:'dark'}),
  // ===== 対戦ポイント交換 =====
  S('pt_gladiator','剣闘士の極意','phys','none',340,24,4,{cr:25,req:{points:250},fx:'slash'}),
  S('pt_saint_wall','聖者の壁','guard','light',0,20,5,{sb:['shield',4],sb2:['regen',3],req:{points:300},fx:'buff'}),
  S('pt_mana_flood','魔力洪水','magic','none',360,28,4,{pr:.3,req:{points:350},fx:'arcane'}),
  S('pt_war_dance','戦神の舞','buff','none',0,18,5,{b:[['atk',35,3],['spd',30,3],['eva',20,3]],req:{points:400},fx:'buff'}),
  S('pt_soul_drain','魂の収奪','magic','dark',280,24,4,{dr:.5,req:{points:450},fx:'dark'}),
  S('pt_judgment_spear','裁きの聖槍','phys','light',400,30,5,{pr:.4,req:{points:500},fx:'light'}),
  S('pt_armageddon','ハルマゲドン','magic','fire',200,42,6,{hits:3,req:{points:700},fx:'meteor'}),
  S('pt_immortal','不死鳥の翼','heal','fire',0,34,6,{healPct:70,sb:['regen',4],req:{points:800},fx:'heal'}),
  // ===== 覚醒限定技 =====
  S('awk_soul_burst','魂の解放','ultimate','none',500,20,4,{gauge:100,req:{awaken:1},b:[['atk',20,3]],fx:'nova'}),
  S('awk_starlight','星輝の加護','heal','light',0,26,5,{req:{awaken:2},healPct:55,cure:true,b:[['def',25,3]],fx:'heal'}),
  S('awk_chaos_edge','混沌の刃','ultimate','dark',580,26,5,{gauge:100,req:{awaken:3},hits:2,dr:.25,fx:'dark'}),
  S('awk_genesis','天地創造','ultimate','light',640,30,5,{gauge:100,req:{awaken:4},hits:2,pr:.4,fx:'light'}),
  S('awk_final_evolution','最終進化・真','ultimate','none',780,36,6,{gauge:100,req:{awaken:5},pr:.5,cr:30,fx:'nova'}),
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const CAT_NAME = { phys:'物理', magic:'魔法', heal:'回復', buff:'強化', debuff:'弱体', guard:'防御', counter:'反撃', summon:'召喚', ultimate:'必殺' };

export function skillDesc(s){
  const parts = [];
  const el = ELEMENTS[s.elem];
  parts.push(`${CAT_NAME[s.cat]}・${el.name}属性`);
  if (s.power > 0 && s.cat !== 'heal') parts.push(`威力${s.power}${s.hits>1?`×${s.hits}連`:''}`);
  if (s.cat === 'heal') parts.push(s.healPct ? `HP${s.healPct}%回復` : `回復力${s.power}`);
  if (s.gauge) parts.push(`闘志${s.gauge}消費`);
  if (s.dr) parts.push(`吸収${Math.round(s.dr*100)}%`);
  if (s.pr) parts.push(`貫通${Math.round(s.pr*100)}%`);
  if (s.cr) parts.push(`会心+${s.cr}%`);
  if (s.cure) parts.push('状態異常治癒');
  if (s.execute) parts.push('瀕死時威力増');
  if (s.gaugeGain) parts.push(`闘志+${s.gaugeGain}`);
  if (s.coinSteal) parts.push('コイン奪取');
  const STATN = {atk:'攻撃',def:'防御',spd:'速度',mag:'魔力',acc:'命中',eva:'回避'};
  const STN = {poison:'毒',burn:'火傷',stun:'気絶',sleep:'睡眠',blind:'暗闇',silence:'沈黙',freeze:'凍結',regen:'再生',shield:'バリア',counter:'反撃',guard:'守護',dodge:'残影',focus:'心眼'};
  (s.b||[]).forEach(([st,p,d])=>parts.push(`自${STATN[st]}${p>0?'+':''}${p}%(${d}T)`));
  (s.d||[]).forEach(([st,p,d,c])=>parts.push(`敵${STATN[st]}${p}%(${d}T/${c}%)`));
  if (s.st && s.st[0]) parts.push(`敵${STN[s.st[0]]||s.st[0]}(${s.st[1]}T/${s.st[2]}%)`);
  if (s.sb) parts.push(`自${STN[s.sb[0]]}(${s.sb[1]}T)`);
  if (s.sb2) parts.push(`自${STN[s.sb2[0]]}(${s.sb2[1]}T)`);
  return parts.join(' / ');
}
