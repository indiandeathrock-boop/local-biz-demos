# GBP最新情報自動巡回パイプライン（gbp-watch）

GBP関連の最新情報を月次で自動収集・分類し、採点基準（`gbp-scoring-rules.md`）に影響する変化があればTelegramでRKに通知する。**人間の承認を得た場合のみ**更新履歴に反映する。

## 全体フロー

毎月15日 09:00 JST（launchd）→ RSS/HTML巡回 → キーワード一次フィルタ → Claude二次分類 → 影響あり1件以上ならTelegram通知 → RKの承認コマンドで更新履歴に追記。

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

- `/gbp_rules_review` → `node scripts/gbp-watch/review.js list` の出力を返信（長ければ分割）
- `/gbp_rules_approve {番号}` → `node scripts/gbp-watch/review.js approve {番号}` を実行。gbp-scoring-rules.md の更新履歴に追記され、出典URL入りでcommit/pushされる。結果を返信
- `/gbp_rules_reject {番号} [理由]` → `node scripts/gbp-watch/review.js reject {番号} [理由]` を実行。結果を返信

**禁止事項（CCへの指示）**:
- approve コマンド受信以外の経路で gbp-scoring-rules.md を書き換えない（更新履歴への追記も禁止）
- パイプラインが書き込むのは更新履歴の情報エントリまで。採点式・配点の変更はRKの明示的な別指示でのみ行う
- Google検索結果・GoogleマップのスクレイピングをRSS代替に使わない

## 手動実行

```bash
node scripts/gbp-watch/run.js            # 通常実行
node scripts/gbp-watch/run.js --init     # 初回のみ: 全記事を既読化（分類・通知なし）
node scripts/gbp-watch/run.js --no-notify   # テスト: 通知だけスキップ
node scripts/gbp-watch/run.js --inject FILE # テスト: ダミー記事を注入
```

## launchd設定（毎月15日 09:00 JST）

plist: `~/Library/LaunchAgents/com.rk.gbp-watch.plist`

```bash
launchctl load ~/Library/LaunchAgents/com.rk.gbp-watch.plist   # 有効化
launchctl list | grep gbp-watch                                 # 確認
launchctl start com.rk.gbp-watch                                # 手動トリガー（テスト）
```

launchdはスリープ中の発火時刻をスキップせず起床後に実行する（StartCalendarInterval仕様）。Mac miniは常時稼働のため通常は定刻実行。

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
