'use strict';

const { fetchTargetPlace, fetchCompetitors } = require('./places');
const { scoreMechanical } = require('./scoring');

/**
 * 自動診断のデータ取得＋機械採点を一括実行する（Telegram版fetch.jsとWeb版APIの共通処理）。
 * 返り値は従来の data.json と同一構造（2026-07-14: area→address必須に変更。
 * 町名スコープはaddressから自動抽出されるためエリア入力は廃止。
 * 互換のためdata.areaには町名スコープのラベル（例: 台東区千束）を格納する）。
 *
 * 2026-07-17: 業種の手動指定（categoryOverride）を廃止。競合検索・
 * カテゴリ採点ともGoogle実データ（primaryType/types）のみを情報源とする
 * （詳細はplaces.jsのcandidateCompetitorCategories()コメント参照）。
 *
 * @param {string} address 対象事業者の住所（対象特定と町名スコープの起点。必須）
 */
async function runAutoDiagnosis(name, address, apiKey) {
  if (!address) {
    throw new Error('address は必須です（町名スコープの起点として使用します）');
  }
  const target = await fetchTargetPlace(name, address, apiKey);
  if (!target) {
    return null;
  }
  const { competitors, categoryResolution, competitorScope } = await fetchCompetitors(
    target.location,
    target,
    target.id,
    apiKey,
    8
  );
  const mechanical = scoreMechanical(target, competitors);
  return {
    name,
    area: [competitorScope.locality, competitorScope.townName].filter(Boolean).join('') || null,
    address,
    generatedAt: new Date().toISOString(),
    target,
    competitors,
    mechanical,
    categoryResolution,
    competitorScope,
    apiCallCount: 1 + 1 + competitors.length,
  };
}

module.exports = { runAutoDiagnosis };
