---
name: Vercelセキュリティ対応（2026年4月）
description: Vercel 2026年4月セキュリティ事件を受けたgemini-dashboardのAPIキーローテーション記録
type: project
originSessionId: 7d30618b-de59-45c4-98d7-73260476a982
---
2026年4月20〜21日、Vercelのセキュリティ事件を受けてgemini-dashboardプロジェクトのAPIキーをローテーションした。

**実施内容:**
- ANTHROPIC_API_KEY: 新キーに差し替え済み（Vercel Sensitive設定済み）
- EXA_API_KEY: 新キーに差し替え済み（Vercel Sensitive設定済み）
- SUPABASE_SERVICE_ROLE_KEY: 旧JWTキーから新形式（sb_secret_）に差し替え済み（Vercel Sensitive設定済み）、旧legacyキーはSupabaseで削除済み
- TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID: ローテーションなし（Vercel Encryptedのまま）

**確認結果:**
- gitヒストリーにキー漏洩なし（.env*はgitignore済み）
- Vercel Activity Log（4/17〜4/19）に不審な操作なし

**Why:** Vercelのセキュリティ事件による課金リスク対策。データ漏洩リスクは低いが、APIキー悪用による課金を防ぐのが目的。

**How to apply:** 次回キーローテーションの際は同様の手順で。SUPABASEの新形式（sb_secret_）はSupabase「Publishable and secret API keys」タブから取得。
