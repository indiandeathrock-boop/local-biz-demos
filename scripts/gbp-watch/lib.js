'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function loadConfig() {
  const config = loadJson(path.join(__dirname, 'config.json'));
  config.stateDir = expandHome(config.stateDir);
  config.logDir = expandHome(config.logDir);
  config.telegramEnvFile = expandHome(config.telegramEnvFile);
  return config;
}

function statePaths(config) {
  return {
    state: path.join(config.stateDir, 'state.json'),
    pending: path.join(config.stateDir, 'pending.json'),
    decisions: path.join(config.stateDir, 'decisions.json'),
  };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (gbp-watch pipeline)',
        'Accept-Language': 'en, ja;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** RSS 2.0 の <item> を素朴に抽出する（対象4フィードはすべてRSS 2.0であることを確認済み） */
function parseRssItems(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const title = stripTags(pick('title'));
    let link = pick('link').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (!link) {
      const g = b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      if (g) link = stripTags(g[1]);
    }
    if (!title || !link) continue;
    items.push({
      title,
      url: link,
      pubDate: stripTags(pick('pubDate')),
      content: stripTags(pick('description')).slice(0, 3000),
    });
  }
  return items;
}

/** developers.google.com のドキュメント本文を粗く抽出する（HTML差分方式用） */
function extractMainText(html) {
  const main = html.match(/<main[\s>][\s\S]*?<\/main>/i) || html.match(/<article[\s>][\s\S]*?<\/article>/i);
  const body = html.match(/<body[\s\S]*<\/body>/i);
  return stripTags(main ? main[0] : body ? body[0] : html);
}

module.exports = {
  expandHome, loadJson, saveJson, loadConfig, statePaths,
  stripTags, fetchText, parseRssItems, extractMainText,
};
