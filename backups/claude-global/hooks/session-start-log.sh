#!/usr/bin/env bash
# SessionStart hook: セッション開始をログに記録する。
# トラブル時（Telegram応答不能等）に「いつからCCが動いていたか」を追跡する手掛かりにする。
echo "$(date '+%Y-%m-%d %H:%M:%S') session_start cwd=$(pwd)" >> ~/.claude/logs/session-start.log
