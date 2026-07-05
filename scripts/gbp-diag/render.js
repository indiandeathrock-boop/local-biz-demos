#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { combineScores } = require('./scoring');
const { COMPETITOR_RADIUS_METERS } = require('./places');

const COMPETITOR_RADIUS_KM = COMPETITOR_RADIUS_METERS / 1000;

const HUMAN_ITEMS = [
  ['投稿の頻度と質（月4回目安・APSORA構成・誘導ボタン）', 20],
  ['クチコミ返信（全件返信・低評価対応の作法）', 20],
  ['写真の質（カバー・ロゴ・多様性・不安解消の構図）', 15],
  ['説明文・商品説明の訴求力（お客様主語・具体性）', 15],
  ['アカウント体制（オーナー確認・複数人管理・動画認証対応）', 10],
  ['インサイト分析（検索語句・ルート検索の定期確認）', 10],
  ['外部連携（自社HP充実・SNS連携・ローカルSEO）', 10],
];

const ITEM_LABELS = {
  reviewCountRelative: 'クチコミ数（競合相対）',
  basicInfo: '基本情報の完備',
  ratingRelative: '評価（星）',
  reviewQuality: 'クチコミ内容の質',
  primaryCategoryFit: '主カテゴリの適切性',
  additionalCategoryPresence: '追加カテゴリの有無',
  photoVolume: '写真の量',
  productsAttributes: '商品・サービス・属性の登録',
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildBarChart(target, competitors) {
  const entries = [
    { label: target.displayName?.text || '対象', count: target.userRatingCount || 0, rating: target.rating, isTarget: true },
    ...competitors.map((c) => ({ label: c.displayName?.text || '競合', count: c.userRatingCount || 0, rating: c.rating, isTarget: false })),
  ].sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map((e) => e.count), 1);

  return entries
    .map((e) => {
      // F-6: 評価値の根拠を可視化するためバー行に併記する
      // 最小幅2%は表示上のクランプ（Q-3）。実比率が1〜2%程度でも視認できるようにするための意図的な措置。
      const pct = Math.max((e.count / max) * 100, 2);
      const color = e.isTarget ? 'var(--accent)' : 'var(--gray)';
      const weight = e.isTarget ? '700' : '400';
      const ratingText = typeof e.rating === 'number' ? `★${e.rating.toFixed(1)}` : '★—';
      return `
      <div class="bar-row">
        <div class="bar-label" style="font-weight:${weight}">${esc(e.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="bar-value" style="font-weight:${weight}">${e.count}</div>
        <div class="bar-rating">${esc(ratingText)}</div>
      </div>`;
    })
    .join('\n');
}

function buildScoreTable(items) {
  return Object.keys(ITEM_LABELS)
    .map((key) => {
      const item = items[key];
      const label = ITEM_LABELS[key];
      const scoreText = item.score === null ? '判定不能' : `${item.score} / ${item.max}`;
      return `
      <tr>
        <td>${esc(label)}</td>
        <td class="score-cell">${scoreText}</td>
        <td class="note-cell">${esc(item.note)}</td>
      </tr>`;
    })
    .join('\n');
}

function buildHumanItemsTable() {
  return HUMAN_ITEMS.map(
    ([label, max]) => `
      <tr><td>${esc(label)}</td><td class="score-cell">/ ${max}</td></tr>`
  ).join('\n');
}

function render(dataPath, judgedPath) {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const judged = judgedPath && fs.existsSync(judgedPath)
    ? JSON.parse(fs.readFileSync(judgedPath, 'utf-8'))
    : {
        reviewQuality: { score: null, max: 10, note: '未判定' },
        primaryCategoryFit: { score: null, max: 6, note: '未判定' },
        insight: '',
        priorities: [],
        risk: '',
      };

  const combined = combineScores(data.mechanical, {
    reviewQuality: judged.reviewQuality,
    primaryCategoryFit: judged.primaryCategoryFit,
  });

  const targetName = data.target.displayName?.text || data.name;
  // F-1: 分母は常に100固定。判定不能項目の存在はバッジ文言で語らず注記行（unjudgedNote）に出す。
  const scoreLine = `自動診断 ${combined.earned}点／100点（人間診断は未実施）`;
  const unjudgedItems = Object.entries(combined.items).filter(([, item]) => item.score === null);
  const unjudgedNote = unjudgedItems.length
    ? `※ 一部項目（${unjudgedItems.map(([key]) => `${ITEM_LABELS[key]}／${combined.items[key].max}点分`).join('、')}）はAPI経由で確認できないため「判定不能」としています。`
    : '';

  const ratingAll = [data.target, ...data.competitors].filter((c) => typeof c.rating === 'number');
  const sorted = [...ratingAll].sort((a, b) => b.userRatingCount - a.userRatingCount);
  const rank = sorted.findIndex((c) => c === data.target) + 1;

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GBP診断レポート | ${esc(targetName)}</title>
<style>
  :root {
    --accent: #d6602e;
    --gray: #c7c2ba;
    --ink: #1c1a17;
    --bg: #ffffff;
    --bg-soft: #f7f5f2;
    --border: #e5e1da;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
    color: var(--ink);
    background: var(--bg);
    line-height: 1.7;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 40px 20px 80px; }
  header { padding-bottom: 28px; border-bottom: 3px solid var(--accent); margin-bottom: 32px; }
  header .date { font-size: 13px; color: #8a8478; margin-bottom: 6px; }
  header h1 { font-size: 26px; margin: 0 0 14px; }
  .score-badge {
    display: inline-block;
    font-size: 20px;
    font-weight: 700;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-left: 6px solid var(--accent);
    padding: 10px 18px;
    border-radius: 4px;
  }
  section { margin-bottom: 40px; }
  h2 { font-size: 17px; border-left: 5px solid var(--accent); padding-left: 10px; margin-bottom: 16px; }
  .rank-line { font-size: 15px; }
  .rank-note { font-size: 12px; color: #8a8478; margin-top: 6px; }
  .rank-num { font-size: 28px; font-weight: 700; color: var(--accent); }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 13px; }
  .bar-label { width: 150px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; background: var(--bg-soft); border-radius: 3px; height: 18px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .bar-value { width: 40px; text-align: right; flex-shrink: 0; }
  .bar-rating { width: 44px; text-align: right; flex-shrink: 0; color: #8a8478; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  td { padding: 10px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  .score-cell { white-space: nowrap; font-weight: 700; width: 90px; }
  .note-cell { color: #5a5449; }
  .insight-box, .risk-box {
    background: var(--bg-soft);
    border-radius: 6px;
    padding: 18px 20px;
    font-size: 14.5px;
  }
  .priorities { list-style: none; padding: 0; margin: 0; }
  .priorities li {
    display: flex; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14.5px;
  }
  .priorities .num {
    flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
    background: var(--accent); color: #fff; font-weight: 700; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
  }
  .human-note { font-size: 12.5px; color: #8a8478; margin-bottom: 10px; }
  .unjudged-note { font-size: 12.5px; color: #8a8478; margin-top: 10px; }
  .score-explain { font-size: 12.5px; color: #8a8478; margin-top: 10px; max-width: 560px; }
  footer { font-size: 12px; color: #a39d90; margin-top: 60px; border-top: 1px solid var(--border); padding-top: 16px; }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="date">診断日: ${esc(new Date(data.generatedAt).toLocaleDateString('ja-JP'))}</div>
    <h1>${esc(targetName)} — GBP診断レポート</h1>
    <div class="score-badge">${esc(scoreLine)}</div>
    ${unjudgedNote ? `<div class="unjudged-note">${esc(unjudgedNote)}</div>` : ''}
    <div class="score-explain">本診断は「自動診断100点＋人間診断100点」の2部構成で、両方完了後の平均値が最終スコアとなります。本レポートは自動診断のみ完了した段階のものです。</div>
  </header>

  <section>
    <h2>エリア内順位（クチコミ数）</h2>
    <div class="rank-line"><span class="rank-num">${rank || '—'}</span> 位 / ${ratingAll.length}社中（${esc(data.area)}エリア）</div>
    <div class="rank-note">※対象事業者から半径${COMPETITOR_RADIUS_KM}km圏内でGoogleマップ上位表示される同業種${data.competitors.length}社との比較です（エリア内の全事業者数ではありません）</div>
  </section>

  <section>
    <h2>クチコミ数の競合比較</h2>
    ${buildBarChart(data.target, data.competitors)}
  </section>

  <section>
    <h2>項目別採点</h2>
    <table>
      <tbody>
        ${buildScoreTable(combined.items)}
      </tbody>
    </table>
  </section>

  <section>
    <h2>所見</h2>
    <div class="insight-box">${esc(judged.insight) || '（未記入）'}</div>
  </section>

  <section>
    <h2>改善優先順位</h2>
    <ol class="priorities">
      ${(judged.priorities || []).map((p, i) => `<li><span class="num">${i + 1}</span><span>${esc(p)}</span></li>`).join('\n')}
    </ol>
  </section>

  <section>
    <h2>要確認項目（人間診断・現地確認/ヒアリングが必要）</h2>
    <div class="human-note">以下はツールでは自動採点していません。現地確認・ヒアリングが必要な項目です。</div>
    <table><tbody>${buildHumanItemsTable()}</tbody></table>
  </section>

  <section>
    <h2>放置した場合の見通し</h2>
    <div class="risk-box">${esc(judged.risk) || '（未記入）'}</div>
  </section>

  <footer>
    Google Business Profile 公開情報（Google Places API）をもとに自動生成。取得競合数: ${data.competitors.length}社（対象事業者から半径${COMPETITOR_RADIUS_KM}km以内、Nearby Search上位${data.competitors.length}件）。
  </footer>

</div>
</body>
</html>`;

  return html;
}

function main() {
  const [dataPath, judgedPath, outPath] = process.argv.slice(2);
  if (!dataPath || !outPath) {
    console.error('使い方: node render.js <data.json> <judged.json|-> <out.html>');
    process.exit(1);
  }
  const html = render(dataPath, judgedPath === '-' ? null : judgedPath);
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`OK: ${outPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { render };
