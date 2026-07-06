---
name: demo-site-generator
description: 新規SME向けデモサイトを生成しCloudflare Workersにデプロイする。業種・店舗名等の変数をテンプレートに適用する。
disable-model-invocation: true
argument-hint: "[業種] [店舗名]"
arguments: [業種, 店舗名]
allowed-tools: Bash(bash ~/local-biz-demos/scripts/create-demo.sh *)
---

# demo-site-generator

スクリプト: `~/local-biz-demos/scripts/create-demo.sh`
テンプレート: `~/local-biz-demos/demos/$業種/index.html`
出力先: `~/local-biz-demos/demos/clients/$slug/index.html`
デプロイ: GitHub API → Cloudflare Pages 自動反映（~1分）

業種別の差分（利用可能テンプレート・背景画像・サービス項目デフォルト値）は `reference.md` を参照。

## 実行手順

1. $業種 に対応するテンプレートが存在するか確認
   ```
   ls ~/local-biz-demos/demos/$業種/index.html
   ```

2. slug を生成（店舗名をローマ字またはケバブケースで決定）
   例: "テスト店舗" → `test-shop`、"田中美容室" → `tanaka-beauty`

3. create-demo.sh を実行
   ```bash
   bash ~/local-biz-demos/scripts/create-demo.sh \
     --type $業種 \
     --name "$店舗名" \
     --slug "$slug" \
     [--catch "キャッチコピー"] \
     [--tel "電話番号"] \
     [--address "住所"] \
     [--hours "営業時間"] \
     [--holiday "定休日"] \
     [--service1 "サービス1"] \
     [--service2 "サービス2"] \
     [--service3 "サービス3"] \
     [--service4 "サービス4"] \
     [--email "メール"] \
     [--instagram "URL"] \
     [--x-url "URL"] \
     [--tiktok "URL"] \
     [--map-embed "embed_url"] \
     [--map-url "maps_url"] \
     [--r1-name "名前"] [--r1-rating "5"] [--r1-text "テキスト"] \
     [--r2-name "名前"] [--r2-rating "5"] [--r2-text "テキスト"] \
     [--r3-name "名前"] [--r3-rating "5"] [--r3-text "テキスト"] \
     [--faq1-q "質問"] [--faq1-a "回答"] \
     [--faq2-q "質問"] [--faq2-a "回答"] \
     [--faq3-q "質問"] [--faq3-a "回答"]
   ```

4. 出力されたデプロイURLを確認してユーザーに報告する

## 必須引数

| 引数 | フラグ | 説明 |
|------|--------|------|
| 業種 | `--type` | テンプレートディレクトリ名（例: `beauty-salon`） |
| 店舗名 | `--name` | 表示用店舗名（日本語可） |
| slug | `--slug` | URL用識別子（英数字・ハイフンのみ） |

slugが未指定の場合は店舗名から自動生成してよい。

## 環境変数

`GITHUB_TOKEN` は `~/.zshrc` から自動取得される。手動設定不要。
