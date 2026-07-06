# GBP診断ツール 開発方法論

2026-07-05〜07-06の構築・運用で確立した設計判断・落とし穴・検証手順の全記録。
このツールの改修、および類似の「外部APIデータ＋機械採点＋LLM判定」型ツールの新規構築に適用する。

---

## 1. アーキテクチャ地図（何がどこにあるか）

```
gbp-scoring-rules.md            ← 採点基準の唯一の正。全実装はこれに準拠
packages/gbp-core/              ← 共有コア（単一実装）
  places.js                     ←   Places API呼び出し・対象特定・競合選定
  scoring.js                    ←   機械採点（閾値・判定不能処理）
  diagnose.js                   ←   自動診断オーケストレーション
scripts/gbp-diag/               ← Telegram版（/gbp-diag）。CC自身がClaude判定を行う
  fetch.js / render.js / README.md
web/                            ← Web版（Vercel: gbp-diag-web、Root Directory=web）
  app/api/diagnose/route.ts     ←   診断実行API（Places→採点→Claude判定→Supabase保存）
  lib/judge.ts                  ←   Anthropic API判定（claude-haiku-4-5・structured outputs）
  lib/human-items.ts            ←   人間診断の項目定義（設問・配点・アンカーのデータ分離）
  lib/industry-types.ts         ←   業種手動指定の選択肢（Nearby Search有効タイプのみ）
  supabase/migrations/          ←   スキーマ（RLS有効+GRANT。新規テーブルは必ず両方書く）
scripts/gbp-watch/              ← 月次の最新情報巡回（手動トリガー制・人間承認制）
gbp-reports/                    ← 診断データの保存先（gitignore対象。回帰確認の基準データ）
```

- 運用情報（本番URL・シークレット所在・Supabase接続・デプロイ手順）はメモリの
  `gbp-diag-web-ops.md` と `web/README.md` を参照。
- デプロイはリポジトリルートから `vercel deploy --prod`（GitHub自動デプロイ未接続）。
  `web/` 単体のアップロードは `file:../packages/gbp-core` 依存が壊れるため不可。

## 2. 不変条件（確定ルール・変更禁止）

1. **満点は常に100点**。変則満点（80点満点等）を作らない。総合スコアは（自動＋人間）÷2 の平均のみ。
2. **判定不能は誠実に扱う**: 比例換算しない・0点に混ぜない・「判定不能」と明示する。
   人間診断の判定不能トグルは分母から除外する（例: 65/94点と表示）。
3. **人間診断の点数を自動診断側の計算に混入させない**。合算は総合レポートの平均演算のみ。
4. **スクレイピング禁止**。データ取得はPlaces API（Advanced SKU範囲）のみ。
5. **APIキーはサーバ側のみ**。クライアントコード・リポジトリに一切出さない。
6. **採点基準の自動書き換え禁止**（人間承認制）。gbp-watchの巡回結果も、RKの
   approveコマンドなしに gbp-scoring-rules.md へ書き込まない。
7. **用語の二重体系を維持**: Web UIの表示名は「ファーストチェック／パーソナルインサイト」、
   内部データ構造・gbp-scoring-rules.md・Telegram版は「自動診断／人間診断」。
   共有スコアリングエンジン内部の文言を変えるとTelegram版に波及するので変えない。

## 3. 設計原則（この開発で使った方法論）

### 3-1. 基準ドキュメント駆動開発
コードより先に採点基準（配点・閾値・判定不能条件）をMarkdownで確定させ、コードは
「基準の実装」に徹する。基準に影響する変更は必ず更新履歴に記録する。記録形式:
**「事象（何が起きたか）→根本原因（実測でどう特定したか）→対応→実測値（before/after）」**。
これにより後続セッション・別モデルが「なぜこの実装なのか」を再導出せずに済む。

### 3-2. 単一実装原則（スコア一致の担保）
複数のフロントエンド（Telegram/Web）から使う計算ロジックは共有モジュールに一本化する。
切り出し時の回帰確認は「保存済み入力データに対する新旧出力の完全一致」で行う
（ライブAPI再取得での比較はデータドリフトと実装差分を区別できないため不可）。

### 3-3. 再現性優先の外部API利用
- 自由文検索（Text Search）は同一パラメータでも実行毎に結果が揺れることを実測で確認済み。
  再現性が必要な箇所は構造化フィルタ（Nearby Search + includedTypes + locationRestriction +
  rankPreference: POPULARITY）を使う。
- API応答後の選定はコード側で決定論的に行う（userRatingCount降順、タイはplace id昇順）。
- 取得した生データ（競合セット含む）は必ず保存し、「後から何と比較したか」を検証可能にする。
- 再現性の主張は必ず「同一条件で2回連続実行して完全一致」の実測で裏付ける。

### 3-4. 数値の二重管理禁止
レポート文言に出る定数（検索半径3km等）はコードの定数から参照する。
ドキュメント・UI・コードに同じ数値をハードコードで散らばらせない。

### 3-5. LLM判定の使い所を限定する
機械的に計算できる項目（件数比較・閾値評価）はコードで採点し、LLMには
「テキストの質的判断」（クチコミ内容の質・カテゴリ適切性・所見文生成）だけを渡す。
LLM出力はJSONスキーマで構造化し（structured outputs）、max値はコード側で強制上書きする。
モデルはコスト重視でHaiku系（判定は分類タスクなので十分）。

### 3-6. 母集団の前提を明記する
相対評価（順位・競合比較）は、母集団の切り出し方（半径・件数上限・選定アルゴリズム）を
レポート内に必ず注記する。「9位/9社中」だけ見せると「エリアに9社しかない」と誤読される。

## 4. Google Places APIの落とし穴カタログ（全て実測で確認済み）

| # | 落とし穴 | 症状 | 対応（実装済み） |
|---|---|---|---|
| 1 | **汎用バケツ型カテゴリ**: `service`/`point_of_interest`/`establishment`/`store`/`food` はあらゆる業態のtypesに含まれる | primaryType=serviceの不動産屋の競合にドンキ・ビックカメラが並ぶ | `GENERIC_PLACE_TYPES`で除外し、types配列の具体的カテゴリにフォールバック |
| 2 | **Nearby Search非対応タイプ**: `general_contractor`・`photographer`等はGoogleの分類には存在するがincludedTypesでは"Unsupported types"エラー | 建設会社の競合がテラスモール・駅などの人気スポットになる（フィルタ全滅→フィルタなし検索に落ちるため） | 候補を順に試行し、全滅時は`KNOWN_INVALID_TYPE_KEYWORDS`の日本語キーワードでText Searchにフォールバック |
| 3 | **Text Searchの非決定性**: 同一パラメータでも実行毎に返却順序・件数が変わる | 再診断のたびに競合セットが変わりスコアが動く | 競合選定はNearby Searchに一本化（#2の最終手段を除く） |
| 4 | **写真は最大10件・レビューは最大5件しか返らない** | 総枚数・全レビューでの採点は原理的に不可能 | 上限到達時は「判定不能」、未満なら実数評価。レポートに根拠件数を明記 |
| 5 | **第三者事業者の商品登録・追加カテゴリはAPIから取得不能** | 該当項目が採点できない | 常に判定不能とし、人間診断（現地確認）に委ねる |
| 6 | **同名法人の混同**: Text Searchの1件目が別法人のことがある | 誤った事業者を診断する | 住所（任意入力）とformattedAddressの正規化照合で候補を選別 |
| 7 | **言語ネゴシエーション**: Accept-Language未指定だとリクエスト毎に応答言語が変わることがある | HTML差分監視が毎回「変更あり」誤検知 | `hl=en`固定＋Accept-Languageヘッダ明示（gbp-watchで発生） |

新しい落とし穴を発見したら: この表と gbp-scoring-rules.md の該当節の両方に追記する。
「Googleの分類にある＝APIの検索フィルタで使える」ではない、が最大の教訓。

## 5. デバッグ・検証プレイブック

不具合報告（例:「競合比較が全くダメ」）を受けたときの標準手順:

1. **保存データで再現**: Supabase（`diagnoses.data`）またはgbp-reports/のdata.jsonから
   該当診断の生データを取得。target の primaryType/types と categoryResolution を最初に見る。
2. **原因を実測で特定**: 仮説をコードリーディングだけで確定させない。Places APIを
   直接叩いて挙動を確認する（例: 候補タイプを1つずつsearchNearbyに投げてVALID/INVALID判定）。
3. **修正**: 共有コア（gbp-core）側で直す。フロントエンド側の回避策で誤魔化さない。
4. **回帰確認**: 保存済みdata.jsonに対する機械採点の完全一致（アルドマーニ・東宝ハウス松戸が
   基準データ）。修正対象の事業者では期待通り変わることを確認。
5. **本番検証**: デプロイ後、実際の本番APIで対象事業者を再診断し、保存された
   categoryResolution と競合リストを確認する。
6. **記録**: gbp-scoring-rules.md 更新履歴に事象・根本原因・対応・実測値を追記。
   コミットメッセージにも同じ構造で書く。

補助コマンド（例）:

```bash
# 保存データの確認（Supabase REST・キーは ~/.secrets/gbp-diag-web.env）
curl -s "$SUPABASE_URL/rest/v1/diagnoses?select=data&id=eq.{id}" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# gbp-coreの直接実行（ライブ検証）
set -a; source ~/.secrets/gbp-diag.env; set +a
node -e "const {runAutoDiagnosis}=require('./packages/gbp-core'); ..."

# Telegram版の一括実行
node scripts/gbp-diag/fetch.js "事業者名" "エリア" ["住所"] ["業種type"]
```

## 6. 変更種別ごとのチェックリスト

**採点閾値・配点の変更**: RKの明示的指示があるか確認 → gbp-scoring-rules.md先行更新 →
scoring.js修正 → 保存データで新旧差分を出し、差分が意図通りかRKに提示 → 更新履歴記録。

**競合選定ロジックの変更**: 再現性の実測（2回連続実行で一致）→ 既存事業者の競合セットが
変わる場合はその理由を説明できること → categoryResolutionのsource値を追加したら
web/types/gbp-core.d.ts も更新。

**人間診断項目の変更**: web/lib/human-items.ts のデータ定義のみ修正（UIコンポーネントは
触らない）。配点合計がPart1=80/Part2=20を維持しているか確認。
元仕様はDriveの「GBP人間診断100点 チェックシート＆ヒアリングシート」。

**Web画面の変更**: 表示名は「ファーストチェック／パーソナルインサイト」を使う。
ビルド（web/でnpm run build）→ デプロイ → 本番スモーク（ログイン→当該画面のHTTP 200と
主要素の存在確認）。スマホ幅(375px)はPlaywright（リポジトリdevDependenciesに有り）で確認。

**Supabaseスキーマ変更**: 新規テーブルは必ず「RLS有効化＋明示的GRANT」をセットで書く
（CLAUDE.md CRITICAL）。DDLはRKのSQL Editor実行かDBパスワードでのpsql接続
（sb_secretキーではDDL不可。ALTER ROLEも権限なし）。

## 7. 類似ツールを新規構築するときの適用順序

1. 採点基準・判定不能条件・母集団の定義をMarkdownで確定（RKと合意）
2. データ取得層: 外部APIの制約（取得上限・非対応パラメータ・非決定性）を先に実測調査
3. 機械採点層を純関数で実装（入力データ→スコア。API呼び出しと分離し回帰テスト可能に）
4. LLM判定層は質的判断のみ・structured outputs・Haiku系
5. 基準データ（実在対象2〜3件）を保存し、以後の全変更で回帰確認に使う
6. レポートには母集団の前提・判定根拠の件数・判定不能を必ず明記
7. 実在対象での本番検証を受け入れ条件にする（合成データのみの検証で完了としない）
