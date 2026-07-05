'use strict';

const PHOTO_CAP = 10; // Places API (New) が Details で返す写真配列の実装上の上限

function scoreReviewCountRelative(target, competitors) {
  const validComp = competitors.filter((c) => typeof c.userRatingCount === 'number');
  if (validComp.length === 0) {
    return { score: null, max: 25, note: '判定不能（競合データ取得不可）' };
  }
  const avg = validComp.reduce((s, c) => s + c.userRatingCount, 0) / validComp.length;
  const targetCount = target.userRatingCount || 0;
  if (avg === 0) {
    return { score: null, max: 25, note: '判定不能（競合クチコミ平均が0）' };
  }
  const ratio = targetCount / avg;
  let score;
  if (ratio >= 1) score = 25;
  else if (ratio >= 0.5) score = 15;
  else if (ratio >= 0.1) score = 8;
  else score = 3;
  return {
    score,
    max: 25,
    note: `対象${targetCount}件 / 競合平均${avg.toFixed(1)}件（比率${(ratio * 100).toFixed(0)}%）`,
  };
}

function scoreBasicInfo(target) {
  const items = [
    ['名称', !!target.displayName?.text],
    ['住所', !!target.formattedAddress],
    ['電話', !!target.nationalPhoneNumber],
    ['営業時間', !!target.regularOpeningHours],
    ['URL', !!target.websiteUri],
  ];
  const filled = items.filter(([, ok]) => ok).length;
  return {
    score: filled * 4,
    max: 20,
    note: items.map(([label, ok]) => `${label}:${ok ? '○' : '×'}`).join(' '),
  };
}

/**
 * 評価値が同率の場合、クチコミ数（userRatingCount）降順でタイブレークする（2026-07-05追加）。
 * 理由: 評価4.9同率が実際に発生し（東宝ハウス松戸とルームプラス）、根拠のない配列順で
 * 「1位」を決めていたため。クチコミ数が多いほど評価の信頼性が高いとみなし優先する。
 */
function scoreRatingRelative(target, competitors) {
  const all = [target, ...competitors].filter((c) => typeof c.rating === 'number');
  if (all.length < 2) {
    return { score: null, max: 15, note: '判定不能（比較対象不足）' };
  }
  const sorted = [...all].sort(
    (a, b) => b.rating - a.rating || (b.userRatingCount || 0) - (a.userRatingCount || 0)
  );
  const rank = sorted.findIndex((c) => c === target);
  const percentile = rank / (all.length - 1); // 0 = 最上位

  let score;
  if (target.rating < 4.0) {
    score = 5; // 一律5点以下のルール（本ツールでは5点固定）
  } else if (percentile <= 1 / 3) {
    score = 15;
  } else if (percentile <= 2 / 3) {
    score = 10;
  } else {
    score = 5;
  }
  const tieCount = all.filter((c) => c.rating === target.rating).length;
  const tieNote = tieCount > 1 ? `（評価${target.rating}同率${tieCount}社中、クチコミ数順で${rank + 1}位）` : '';
  return {
    score,
    max: 15,
    note: `評価${target.rating} / エリア内${all.length}社中${rank + 1}位${tieNote}`,
  };
}

function scorePhotoVolume(target) {
  const count = (target.photos || []).length;
  if (count >= PHOTO_CAP) {
    return {
      score: null,
      max: 10,
      note: `判定不能（API取得上限${PHOTO_CAP}枚に到達のため総数不明。上限到達は活発な可能性を示唆）`,
    };
  }
  let score;
  if (count === 0) score = 0;
  else if (count <= 20) score = 3;
  else if (count <= 50) score = 7;
  else score = 10;
  return { score, max: 10, note: `API取得件数${count}枚（上限未到達のため実数）` };
}

function scoreProductsAttributes() {
  return {
    score: null,
    max: 10,
    note: '判定不能（Places APIでは第三者事業者の商品・サービス登録情報を取得できないため。人間診断で確認）',
  };
}

/**
 * カテゴリ設定10点のうち、追加カテゴリ有無（4点）はPlaces APIのtypes/primaryTypeでは
 * 確認できない（GBP管理画面上の追加カテゴリはAPI非公開）。常に判定不能として扱う（F-7）。
 * 残り6点（主カテゴリの適切性）はClaudeがtypes/primaryTypeを見て判定する（primaryCategoryFit）。
 */
function scoreAdditionalCategoryPresence() {
  return {
    score: null,
    max: 4,
    note: '判定不能（追加カテゴリの登録有無はPlaces APIのtypes/primaryTypeからは確認できないため。人間診断で確認）',
  };
}

/**
 * 機械的に採点できる項目のみを計算する。
 * クチコミ内容の質・主カテゴリの適切さはClaudeが個別に判定し、後段でマージする。
 */
function scoreMechanical(target, competitors) {
  return {
    reviewCountRelative: scoreReviewCountRelative(target, competitors),
    basicInfo: scoreBasicInfo(target),
    ratingRelative: scoreRatingRelative(target, competitors),
    photoVolume: scorePhotoVolume(target),
    productsAttributes: scoreProductsAttributes(),
    additionalCategoryPresence: scoreAdditionalCategoryPresence(),
  };
}

/**
 * 機械採点 + Claude判定分（reviewQuality, primaryCategoryFit）を合算して総合スコアを出す。
 * judged = { reviewQuality: {score,max,note}, primaryCategoryFit: {score,max,note} }
 */
function combineScores(mechanical, judged) {
  const all = { ...mechanical, reviewQuality: judged.reviewQuality, primaryCategoryFit: judged.primaryCategoryFit };
  let earned = 0;
  let possible = 0;
  let hasUnjudged = false;
  for (const key of Object.keys(all)) {
    const item = all[key];
    possible += item.max;
    if (item.score === null) {
      hasUnjudged = true;
    } else {
      earned += item.score;
    }
  }
  return { items: all, earned, possible, hasUnjudged };
}

module.exports = { scoreMechanical, combineScores, PHOTO_CAP };
