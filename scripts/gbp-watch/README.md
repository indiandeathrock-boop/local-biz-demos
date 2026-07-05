# GBP最新情報自動巡回パイプライン（gbp-watch）

GBP関連の最新情報を月次で自動収集・分類し、採点基準（`gbp-scoring-rules.md`）に影響する変化があればTelegramでRKに通知する。**人間の承認を得た場合のみ**更新履歴に反映する。

## 全体フロー

**手動トリガー**（毎月15日目安・RKがカレンダーリマインダー等で起動）→ RSS/HTML巡回 → キーワード一次フィルタ → Claude二次分類 → 影響あり1件以上ならTelegram通知 → RKの承認コマンドで更新履歴に追記。

> **自動実行は無効化中（2026-07-05変更）。** 理由: 無人実行は `claude -p` のプログラマティック利用にあたり、Anthropicがこの種の利用をサブスクリプション枠から分離・別課金化する変更を過去に複数回発表しており（現在は凍結中）、予告なき課金変更リスクを避けるため人間トリガー運用に変更した。実行トリガー自体は既存の `/gbp-diag` 等と同じTelegram Bot経由の運用と同等で、新たなリスクは増えていない。調査・要否判断は必要に応じてClaude.aiの対話チャットで検討してから実行の是非を決めてよい。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `run.js` | パイプライン本体（Step 1〜4） |
| `review.js` | 候補の一覧・承認・却下CLI |
| `sources.json` | 巡回ソース定義（コード変更なしで追加・削除可） |
| `keywords.json` | 一次フィルタのキーワード（緩め設定・取りこぼし防止優先） |
| `config.json` | 実行パラメータ（chatId・モデル・パス類） |
| `classify.js` / `notify.js` / `lib.js` | 内部モジュール |

- 状態: `~/.gbp-watch/`（`state.json`=既読管理、`pending.json`=提案中候補、`decisions.json`=承認/却下の永続記録）
- ログ: `~/logs/gbp-watch/run-{timestamp}.json`（**通知の有無に関わらず毎回必ず書く**。実行日時・ソース別取得件数・通過件数・分類件数・relevant件数・エラー）

## 二次分類

`claude -p --model haiku`（ヘッドレスCLI）で記事1件ずつ分類。Anthropic APIキー不要・サブスクリプション内で実行されるため月次の追加コストはゼロ（指示書の「Claude API 〜100円」目安を下回る）。

## Telegramコマンド（CCが実行する手順）

CC（自分自身）がTelegramで以下のコマンドを受けたら、対応するCLIを実行して結果を返信する:

- `/gbp_watch_run` → `bash scripts/gbp-watch/run.sh` を実行（パイプライン本体を今すぐ1回実行）。実行結果サマリー（新着・通過・relevant件数）を返信
- `/gbp_rules_review` → `node scripts/gbp-watch/review.js list` の出力を返信（長ければ分割）
- `/gbp_rules_approve {番号}` → `node scripts/gbp-watch/review.js approve {番号}` を実行。gbp-scoring-rules.md の更新履歴に追記され、出典URL入りでcommit/pushされる。結果を返信
- `/gbp_rules_reject {番号} [理由]` → `node scripts/gbp-watch/review.js reject {番号} [理由]` を実行。結果を返信

**禁止事項（CCへの指示）**:
- approve コマンド受信以外の経路で gbp-scoring-rules.md を書き換えない（更新履歴への追記も禁止）
- パイプラインが書き込むのは更新履歴の情報エントリまで。採点式・配点の変更はRKの明示的な別指示でのみ行う
- Google検索結果・GoogleマップのスクレイピングをRSS代替に使わない

## 手動実行（方式B・ターミナル用）

```bash
bash scripts/gbp-watch/run.sh            # 通常実行
bash scripts/gbp-watch/run.sh --init     # 初回のみ: 全記事を既読化（分類・通知なし）
bash scripts/gbp-watch/run.sh --no-notify   # テスト: 通知だけスキップ
bash scripts/gbp-watch/run.sh --inject FILE # テスト: ダミー記事を注入
```

## launchd自動実行（現在は無効化中）

旧plistは `scripts/gbp-watch/launchd/com.rk.gbp-watch.plist` にアーカイブ済み。将来自動実行に戻す判断がされた場合:

```bash
cp scripts/gbp-watch/launchd/com.rk.gbp-watch.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.rk.gbp-watch.plist
```

実行し忘れ対策はカレンダーリマインダー運用に委ねる（CCは常駐tmuxセッションで動いており「セッション起動時に知らせる」方式は発火機会がほぼ無いため実装しない）。

## ソース定義（2026-07-05実在確認済み）

| id | 方式 | 備考 |
|---|---|---|
| google-search-central | RSS | feedburner経由の公式フィード |
| gbp-api-latest-updates | HTML差分 | GBPヘルプ公式アナウンスページは廃止済み（404）のため、公式のAPI更新情報ページで代替 |
| brightlocal | RSS | `/learn/feed/` が正（`/feed/` はHTMLを返す） |
| pinmeto | RSS | |
| canly | RSS | WordPress標準フィード |

フィード取得失敗はソース単位でスキップし他ソースを継続。失敗はログと通知文末尾に記録される。

## 将来拡張（設計上の考慮のみ・未実装）

- ソース追加は `sources.json` に1エントリ追加するだけ
- 緊急レーン（機能廃止レベルの即時通知）: `change_type: "機能廃止"` の判定は既に出力されるため、run.jsに条件分岐を足すだけで実装可能
- 年次見直しレポート: `decisions.json` に承認済みエントリが蓄積されるため、これを入力にすればよい
