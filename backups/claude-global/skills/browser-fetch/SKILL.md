---
name: browser-fetch
description: JavaScriptレンダリングが必要なページの取得時に発火。WebFetchやcurlで本文が空になるサイト（UTAGE等の会員サイト、SPA、動的読み込みページ）から、描画後のテキスト・HTML・リンク・メディアURL・スクリーンショットを取得する。「ページが読めない」「本文が空」「JSレンダリング」「スライドを取得」「会員ページの中身」といった状況で使う。ヘッドレスChromium（Playwright）を使うため無人運用と互換。
---

# browser-fetch

ヘッドレスChromiumでページを描画してから内容を取得するスキル。
WebFetch・curlはJS実行しないため、動的サイトでは本文が取れない。その代替。

## 使い方

```bash
python3 ~/.claude/skills/browser-fetch/fetch.py <URL>                  # 描画後の可視テキスト
python3 ~/.claude/skills/browser-fetch/fetch.py <URL> --media          # img/iframe/videoのsrc一覧
python3 ~/.claude/skills/browser-fetch/fetch.py <URL> --links          # リンク一覧(href|text)
python3 ~/.claude/skills/browser-fetch/fetch.py <URL> --html           # 描画後HTML全体
python3 ~/.claude/skills/browser-fetch/fetch.py <URL> --screenshot 出力.png
python3 ~/.claude/skills/browser-fetch/fetch.py <URL> --wait 8000      # 読み込みが遅いサイト用(既定4000ms)
```

## 定石

1. まずテキスト取得を試す。ナビゲーションしか出ないなら `--media` で埋め込み（PDF viewer iframe、動画プレイヤー）を探す。
2. PDF viewerのiframe（例: `/pdf/viewer?file=https://...s3...pdf`）を見つけたら、file=パラメータのURLをcurlで直接ダウンロードし、ReadツールでPDFとして読む。
3. 判断に迷ったら `--screenshot` で見た目を確認する。推測しない。
4. 会員サイトのコンテンツは本人の個人利用（メモ・文字起こし）に限る。再配布物を作らない。

## 実測済みの事例

- UTAGE会員サイト（online.fuji-ai.net）: 本文はJS動的読み込み。スライドはS3上のPDFをviewer iframeで埋め込み。--mediaでPDF直URLが取れ、curlでダウンロード可能（2026-07-13実測）。

## 依存

- Homebrew Python 3.11の playwright パッケージ + Chromium（インストール済み）。
- 壊れた場合の再インストール: `pip3 install playwright && python3 -m playwright install chromium`
