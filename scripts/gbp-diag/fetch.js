#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getApiKey, runAutoDiagnosis } = require('../../packages/gbp-core');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const [name, address, categoryOverride] = process.argv.slice(2);
  if (!name || !address) {
    console.error(
      '使い方: node fetch.js "事業者名" "住所" ["業種カテゴリ（任意・Google Place Type）"]\n' +
        '（2026-07-14: エリア引数を廃止。競合の検索範囲は住所の町名から自動設定されます）'
    );
    process.exit(1);
  }

  const apiKey = getApiKey();

  const payload = await runAutoDiagnosis(name, address, apiKey, { categoryOverride });
  if (!payload) {
    console.error(`事業者が見つかりませんでした: ${name} (${address})`);
    process.exit(2);
  }
  if (payload.categoryResolution) {
    console.log(`競合検索カテゴリ: ${payload.categoryResolution.category}（${payload.categoryResolution.source}）`);
  }
  if (payload.competitorScope) {
    const s = payload.competitorScope;
    console.log(
      s.mode === 'town'
        ? `競合スコープ: 町名「${s.townName}」優先・半径${s.radiusUsed / 1000}km圏（町名一致${s.sameTownCount}件）`
        : `競合スコープ: 町名スコープ不可のため半径${s.radiusUsed / 1000}km方式`
    );
  }

  const outDir = path.join(__dirname, '..', '..', 'gbp-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = todayStr();
  const safeName = name.replace(/[\\/:*?"<>|]/g, '');
  const dataPath = path.join(outDir, `${safeName}_${stamp}.data.json`);

  fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`OK: ${dataPath}`);
  console.log(`競合取得数: ${payload.competitors.length}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
