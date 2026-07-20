#!/usr/bin/env bash
# ~/.claude のgit管理外資産（グローバルスキル・グローバルCLAUDE.md）を
# このリポジトリの backups/claude-global/ に同期する。
#
# 正は常に ~/.claude 側。ここはバックアップであり、直接編集しない。
# 復元: cp -R backups/claude-global/skills/* ~/.claude/skills/
#       cp -R backups/claude-global/agents/* ~/.claude/agents/
#       cp backups/claude-global/CLAUDE.md ~/.claude/CLAUDE.md
#       メモリ: cp -R backups/claude-global/memory/<プロジェクト名>/* ~/.claude/projects/<プロジェクト名>/memory/
#       レポート: cp -R backups/reports/* ~/reports/
#
# 認証情報（.credentials.json等）は絶対に対象へ含めないこと。
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="backups/claude-global"
mkdir -p "$DEST"

rsync -a --delete ~/.claude/skills/ "$DEST/skills/"
rsync -a --delete ~/.claude/agents/ "$DEST/agents/"
rsync -a --delete ~/.claude/hooks/ "$DEST/hooks/"
cp ~/.claude/CLAUDE.md "$DEST/CLAUDE.md"
cp ~/.claude/intro-log.md "$DEST/intro-log.md" 2>/dev/null || true
cp ~/.claude/tool-inventory.md "$DEST/tool-inventory.md" 2>/dev/null || true

# 永続メモリ（全プロジェクト分）
for m in ~/.claude/projects/*/memory; do
  [ -d "$m" ] || continue
  proj="$(basename "$(dirname "$m")")"
  rsync -a --delete "$m/" "$DEST/memory/$proj/"
done

# git管理外の分析レポート
rsync -a --delete --exclude=".DS_Store" ~/reports/ "backups/reports/"

# 機密が紛れ込んでいないか確認（実キーのパターンのみ検出。変数名への言及は許容）
if grep -rE "sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_]{10,}|ghp_[A-Za-z0-9]{20,}" "$DEST" backups/reports ; then
  echo "ERROR: バックアップ対象に実キーらしき文字列が含まれています。コミットせず内容を確認してください。" >&2
  exit 1
fi

echo "OK: $DEST に同期しました。git add/commit してください。"
