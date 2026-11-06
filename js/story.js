/* ===========================================================
   メインストーリー「五つの印章」全 5 章（R / SR / SSR / UR / LR）
   -----------------------------------------------------------
   - 登場する敵はすべて Google Drive「敵キャラ」の登録済みアセット。
   - 章ごとに「目的・展開・導入・敵の登場・バトルステージ構成・
     ボス撃破後の締めくくり」を変え、同じ流れの使い回しにしない。
   - クリア報酬は RANK_REQUIREMENTS から機械的に組み立てるため、
     「進化に必要な個数」と「報酬で得られる個数」が必ず一致する。
   - クリア / 受取状態は state.story.arc に保存し、重複受取を防止する。
   =========================================================== */
import { RANK_REQUIREMENTS } from './materials.js?v=2';
import { EVOLUTION_RULES } from './data.js?v=2';

export const STORY_RANKS = ['R', 'SR', 'SSR', 'UR', 'LR'];

/** 章データ。stage.label は章ごとに変え、同じ並びを再利用しない */
export const STORY_CHAPTERS = [
  {
    id: 'ch1', no: 1, rank: 'R', title: '緑の斜面、消えた収穫', place: 'リーフ村周辺の丘陵',
    structure: '護衛', objective: '収穫を奪うゴブリンから村人を守り、襲撃の首謀者を突き止める。',
    theme: '村を守る小さな戦い。力ではなく「誰を守るか」が問われる。',
    rewardRank: 'SR',                 // R → SR の進化素材と完全一致
    prologue: [
      { speaker: '村長', text: '昨夜、倉が荒らされた。跡には小さな足跡と、折れた棍棒だけ。' },
      { speaker: '主人公', text: 'まずは畑の見回りだ。村人を下がらせて、僕が先に行く。', enemyId: 'goblin_club' },
      { speaker: '村の子', text: '……丘の向こうで、いつもと違う太鼓の音がしてた。' },
    ],
    twistAt: 2,
    twist: { speaker: '斥候', text: 'ただの野盗じゃない。棍棒・剣・斧・弓、武器の違うゴブリンが同時に動いている。誰かが揃えたんだ。', enemyId: 'goblin_shaman' },
    stages: [
      { label: '通常戦', enemyId: 'goblin_club', level: 8, mul: 0.95, intro: '畑の隅で棍棒を抱えた小柄な影がこちらを睨む。', outro: '一撃で退散。だが足跡は丘へ続いている。' },
      { label: '強敵戦', enemyId: 'hobgoblin', level: 13, mul: 1.08, intro: '上位種のホブゴブリンが棘棍棒を引きずって立ちはだかる。', outro: '巨腕の一撃をしのぎ、太鼓の音が近づいた。' },
      { label: '中ボス戦', enemyId: 'goblin_shaman', level: 17, mul: 1.16, intro: '仮面の呪術師が、集めたゴブリンを操っていた。', outro: '仮面が割れ、王の名だけが残った。' },
      { label: '最終ボス戦', enemyId: 'goblin_king', level: 22, mul: 1.30, boss: true, intro: '王冠のゴブリンキング「収穫は我が物だ」と大剣を構える。', outro: '王は膝をつき、村に静けさが戻る。' },
    ],
    epilogue: [
      { speaker: '村長', text: '倉は無事だ。だが王は「霧の墓所から来い」と言い残した。' },
      { speaker: '主人公', text: '収穫祭は明日だ。今夜のうちに、次の手がかりを確かめに行こう。' },
    ],
    ending: '守り抜いた収穫と、霧の墓所への手がかり。',
  },
  {
    id: 'ch2', no: 2, rank: 'SR', title: '霧の墓所、絶えぬ灯', place: '忘れられた地下墓所',
    structure: '探索', objective: '消えた調査隊を捜し、墓所の封印が破られた理由を解き明かす。',
    theme: '答えを探す旅。戦うほどに、味方の失踪の理由が自分に近づいてくる。',
    rewardRank: 'SSR',
    prologue: [
      { speaker: 'ギルド職員', text: '調査隊が三日帰らない。最後の通信は「灯が消えない」の一言だけ。' },
      { speaker: '主人公', text: '封印の鍵は四つ。まずは入口の骸骨から確かめる。', enemyId: 'skeleton_plain' },
      { speaker: '記録', text: '「腕が増えた者は、開かずの間を守る」と石板にある。' },
      { speaker: '主人公', text: '……下から、誰かが名字を呼んだ気がした。', enemyId: 'wraith' },
    ],
    twistAt: 2,
    twist: { speaker: '調査隊長', text: '封印を破ったのは外の魔物じゃない。調査隊の中にいた「不死を望んだ者」だ。', enemyId: 'lich_m' },
    stages: [
      { label: '入口戦', enemyId: 'skeleton_plain', level: 24, mul: 1.06, intro: '赤い腰布の骸骨剣士が、無言で道をふさぐ。', outro: '骨は崩れ、奥の扉がわずかに開いた。' },
      { label: '連戦・六腕', enemyId: 'skeleton_arm', level: 28, mul: 1.12, intro: '六本の剣が同時に鳴る。避ける隙がない。', outro: '剣が止んだ瞬間、霧が一段濃くなった。' },
      { label: '霊体戦', enemyId: 'wraith', level: 30, mul: 1.16, intro: '蛇のように渦巻く布が、こちらの記憶を呼ぶ。', outro: '名前を呼んだのは、既に戻れぬ調査隊の影だった。' },
      { label: '中ボス戦', enemyId: 'lich_m', level: 34, mul: 1.26, intro: 'フードの死霊魔導士が杖を掲げ「灯は永遠に」と唱える。', outro: '杖が折れ、霧の奥に玉座の影が見えた。' },
      { label: '最終ボス戦', enemyId: 'no_life_king', level: 38, mul: 1.40, boss: true, intro: '王冠の不死の女王が、骨の腕を四方へ伸ばす。', outro: '女王は「淵の玉座に座る者こそ元凶」と灯を手放した。' },
    ],
    epilogue: [
      { speaker: '調査隊長', text: '隊は全員見つかった。望んだのは不死ではなく、終わらない時間だった。' },
      { speaker: '主人公', text: '灯を消して、地上へ戻ろう。次は眸の回廊だ。' },
      { speaker: '記録', text: '封印は四つの鍵のうち、まだ二つしか戻っていない。' },
    ],
    ending: '消えた灯と、裏切りの記録。二つ目の鍵。',
  },
  {
    id: 'ch3', no: 3, rank: 'SSR', title: '眸の回廊、映らぬ顔', place: '鏡面の回廊',
    structure: '潜入', objective: '呪いの鏡を割り、映された「もう一人の自分」から仲間を取り戻す。',
    theme: '自分と対峙する章。敵の姿が、味方の影に見えてしまう。',
    rewardRank: 'UR',
    prologue: [
      { speaker: '錬金術師', text: '回廊の鏡は、見た者の「なりたかった姿」を映して奪う。' },
      { speaker: '主人公', text: '割ればいい。……それで仲間が戻るなら。', enemyId: 'phantom' },
      { speaker: '鏡の声', text: '「本当に、戻ってほしいのか？」' },
    ],
    twistAt: 1,
    twist: { speaker: '仲間', text: '「鏡の中のほうが強かったよ」。かつての相棒が、ゲイザーの影から現れた。', enemyId: 'gazer' },
    stages: [
      { label: '潜入戦', enemyId: 'phantom', level: 40, mul: 1.10, intro: '髑髏の幽霊が鏡から抜け出し、こちらの足取りを真似る。', outro: '真似を止めさせると、廊下の鏡が一枚だけ曇った。' },
      { label: '強敵戦', enemyId: 'shade', level: 44, mul: 1.20, intro: '無数の眼が一斉に開き、視線で動きを止めにかかる。', outro: '瞳を閉じて斬る。鏡にヒビが走った。' },
      { label: '中ボス戦', enemyId: 'gazer', level: 47, mul: 1.30, intro: '巨大な一つ目が、仲間の姿を映して見せる。', outro: 'それは仲間ではなかった。石化の眼光を外した。' },
      { label: '最終ボス戦', enemyId: 'archdemon', level: 52, mul: 1.46, boss: true, intro: '鏡の主アークデーモンが翼を広げ「どちらが本物だ」と劫火を吐く。', outro: '鏡は割れ、映っていたもう一人の自分が手を下ろした。' },
    ],
    epilogue: [
      { speaker: '仲間', text: '……戻れた。鏡の中では、ずっと勝ち続けていたのに、疲れてた。' },
      { speaker: '錬金術師', text: '三つ目の鍵だ。残るは焔の門を守る者だけ。' },
    ],
    ending: '割れた鏡と、取り戻した相棒。三つ目の鍵。',
  },
  {
    id: 'ch4', no: 4, rank: 'UR', title: '焔の門、落ちる刻', place: '焔の門・外郭',
    structure: '防衛', objective: '門が開くまでの間、味の軍勢を食い止め、封印の四つ目の鍵を奪還する。',
    theme: '攻めではなく持ちこたえる章。退かないことが勝利条件。',
    rewardRank: 'LR',
    prologue: [
      { speaker: '門の守人', text: '門は日没に開く。それまで、ここを一歩も渡らせるな。' },
      { speaker: '主人公', text: '逃げ道は作らない。僕が最後の砦になる。', enemyId: 'jack' },
      { speaker: '門の守人', text: '南瓜の鬼火が見えたら、本格的な焼き討ちが始まる合図だ。' },
      { speaker: '記録', text: '「藁の巨人が燃えるとき、門は自ら開く」' },
    ],
    twistAt: 3,
    twist: { speaker: '門の守人', text: '封印の鍵は門の内側じゃない。最上位の悪魔が、鍵を杖に嵌めて運んでいる！', enemyId: 'greater_staff' },
    stages: [
      { label: '先鋒戦', enemyId: 'jack', level: 54, mul: 1.08, intro: '南瓜の提灯を掲げた魔女が、鬼火を撒きながら近づく。', outro: '鬼火を消しても、次の炎が見えた。' },
      { label: '防衛戦', enemyId: 'wickerman', level: 57, mul: 1.18, intro: '藁の巨人が自らを燃やし、門柱に体を押しつける。', outro: '巨人の灰の中から、黒い杖だけが残った。' },
      { label: '強敵戦', enemyId: 'gargoyle', level: 59, mul: 1.22, intro: '石翼が上空から急降下する。足場が削れる。', outro: '翼を畳ませ、門前に立ち直った。' },
      { label: '中ボス戦', enemyId: 'greater_staff', level: 62, mul: 1.34, intro: '緑に光る長杖の巨大悪魔が、鍵を掲げて雷を這わせる。', outro: '杖を叩き折る。だが鍵は、さらに奥の手へ渡った。' },
      { label: '最終ボス戦', enemyId: 'greater_both', level: 66, mul: 1.52, boss: true, intro: '杖と魔法球を同時に扱う最上位個体が、門の前に立つ。', outro: '日没と同時に極撃を跳ね返す。門は開かず、鍵が手元に落ちた。' },
    ],
    epilogue: [
      { speaker: '門の守人', text: '四つの鍵が揃った。……だが玉座には、まだ誰か座っている。' },
      { speaker: '主人公', text: '守っただけじゃ終わらない。今度はこちらから行く。' },
      { speaker: '門の守人', text: '行け。焔は、もうお前の後ろにある。' },
    ],
    ending: '開かなかった門と、揃った四つの鍵。',
  },
  {
    id: 'ch5', no: 5, rank: 'LR', title: '淵の玉座、継ぐ者', place: '淵の玉座・最深部',
    structure: '決戦', objective: 'これまでの戦いの元凶を断ち、印章を継いで世界に夜明けを戻す。',
    theme: '総決算。倒したはずの敵が記憶として並び、最後は「継ぐ」選択で締める。',
    rewardRank: 'ALL',                 // 1 キャラを R → LR まで進化させる全素材
    prologue: [
      { speaker: '女王の残響', text: '玉座に座る者は、世界の「やり直し」を望んだ。' },
      { speaker: '振り返り', text: '丘陵のゴブリン、霧の骸骨、鏡の瞳、焔の杖。……全部、ここへ続いていた。', enemyId: 'goblin_king' },
      { speaker: '主人公', text: 'みんなが渡してくれた鍵がある。今度は僕が終わらせる。' },
      { speaker: '鏡の声', text: '「座れば、全部やり直せるのに」' },
      { speaker: '主人公', text: 'やり直さない。積み重ねたまま、先へ行く。' },
    ],
    twistAt: 3,
    twist: { speaker: '淵の声', text: 'ならば継ぐがいい。印章は力じゃない。ここまで来た記録そのものだ。', enemyId: 'founder' },
    stages: [
      { label: '記憶戦・丘陵', enemyId: 'goblin_king', level: 68, mul: 1.16, intro: '最初に倒した王が、記憶の中でまた立ち上がる。', outro: '今は軽くあしらえる。自分が強くなったと分かる。' },
      { label: '記憶戦・墓所', enemyId: 'no_life_king', level: 70, mul: 1.22, intro: '不死の女王が、今度は静かに道を譲ろうとする。', outro: '敵ではなく、通過証のように頭を下げた。' },
      { label: '強敵戦', enemyId: 'succubus', level: 72, mul: 1.28, intro: '最後の誘い。「座れば、失ったものも戻る」と囁く。', outro: '囁きを振り切り、玉座の階段を上がる。' },
      { label: '中ボス戦', enemyId: 'archdemon', level: 75, mul: 1.40, intro: '鏡の主が再び翼を広げ、印章の通行を阻む。', outro: '劫火を越えた先に、原初の角が見えた。' },
      { label: '連戦・触手', enemyId: 'founder', level: 78, mul: 1.48, intro: '多角の原初悪魔が、無数の触手で玉座を守る。', outro: '触手がほどけ、玉座に座る者の正体が露わになる。' },
      { label: '最終ボス戦', enemyId: 'founder', level: 82, mul: 1.66, boss: true, intro: '「やり直し」を望んだのは、かつて印章を継ぎ損ねた自分自身だった。', outro: '継ぐと決めた瞬間、淵の夜が明ける。' },
    ],
    epilogue: [
      { speaker: '主人公', text: '座らない。印章は、預かって次へ渡すものだ。' },
      { speaker: '村長・調査隊長・仲間・守人', text: '丘にも、墓所にも、回廊にも、門にも、朝が返った。' },
      { speaker: 'ギルド職員', text: '新しい依頼が届いてる。今度は、誰も消えない話だ。' },
      { speaker: '主人公', text: '行こう。今度は守るだけじゃない旅だ。' },
    ],
    ending: '空の玉座と、継がれた印章。五つの物語はここで結ばれる。',
  },
];

export const STORY_CHAPTER_BY_ID = Object.fromEntries(STORY_CHAPTERS.map(c => [c.id, c]));

/** 章のクリア報酬。RANK_REQUIREMENTS をそのまま使うので必要数と報酬数が一致する */
export function storyRewardMaterials(chapter) {
  const ch = typeof chapter === 'string' ? STORY_CHAPTER_BY_ID[chapter] : chapter;
  if (!ch) return [];
  const keys = ch.rewardRank === 'ALL' ? ['SR', 'SSR', 'UR', 'LR'] : [ch.rewardRank];
  const sum = {};
  for (const k of keys) for (const m of (RANK_REQUIREMENTS[k] || [])) sum[m.id] = (sum[m.id] || 0) + m.n;
  return Object.entries(sum).map(([id, n]) => ({ id, n }));
}

/** 進化に必要なコインも報酬に含める（レベル条件は通常の EXP で到達可能） */
export function storyRewardCoins(chapter) {
  const ch = typeof chapter === 'string' ? STORY_CHAPTER_BY_ID[chapter] : chapter;
  if (!ch) return 0;
  const keys = ch.rewardRank === 'ALL' ? ['R', 'SR', 'SSR', 'UR'] : [ch.rank];
  return EVOLUTION_RULES.filter(r => keys.includes(r.from)).reduce((n, r) => n + r.coins, 0);
}

/** 章数・必要数の整合性を検証する（テスト・起動時チェック用） */
export function storyIntegrity() {
  const counts = {};
  for (const ch of STORY_CHAPTERS) {
    for (const m of storyRewardMaterials(ch)) counts[m.id] = (counts[m.id] || 0) + m.n;
  }
  const need = {};
  for (const k of ['SR', 'SSR', 'UR', 'LR']) for (const m of (RANK_REQUIREMENTS[k] || [])) need[m.id] = (need[m.id] || 0) + m.n;
  return {
    chapters: STORY_CHAPTERS.length,
    ranks: STORY_CHAPTERS.map(c => c.rank).join(','),
    stages: STORY_CHAPTERS.map(c => c.stages.length),
    structures: STORY_CHAPTERS.map(c => c.structure).join(','),
    objectivesUnique: new Set(STORY_CHAPTERS.map(c => c.objective)).size === STORY_CHAPTERS.length,
    endingsUnique: new Set(STORY_CHAPTERS.map(c => c.ending)).size === STORY_CHAPTERS.length,
    /** 全章で R→LR の 2 キャラ分（ch5 が 1 キャラ分の全セットを含む） */
    rewardCoversFullEvolution: Object.entries(need).every(([id, n]) => (counts[id] || 0) >= n),
    rewardCounts: counts,
    requiredCounts: need,
    exactPerChapter: STORY_CHAPTERS.every(ch => {
      const keys = ch.rewardRank === 'ALL' ? ['SR', 'SSR', 'UR', 'LR'] : [ch.rewardRank];
      const req = {};
      for (const k of keys) for (const m of (RANK_REQUIREMENTS[k] || [])) req[m.id] = (req[m.id] || 0) + m.n;
      const got = Object.fromEntries(storyRewardMaterials(ch).map(m => [m.id, m.n]));
      return Object.keys(req).length === Object.keys(got).length && Object.entries(req).every(([id, n]) => got[id] === n);
    }),
  };
}

/** 新規ゲーム用の章進行（既存セーブには上書きせず、不足時のみ補完する） */
export function defaultStoryArc() {
  return { chapter: 1, scene: 0, stage: 0, phase: 'prologue', twistSeen: false,
    cleared: [], claimed: [], seen: [], lastReward: null, lastStage: null };
}
