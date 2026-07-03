#!/usr/bin/env bash
# Bot①（CC操作用）起動ラッパー
# launchdからTTYなしで起動するためtmuxセッション"cc"の中でscriptコマンドにより擬似TTYを確保する
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
    "script -q /dev/null /opt/homebrew/bin/claude --channels plugin:telegram@claude-plugins-official"
