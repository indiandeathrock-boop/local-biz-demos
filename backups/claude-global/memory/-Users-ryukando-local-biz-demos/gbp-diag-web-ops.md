---
name: gbp-diag-web-ops
description: GBP診断Webアプリ（gbp-diag-web）の運用情報 — Vercelプロジェクト・Supabase・シークレットの所在
metadata: 
  node_type: memory
  type: project
  originSessionId: 348238df-f862-4ccd-9d95-b96f64663d14
---

GBP診断Webアプリ版の運用情報（2026-07-06本番稼働開始）:

- 本番URL: https://gbp-diag-web.vercel.app（Vercelプロジェクト名 gbp-diag-web、Root Directory=web、framework=nextjs。GitHub自動デプロイ未接続→デプロイはリポジトリルートから `vercel deploy --prod`）
- 認証情報はすべて `~/.secrets/gbp-diag-web.env`（ACCESS_CODE / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY）。Vercel本番envにも同じものを設定済み
- Supabaseプロジェクト: ref `oxcuazsapnmvkjtnsinq`（東京、indiandeathrock-boop Org配下・羅針盤とは別プロジェクト）。DDLはRKのダッシュボードSQL Editorか、DBパスワード（RK保管）でpsql接続（pooler: aws-0-ap-northeast-1.pooler.supabase.com、user postgres.oxcuazsapnmvkjtnsinq）。sb_secretキーではDDL不可、ALTER ROLEも権限なし
- 採点ロジックは packages/gbp-core をTelegram版(scripts/gbp-diag)と共有。採点基準変更時は gbp-scoring-rules.md → gbp-core → 両版に反映される
- 所見生成は claude-haiku-4-5（structured outputs）。コスト約2円/診断、全体約35円/診断
- 2026-07-06にキー漏えい対応で全キーをローテーション済み（チャット履歴に旧キーが平文で残ったため）
