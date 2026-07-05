#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getApiKey, fetchTargetPlace, fetchCompetitors } = require('./places');
const { scoreMechanical } = require('./scoring');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const [name, area] = process.argv.slice(2);
  if (!name || !area) {
    console.error('使い方: node fetch.js "事業者名" "エリア"');
    process.exit(1);
  }

  const apiKey = getApiKey();

  const target = await fetchTargetPlace(name, area, apiKey);
  if (!target) {
    console.error(`事業者が見つかりませんでした: ${name} (${area})`);
    process.exit(2);
  }

  const category = target.primaryType || (target.types && target.types[0]) || '';
  const competitors = await fetchCompetitors(area, category, target.id, apiKey, 8);

  const mechanical = scoreMechanical(target, competitors);

  const outDir = path.join(__dirname, '..', '..', 'gbp-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = todayStr();
  const safeName = name.replace(/[\\/:*?"<>|]/g, '');
  const dataPath = path.join(outDir, `${safeName}_${stamp}.data.json`);

  const payload = {
    name,
    area,
    generatedAt: new Date().toISOString(),
    target,
    competitors,
    mechanical,
    apiCallCount: 1 + 1 + competitors.length, // target search+details + competitor search + N details (概算)
  };

  fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`OK: ${dataPath}`);
  console.log(`競合取得数: ${competitors.length}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
