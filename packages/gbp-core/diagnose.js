'use strict';

const { fetchTargetPlace, fetchCompetitors } = require('./places');
const { scoreMechanical } = require('./scoring');

/**
 * 自動診断のデータ取得＋機械採点を一括実行する（Telegram版fetch.jsとWeb版APIの共通処理）。
 * 返り値は従来の data.json と同一構造。
 */
async function runAutoDiagnosis(name, area, apiKey) {
  const target = await fetchTargetPlace(name, area, apiKey);
  if (!target) {
    return null;
  }
  const category = target.primaryType || (target.types && target.types[0]) || '';
  const competitors = await fetchCompetitors(target.location, category, target.id, apiKey, 8);
  const mechanical = scoreMechanical(target, competitors);
  return {
    name,
    area,
    generatedAt: new Date().toISOString(),
    target,
    competitors,
    mechanical,
    apiCallCount: 1 + 1 + competitors.length,
  };
}

module.exports = { runAutoDiagnosis };
