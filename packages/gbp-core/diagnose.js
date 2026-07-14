'use strict';

const { fetchTargetPlace, fetchCompetitors } = require('./places');
const { scoreMechanical } = require('./scoring');

/**
 * 自動診断のデータ取得＋機械採点を一括実行する（Telegram版fetch.jsとWeb版APIの共通処理）。
 * 返り値は従来の data.json と同一構造（2026-07-14: area→address必須に変更。
 * 町名スコープはaddressから自動抽出されるためエリア入力は廃止。
 * 互換のためdata.areaには町名スコープのラベル（例: 台東区千束）を格納する）。
 *
 * @param {string} address 対象事業者の住所（対象特定と町名スコープの起点。必須）
 * @param {object} [options]
 * @param {string} [options.categoryOverride] 競合検索カテゴリの手動指定（Google Place Type・任意）
 * @param {string} [options.categoryOverrideKeyword] categoryOverrideがNearby Search非対応の
 *   場合に使うText Search用の日本語キーワード（任意。web/lib/industry-types.tsのtextSearchKeyword）
 */
async function runAutoDiagnosis(name, address, apiKey, options = {}) {
  const { categoryOverride, categoryOverrideKeyword } = options;
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
    categoryOverride,
    target.id,
    apiKey,
    8,
    { categoryOverrideKeyword }
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
