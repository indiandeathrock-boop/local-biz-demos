---
name: Vercel環境変数の構成
description: gemini-dashboardプロジェクトのVercel環境変数一覧と用途
type: project
originSessionId: 7d30618b-de59-45c4-98d7-73260476a982
---
gemini-dashboard（vercel上の名前）= gemini-compass.com のVercel環境変数:

- ANTHROPIC_API_KEY: Claude API（Sensitive）
- EXA_API_KEY: Exa検索API（Sensitive）
- SUPABASE_SERVICE_ROLE_KEY: Supabase adminアクセス（Sensitive、sb_secret_形式）
- NEXT_PUBLIC_SUPABASE_URL: SupabaseプロジェクトURL
- NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase公開キー
- CRON_SECRET: Vercel Cron認証用シークレット
- TELEGRAM_BOT_TOKEN: RyuK_notify_bot のトークン（Encrypted）
- TELEGRAM_CHAT_ID: Telegram通知先チャットID（Encrypted）

**Why:** 環境変数の全体像を把握するための記録。

**How to apply:** 新しいキーを追加する際や、キーが足りないエラーが出た際に参照。
