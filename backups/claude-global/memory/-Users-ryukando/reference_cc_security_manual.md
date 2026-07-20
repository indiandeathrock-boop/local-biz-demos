---
name: reference-cc-security-manual
description: CC新規環境セットアップ時のセキュリティ手順マニュアル（実作業記録から一般化）
metadata: 
  node_type: memory
  type: reference
  originSessionId: ce431527-085a-4a00-923a-19239435a814
---

実ファイル: `~/.claude/CC-security-setup-manual.md`

新規CCプロジェクト立ち上げ時に参照するセキュリティチェックリストと手順書。
2026年6月の実監査（local-biz-demos / post-x / gemini-dashboard）をもとにRKが作成。

**Why:** 同じセキュリティミス（.env裸置き、git init前のgitignore未作成、未コミット放置）を繰り返さないための台帳として保管。

**How to apply:** 新規プロジェクト作成時・CC環境リセット時に `~/.claude/CC-security-setup-manual.md` を参照する。チェックリスト（セクション4）が実施確認の基準。

主要3原則（セクション6）:
1. 合鍵は ~/.secrets/ に隔離。コマンド禁止より置き場所変更が本質。
2. 大きな作業前に必ずgit commit。セーブがあれば事故から生還できる。
3. 「全部禁止」が安全とは限らない。使わないものだけ閉じる。
