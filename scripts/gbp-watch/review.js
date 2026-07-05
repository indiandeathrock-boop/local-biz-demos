#!/usr/bin/env node
'use strict';

/**
 * 巡回候補のレビュー・承認・却下CLI。
 * gbp-scoring-rules.md への書き込みは approve 実行時のみ（人間承認が前提。自動実行禁止）。
 *
 * 使い方:
 *   node review.js list                     候補一覧（/gbp_rules_review 用）
 *   node review.js approve N [--no-push]    候補Nを更新履歴に追記し commit（+push）
 *   node review.js reject N [理由...]        候補Nを却下（理由は任意）
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadJson, saveJson, loadConfig, statePaths } = require('./lib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function loadPending(paths) {
  return loadJson(paths.pending, { candidates: [] });
}

function formatCandidate(c, i) {
  return [
    `【${i + 1}】${c.title}`,
    `出典: ${c.source_url}（${c.sourceName || '-'}）`,
    `種別: ${c.change_type} / confidence: ${c.confidence}`,
    `影響項目: ${c.affected_items.join('、') || 'なし'}`,
    `要約: ${c.summary}`,
    `提案する更新履歴文面:`,
    `  ${c.proposed_update}`,
  ].join('\n');
}

function main() {
  const [cmd, numArg, ...rest] = process.argv.slice(2);
  const config = loadConfig();
  const paths = statePaths(config);
  const pending = loadPending(paths);
  const decisions = loadJson(paths.decisions, {});

  if (cmd === 'list' || !cmd) {
    if (pending.candidates.length === 0) {
      console.log('提案中の候補はありません。');
      return;
    }
    console.log(pending.candidates.map(formatCandidate).join('\n\n---\n\n'));
    console.log(`\n承認: /gbp_rules_approve {番号} ／ 却下: /gbp_rules_reject {番号} [理由]`);
    return;
  }

  const n = parseInt(numArg, 10);
  if (!n || n < 1 || n > pending.candidates.length) {
    console.error(`番号が不正です（1〜${pending.candidates.length}）`);
    process.exit(1);
  }
  const c = pending.candidates[n - 1];

  if (cmd === 'approve') {
    const noPush = rest.includes('--no-push');
    const rulesPath = path.join(REPO_ROOT, config.rulesFile);
    const today = new Date().toISOString().slice(0, 10);
    const entry = `- ${today}: [自動巡回・承認済み] ${c.proposed_update}（出典: ${c.source_url}）\n`;
    const md = fs.readFileSync(rulesPath, 'utf8');
    if (!md.includes('## 更新履歴')) {
      console.error('gbp-scoring-rules.md に「## 更新履歴」セクションが見つかりません');
      process.exit(1);
    }
    fs.writeFileSync(rulesPath, md.replace(/\s*$/, '\n') + entry);

    const git = (a) => execFileSync('git', a, { cwd: REPO_ROOT, encoding: 'utf8' });
    git(['add', config.rulesFile]);
    git(['commit', '-m',
      `GBP採点基準: 更新履歴に自動巡回の承認済みエントリを追記\n\n出典: ${c.source_url}\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>`]);
    if (!noPush) git(['push']);

    decisions[c.source_url] = { decision: 'approved', date: today, title: c.title };
    saveJson(paths.decisions, decisions);
    pending.candidates.splice(n - 1, 1);
    saveJson(paths.pending, pending);
    console.log(`承認・追記完了${noPush ? '（push未実行）' : '（push済み）'}: ${c.title}`);
    return;
  }

  if (cmd === 'reject') {
    const reason = rest.join(' ') || '(理由未記入)';
    decisions[c.source_url] = {
      decision: 'rejected',
      date: new Date().toISOString().slice(0, 10),
      title: c.title,
      reason,
    };
    saveJson(paths.decisions, decisions);
    pending.candidates.splice(n - 1, 1);
    saveJson(paths.pending, pending);
    console.log(`却下: ${c.title}（理由: ${reason}）`);
    return;
  }

  console.error('usage: node review.js [list | approve N [--no-push] | reject N [理由]]');
  process.exit(1);
}

main();
