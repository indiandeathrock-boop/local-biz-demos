#!/usr/bin/env bash
# GBP最新情報巡回パイプラインの手動実行ラッパー（方式B）
# 使い方: bash scripts/gbp-watch/run.sh [--init|--no-notify|--inject FILE]
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
exec node run.js "$@"
