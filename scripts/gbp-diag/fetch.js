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
  const [name, area] = process.argv.slice(2);
  if (!name || !area) {
    console.error('使い方: node fetch.js "事業者名" "エリア"');
    process.exit(1);
  }

  const apiKey = getApiKey();

  const payload = await runAutoDiagnosis(name, area, apiKey);
  if (!payload) {
    console.error(`事業者が見つかりませんでした: ${name} (${area})`);
    process.exit(2);
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
