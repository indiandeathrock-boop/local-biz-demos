#!/usr/bin/env node
'use strict';

/**
 * GBP最新情報自動巡回パイプライン（月次実行）
 *
 * 使い方:
 *   node run.js            通常実行（Step 1〜4）
 *   node run.js --init     初回実行: 現時点の全記事を既読化するのみ（分類・通知なし）
 *   node run.js --no-notify   Telegram通知をスキップ（テスト用）
 *   node run.js --inject FILE FILEのJSON配列（{title,url,content}）を新着として注入（テスト用）
 *
 * 状態: ~/.gbp-watch/{state,pending,decisions}.json
 * ログ: ~/logs/gbp-watch/run-YYYY-MM-DDTHH-mm-ss.json（毎回必ず書く）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  loadJson, saveJson, loadConfig, statePaths,
  fetchText, parseRssItems, extractMainText,
} = require('./lib');
const { classifyArticle } = require('./classify');
const { sendTelegram } = require('./notify');

const SEEN_CAP = 500;

async function collectFromSource(source, state, config, initMode) {
  const srcState = state.sources[source.id] || (state.sources[source.id] = { seen: [] });
  const seenSet = new Set(srcState.seen);
  const newItems = [];

  if (source.kind === 'rss') {
    const xml = await fetchText(source.url, config.fetchTimeoutMs);
    const items = parseRssItems(xml);
    if (items.length === 0) throw new Error('RSSからitemを抽出できませんでした（フィード仕様変更の可能性）');
    for (const it of items) {
      if (seenSet.has(it.url)) continue;
      seenSet.add(it.url);
      if (!initMode) newItems.push({ ...it, sourceId: source.id, sourceName: source.name });
    }
    srcState.seen = [...seenSet].slice(-SEEN_CAP);
    return { fetched: items.length, newItems };
  }

  if (source.kind === 'html-diff') {
    const html = await fetchText(source.url, config.fetchTimeoutMs);
    const text = extractMainText(html).slice(0, 30000);
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    const prevText = srcState.snapshotText || '';
    const changed = srcState.snapshotHash && srcState.snapshotHash !== hash;
    if (changed && !initMode) {
      const prevSet = new Set(prevText.split(/[。.]\s*/));
      const added = text.split(/[。.]\s*/).filter((s) => s.length > 10 && !prevSet.has(s));
      newItems.push({
        title: `${source.name} ページ更新を検知`,
        url: source.url,
        pubDate: new Date().toISOString(),
        content: (added.join('。') || text).slice(0, 3000),
        sourceId: source.id,
        sourceName: source.name,
      });
    }
    srcState.snapshotHash = hash;
    srcState.snapshotText = text;
    return { fetched: 1, newItems };
  }

  throw new Error(`未知のkind: ${source.kind}`);
}

function passesKeywordFilter(item, keywords) {
  const hay = `${item.title} ${(item.content || '').slice(0, 500)}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

async function main() {
  const args = process.argv.slice(2);
  const initMode = args.includes('--init');
  const noNotify = args.includes('--no-notify');
  const injectIdx = args.indexOf('--inject');
  const injectFile = injectIdx >= 0 ? args[injectIdx + 1] : null;

  const config = loadConfig();
  const sources = loadJson(path.join(__dirname, 'sources.json'));
  const keywords = loadJson(path.join(__dirname, 'keywords.json'));
  const paths = statePaths(config);
  const state = loadJson(paths.state, { sources: {} });
  const pending = loadJson(paths.pending, { candidates: [] });
  const decisions = loadJson(paths.decisions, {});

  const log = {
    ranAt: new Date().toISOString(),
    mode: initMode ? 'init' : 'normal',
    sources: [],
    totalNewItems: 0,
    passedFilter: 0,
    classified: 0,
    relevantCount: 0,
    classifyErrors: [],
    notified: false,
  };

  // Step 1: 巡回
  let newItems = [];
  for (const source of sources) {
    try {
      const r = await collectFromSource(source, state, config, initMode);
      log.sources.push({ id: source.id, fetched: r.fetched, new: r.newItems.length, error: null });
      newItems.push(...r.newItems);
    } catch (e) {
      log.sources.push({ id: source.id, fetched: 0, new: 0, error: e.message });
    }
  }

  if (injectFile) {
    const injected = loadJson(injectFile).map((a) => ({ sourceId: 'inject', sourceName: 'テスト注入', ...a }));
    newItems.push(...injected);
    log.sources.push({ id: 'inject', fetched: injected.length, new: injected.length, error: null });
  }

  // 承認/却下済み・提案中のURLは再処理しない（再提案防止）
  const pendingUrls = new Set(pending.candidates.map((c) => c.source_url));
  newItems = newItems.filter((it) => !decisions[it.url] && !pendingUrls.has(it.url));
  log.totalNewItems = newItems.length;

  if (!initMode) {
    // Step 2: 一次フィルタ
    const passed = newItems.filter((it) => passesKeywordFilter(it, keywords));
    log.passedFilter = passed.length;

    // Step 3: 二次分類
    const relevant = [];
    for (const item of passed) {
      const r = classifyArticle(item, config);
      if (r.error) {
        log.classifyErrors.push({ url: item.url, error: r.error });
        continue;
      }
      log.classified++;
      if (r.relevant) relevant.push({ ...r, sourceName: item.sourceName, proposedAt: log.ranAt });
    }
    log.relevantCount = relevant.length;

    // Step 4: 通知（relevant 1件以上のときのみ）
    if (relevant.length > 0) {
      pending.candidates.push(...relevant);
      saveJson(paths.pending, pending);
      const failedSources = log.sources.filter((s) => s.error);
      const failNote = failedSources.length
        ? `\n（取得失敗ソース: ${failedSources.map((s) => s.id).join(', ')}）` : '';
      if (!noNotify) {
        const text = `📋 GBP最新情報巡回（${log.ranAt.slice(0, 10)}）\n採点基準に影響する可能性: ${relevant.length}件${failNote}\n\n/gbp_rules_review で詳細を確認してください`;
        await sendTelegram(config, text);
        log.notified = true;
      }
    }
  }

  saveJson(paths.state, state);
  const logFile = path.join(config.logDir, `run-${log.ranAt.replace(/[:.]/g, '-')}.json`);
  saveJson(logFile, log);
  console.log(JSON.stringify({ logFile, ...log }, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
