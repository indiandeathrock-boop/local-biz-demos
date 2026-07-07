#!/usr/bin/env bash
# Bot①（CC操作用）起動ラッパー
# tmuxがペインの擬似TTYを提供するため、claudeを直接起動する。
# 旧実装は script(1) でptyを二重に作っていたが、macOSのscriptはウィンドウ
# リサイズを内側のptyへ伝えないため、claudeが80x24固定で描画し
# 「上部ブランク・描画崩れ」の原因になっていた（2026-07-07実測・修正）。
# launchd(KeepAlive+ThrottleInterval=30)から繰り返し呼ばれても冪等であること

export PATH="/Users/ryukando/.bun/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="/Users/ryukando"
export LANG="ja_JP.UTF-8"

TMUX_BIN="/opt/homebrew/bin/tmux"
WORKDIR="/Users/ryukando/local-biz-demos"
SESSION="cc"

if "$TMUX_BIN" has-session -t "$SESSION" 2>/dev/null; then
    exit 0
fi

"$TMUX_BIN" new-session -d -s "$SESSION" -c "$WORKDIR" \
    "/opt/homebrew/bin/claude --channels plugin:telegram@claude-plugins-official"
