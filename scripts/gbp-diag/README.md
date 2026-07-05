# /gbp-diag 実行手順

Telegramで `/gbp-diag {事業者名} {エリア}` を受けたら、CC（自分自身）が以下を順に実行する。

## 前提

`~/.secrets/gbp-diag.env` に以下を保存し、実行前に読み込む:

```
GOOGLE_PLACES_API_KEY=xxxx
```

読み込み例:
```bash
set -a; source ~/.secrets/gbp-diag.env; set +a
```

## 手順

1. データ取得（機械採点込み）:
   ```bash
   node scripts/gbp-diag/fetch.js "事業者名" "エリア"
   ```
   → `gbp-reports/{事業者名}_{日付}.data.json` が生成される。

2. `data.json` を読み、以下2項目をClaude自身が判定する:
   - `reviewQuality`（クチコミ内容の質・配点10）: `target.reviews` の本文を読み、具体性・好意度・最近性から採点
   - `categoryFit`（カテゴリ設定・配点10）: `target.types` / `primaryType` と競合の types を比較して採点
   - 併せて `insight`（所見3〜5行）、`priorities`（改善優先順位、配列、効果の大きい順に3つ）、`risk`（放置した場合の見通し）も生成する

   これらを `gbp-reports/{事業者名}_{日付}.judged.json` として保存する。形式:
   ```json
   {
     "reviewQuality": { "score": 7, "max": 10, "note": "..." },
     "categoryFit": { "score": 8, "max": 10, "note": "..." },
     "insight": "...",
     "priorities": ["...", "...", "..."],
     "risk": "..."
   }
   ```
   判定不能な場合は `"score": null` とし、note に理由を明記する（比例換算しない）。

3. レポート生成:
   ```bash
   node scripts/gbp-diag/render.js \
     gbp-reports/{事業者名}_{日付}.data.json \
     gbp-reports/{事業者名}_{日付}.judged.json \
     gbp-reports/{事業者名}_{日付}.html
   ```

4. Telegramに `.html` のパス（またはデプロイ済みならURL）を返信する。

## コスト・ログ

- API呼び出し回数は `data.json` の `apiCallCount` に概算で記録される。月次確認が必要な場合はこの値を集計する。
- 診断1件の目安: Places API課金 約$0.2以内。
