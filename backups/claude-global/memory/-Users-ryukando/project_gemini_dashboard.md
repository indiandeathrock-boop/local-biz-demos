---
name: Gemini Dashboard Project
description: ふたご座向け日運ダッシュボード。毎朝Exaで記事収集→Claude要約→Supabase保存→Vercel表示
type: project
originSessionId: 2d13107a-ab6c-4087-afa8-422fe33ae635
---
## プロジェクト概要
- パス: `/Users/ryukando/claude_workspace/gemini-dashboard`
- サービス名: 「ふたご座観測所 羅針盤」
- 目的: 世界中の占い師の双子座運勢情報を毎朝集約して表示

## アーキテクチャ
1. **Cron** (`/app/api/cron/route.ts`) — 毎朝6時（JST）に自動実行（Vercel Cron）
2. **Exa AI** (`/lib/exa.ts`) — 双子座の運勢記事をWeb検索・収集
3. **Claude API** (`/lib/summarize.ts`) — 収集記事を要約・構造化（占術カテゴリ別）
4. **Supabase** (`daily_forecasts`テーブル) — 日付ごとに運勢データをupsert保存
5. **Next.js Page** (`/app/page.tsx`) — Supabaseから最新データを取得して表示

## 占術カテゴリ
- astrology（占星術）、tarot（タロット）、numerology（数秘術）
- shichusuimei（四柱推命）、kyusei（九星気学）、lucky（ラッキーマテリアル）
- famous_person（双子座スーパースター列伝）

## 主要ファイル
- `/lib/types.ts` — DailyForecastなどの型定義
- `/lib/famous-people.ts` — 双子座の有名人リスト（90日以内に出た人は除外）
- `/app/api/notify-telegram/route.ts` — Telegram通知エンドポイント
- `/components/` — CategoryCard, StarRating, SourceList

## Why
天王星が双子座に入室する2026〜2033年の情報革命をテーマに、双子座当事者として発信するメディア。
