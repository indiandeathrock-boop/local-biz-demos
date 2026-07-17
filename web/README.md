# GBP診断ツール Webアプリ版（RK専用）

Telegram版（`/gbp-diag`）の診断をブラウザで完結させるWebアプリ。自動診断の実行 → 人間診断チェック入力 → 総合レポート閲覧・PDF保存までを1つのフローで行う。

- スタック: Next.js (App Router) / Vercel / Supabase / Anthropic API (Haiku)
- 採点ロジックは `packages/gbp-core`（Telegram版と共有・単一実装）。採点基準は `gbp-scoring-rules.md` が正
- 利用者はRKのみ。アクセスコード1つの簡易認証、noindex/robots.txt設定済み

## 画面フロー

1. `/` 診断開始（事業者名＋住所。2026-07-14にエリア入力を廃止、競合範囲は住所の町名から自動設定）＋診断履歴一覧
2. 分析中表示（Places API取得→採点→Claude所見生成、30秒〜1分）
3. `/d/{id}` 自動診断結果（スコアバッジ・登録カテゴリ・競合比較・項目別採点・所見・改善優先順位・放置リスク・PDF保存ボタン）
4. `/d/{id}/human` 人間診断チェックシート（自動集計・判定不能トグル・2秒デバウンス自動下書き保存＋一時保存ボタン）
5. `/d/{id}/report` 総合診断レポート（総合スコア=平均・内訳・強み弱み・時間軸対策・A4印刷対応）

人間診断が未実施のレコードは一覧に「未実施」と表示され、続きから入力できる（現地に行く前に自動診断だけ済ませる運用）。同一事業者の再診断は新規レコードとして積まれる。

## PDF保存の実装方式（2026-07-17追加）

画面3・画面5とも `window.print()` + 印刷用CSS（`app/d/[id]/print-button.tsx`、`globals.css`の`@media print`）で実装している。

選定理由: html2pdf.js/jsPDF等のクライアントサイドPDF生成ライブラリは検討したが不採用。理由は
(1) 画面5（総合レポート）で既に同じ方式が動いており実装の一貫性を優先、
(2) 追加の依存パッケージ・バンドルサイズ増を避けられる、
(3) canvas経由のレンダリングで日本語フォントの表示崩れリスクがある一方、
`window.print()`はブラウザネイティブのレンダリングをそのまま使うため文字化け等のリスクがない。
ワンクリックでファイルがダウンロードされる体験は失われる（印刷ダイアログを1段階挟む）が、
実装のシンプルさ・保守コストを優先した。

ファイル名は `<title>`（`generateMetadata`で `{事業者名}_GBP診断_{診断日}` 形式に設定）が
ブラウザの保存ダイアログの既定ファイル名になる。`.no-print`クラスの要素（パーソナルインサイト
開始ボタン等の内部操作UI）は印刷時に非表示になる。

## 環境変数（Vercelに設定）

| 変数 | 内容 | 入手元 |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Places API (New) キー | Telegram版と同じ（`~/.secrets/gbp-diag.env`） |
| `ANTHROPIC_API_KEY` | Anthropic APIキー（従量課金） | console.anthropic.com（羅針盤で使用中のキーを流用） |
| `SUPABASE_URL` | 新規SupabaseプロジェクトのURL | Supabaseダッシュボード → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | service_roleキー（サーバ側のみで使用） | 同上。**絶対にクライアントへ出さない** |
| `ACCESS_CODE` | ログイン用アクセスコード | 任意の文字列を設定 |

設定: `cd web && vercel env add {NAME} production`（またはVercelダッシュボード）。

## Supabaseセットアップ（初回のみ・人間側の操作）

羅針盤（gemini-dashboard）とは**別プロジェクト**にする（コスト切り分け・障害分離・将来の見込み客開放時のデータ分離のため）。

1. https://supabase.com/dashboard → New project（リージョン: Northeast Asia (Tokyo)、DBパスワードは保存しておく）
2. 作成後、SQL Editor で `web/supabase/migrations/0001_init.sql` の内容を貼り付けて実行
   - または Supabase CLI: `supabase link --project-ref {ref}` → `supabase db push`（要Personal Access Token）
3. Settings → API から `URL` と `service_role` キーを取得し、Vercel環境変数に設定

テーブルはRLS有効・anonからのアクセス不可（サーバ側のservice_roleのみ）。CLAUDE.mdのCRITICALルール（RLS有効化＋明示的GRANT）準拠。

## コスト概算（1診断あたり）

| 項目 | 概算 |
|---|---|
| Google Places API | 約$0.2（対象＋競合8件、Advanced SKU。既存Telegram版と同じ） |
| Anthropic API（claude-haiku-4-5） | 入力$1/MTok・出力$5/MTok。1診断 約3〜5K入力＋1〜2K出力 ≒ **$0.01〜0.015（約2円）** |
| 合計 | **約35円/件**（原価目標50円以下を満たす） |

実行ログは `diagnosis_logs` テーブルに残る（Places APIコール数・Anthropicトークン数・モデル）。月次確認は:

```sql
select date_trunc('month', created_at) as month,
       count(*) as diagnoses,
       sum(places_api_calls) as places_calls,
       sum(anthropic_input_tokens) as in_tokens,
       sum(anthropic_output_tokens) as out_tokens
from diagnosis_logs group by 1 order by 1 desc;
```

## デプロイ

Vercelプロジェクト（Root Directory = `web`）。リポジトリはlocal-biz-demosのまま（採点基準・共有モジュールの一元管理のため別リポジトリにしない）。

```bash
# 手動デプロイ（リポジトリルートから）
vercel deploy --prod
```

`packages/gbp-core` は `file:` 依存のためリポジトリ全体のクローンが必要 → Root Directoryを`web`に設定した上でリポジトリルートからデプロイする（`web/`単体のアップロードでは壊れる）。

## ローカル開発

```bash
cd web
cp .env.example .env.local   # 値を埋める
npm install
npm run dev
```

## 確定ルール（変更禁止・gbp-scoring-rules.md準拠）

- 変則満点の禁止。満点は常に100点、総合は（自動＋人間）÷2
- 判定不能項目は比例換算・0点混入せず「判定不能」と明示（人間診断の判定不能トグルは分母から除外）
- 人間診断の点数を自動診断側の計算に混入させない
- データ取得はPlaces APIのみ（スクレイピング禁止）
- APIキーはすべてサーバ側（Route Handler）。クライアントに一切出さない

## 将来拡張（設計上の考慮のみ）

- 見込み客向け簡易版: proxy.tsの認証分岐＋結果マスクの追加で対応可能（データは本プロジェクトから分離済み）
- 診断履歴の差分比較: 同一事業者のレコードが時系列で積まれているため後付け可能
- リード管理: diagnosesテーブルへのstatus列追加で対応可能
