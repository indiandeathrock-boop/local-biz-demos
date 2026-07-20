---
name: claude-global-backup
description: グローバルスキル・CLAUDE.mdのバックアップ運用 — 編集後にbackup-claude-global.shを実行する
metadata: 
  node_type: memory
  type: project
  originSessionId: 348238df-f862-4ccd-9d95-b96f64663d14
---

`~/.claude/skills/`（fable-method等のグローバルスキル）と `~/.claude/CLAUDE.md` はgit管理外のため、local-biz-demosリポジトリにバックアップする運用（2026-07-07開始）。

- 正は常に `~/.claude` 側。`backups/claude-global/` は復旧用コピーで直接編集しない
- **グローバルスキルや~/.claude/CLAUDE.mdを編集したら `bash scripts/backup-claude-global.sh` を実行してcommit/pushする**
- スクリプトは実キー混入を検査して検出時は停止する
- 復元手順はスクリプト冒頭のコメントに記載
- リポジトリ内 `.claude/skills/` に置かないのはプロジェクトスキルとして二重登録されるため

関連: [[gbp-diag-web-ops]]
