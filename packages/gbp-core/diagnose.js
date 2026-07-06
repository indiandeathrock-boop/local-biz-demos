'use strict';

const { fetchTargetPlace, fetchCompetitors } = require('./places');
const { scoreMechanical } = require('./scoring');

/**
 * 自動診断のデータ取得＋機械採点を一括実行する（Telegram版fetch.jsとWeb版APIの共通処理）。
 * 返り値は従来の data.json と同一構造。
 *
 * @param {object} [options]
 * @param {string} [options.address] 対象事業者の住所（同名法人の混同対策・任意）
 * @param {string} [options.categoryOverride] 競合検索カテゴリの手動指定（Google Place Type・任意）
 */
async function runAutoDiagnosis(name, area, apiKey, options = {}) {
  const { address, categoryOverride } = options;
  const target = await fetchTargetPlace(name, area, apiKey, address);
  if (!target) {
    return null;
  }
  const { competitors, categoryResolution } = await fetchCompetitors(
    target.location,
    target,
    categoryOverride,
    target.id,
    apiKey,
    8
  );
  const mechanical = scoreMechanical(target, competitors);
  return {
    name,
    area,
    generatedAt: new Date().toISOString(),
    target,
    competitors,
    mechanical,
    categoryResolution,
    apiCallCount: 1 + 1 + competitors.length,
  };
}

module.exports = { runAutoDiagnosis };
