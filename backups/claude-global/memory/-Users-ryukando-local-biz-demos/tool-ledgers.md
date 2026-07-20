---
name: tool-ledgers
description: ツール棚卸し表とintro-log導入記録のファイル所在。新規ツール・スキル・エージェント・MCP導入時に両方を更新する
metadata: 
  node_type: memory
  type: project
  originSessionId: 2cb86b76-c8c1-4c16-b78a-caf90e9cdf4b
---

RKのツール管理台帳は2つ（2026-07-14初版作成）:
- **棚卸し表（現在の一覧）**: `~/.claude/tool-inventory.md` — 6分類＋4判断軸の表。新規導入時に1行追記、月1目安で見直し
- **導入記録（時系列の日記）**: `~/.claude/intro-log.md` — [[claude-global-backup]]の対象スクリプトでバックアップされる

新しいツール・スキル・エージェント・MCPを導入したら、intro-logスキルで記録→棚卸し表に1行追記、の順で両方更新する。
棚卸し表の申し送り: agent 3件（advisor/worker/verifier）は2026-07-14時点で実使用ゼロ。8月頭の見直しで未使用なら外す判断。
