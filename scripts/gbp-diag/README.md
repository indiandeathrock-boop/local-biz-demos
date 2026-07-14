# /gbp-diag 実行手順

Telegramで `/gbp-diag {事業者名} {住所}` を受けたら、CC（自分自身）が以下を順に実行する。

## 引数の変更（2026-07-14・破壊的変更）

エリア指定を廃止し、住所指定に統一した。競合の検索範囲は住所から抽出した町名
（例: 「東京都台東区千束4-11-16」→「千束」）で自動設定されるため、エリア引数は不要になった。

- 旧: `/gbp-diag 事業者名 エリア` → `node fetch.js "事業者名" "エリア" ["住所"] ["業種type"]`
- 新: `/gbp-diag 事業者名 住所` → `node fetch.js "事業者名" "住所" ["業種type"]`

移行方法: 旧形式のエリア（例: 「松戸」）だけが送られてきた場合は、そのまま実行せず
「住所（番地まで）を送ってください」と返信する。住所は対象特定（同名法人対策）と
町名スコープの両方に使われるため必須。

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
   node scripts/gbp-diag/fetch.js "事業者名" "住所"
   ```
   → `gbp-reports/{事業者名}_{日付}.data.json` が生成される。
   標準出力の「競合スコープ」行（町名・半径・町名一致件数）を確認する。

2. `data.json` を読み、以下2項目をClaude自身が判定する:
   - `reviewQuality`（クチコミ内容の質・配点10）: `target.reviews` の本文・`publishTime`/`relativePublishTimeDescription` を見て、具体性・好意度・最近性から採点
   - `primaryCategoryFit`（主カテゴリの適切性・配点6）: `target.types` / `primaryType` と競合の types を比較して採点。追加カテゴリの有無（4点）はAPIで確認不能なため機械採点側で常に判定不能扱い（`additionalCategoryPresence`）
   - 併せて `insight`（所見3〜5行）、`priorities`（改善優先順位、配列、効果の大きい順に3つ）、`risk`（放置した場合の見通し）も生成する

   これらを `gbp-reports/{事業者名}_{日付}.judged.json` として保存する。形式:
   ```json
   {
     "reviewQuality": { "score": 7, "max": 10, "note": "..." },
     "primaryCategoryFit": { "score": 5, "max": 6, "note": "..." },
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
