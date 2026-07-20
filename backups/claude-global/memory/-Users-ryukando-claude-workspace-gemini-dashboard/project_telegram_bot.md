---
name: Telegramボット構成
description: Claude CodeのTelegramチャンネルとプロジェクト通知ボットの構成
type: project
originSessionId: 7d30618b-de59-45c4-98d7-73260476a982
---
**RyuK_notify_bot**（@RyuK_notify_bot）の用途:
1. Claude Code Telegramチャンネル（MCP plugin）— TelegramからClaudeに話しかける用途
2. gemini-compass.comのCron通知 — 毎朝運勢をTelegramに送信

**Claude Code側の設定:**
- トークン: ~/.claude/channels/telegram/.env に TELEGRAM_BOT_TOKEN として保存
- アクセス制御: ~/.claude/channels/telegram/access.json（dmPolicy: allowlist、許可ID: 5881925140）
- ポーリング方式（webhookなし）→ Claude Code再起動で接続が復活する

**Why:** 一つのボットを両用途で使っているため、トークンを変えるときは両方の設定を更新する必要がある。
