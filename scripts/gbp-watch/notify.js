'use strict';

const fs = require('fs');

function readBotToken(envFile) {
  const txt = fs.readFileSync(envFile, 'utf8');
  const m = txt.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
  if (!m) throw new Error(`TELEGRAM_BOT_TOKEN が ${envFile} に見つかりません`);
  return m[1].trim();
}

async function sendTelegram(config, text) {
  const token = readBotToken(config.telegramEnvFile);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: config.chatId, text }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`Telegram送信失敗: ${JSON.stringify(j).slice(0, 200)}`);
  return j.result.message_id;
}

module.exports = { sendTelegram };
