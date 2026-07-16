#!/usr/bin/env python3
"""Phase1: X GraphQL Bookmarks APIの疎通確認スクリプト。

Playwrightヘッドレスブラウザにauth_token/ct0 cookieを注入し、
x.com/i/bookmarksを開いてネットワーク応答からBookmarks GraphQLの
レスポンスを1件以上捕捉できるか確認する。本収集(fetch_all.py)の
前段の検証専用スクリプトで、DBへの書き込みは行わない。
"""
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

ENV_PATH = os.path.expanduser("~/.secrets/x-bookmarks.env")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


def main():
    env = load_env(ENV_PATH)
    auth_token = env["X_AUTH_TOKEN"]
    ct0 = env["X_CT0"]

    captured = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 1400})
        context.add_cookies([
            {"name": "auth_token", "value": auth_token, "domain": ".x.com", "path": "/"},
            {"name": "ct0", "value": ct0, "domain": ".x.com", "path": "/"},
        ])
        page = context.new_page()

        def on_response(response):
            url = response.url
            if "/i/api/graphql/" in url and "Bookmark" in url:
                try:
                    body = response.json()
                except Exception as e:
                    print(f"[WARN] JSON解析失敗 url={url} err={e}", file=sys.stderr)
                    return
                captured.append({"url": url, "status": response.status, "body": body})
                print(f"[CAPTURED] status={response.status} url={url}", file=sys.stderr)

        page.on("response", on_response)

        print("[INFO] x.com/i/bookmarks へアクセス中...", file=sys.stderr)
        page.goto("https://x.com/i/bookmarks", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(6000)

        # 追加でスクロールし、遅延ロードされるGraphQL呼び出しも拾う
        for i in range(3):
            page.mouse.wheel(0, 2000)
            page.wait_for_timeout(2500)

        browser.close()

    if not captured:
        print("[FAIL] Bookmarks GraphQL応答を1件も捕捉できませんでした。"
              "cookieの失効、またはX側のエンドポイント仕様変更の可能性があります。", file=sys.stderr)
        sys.exit(1)

    out_path = os.path.expanduser("~/local-biz-demos/scripts/x-bookmarks/probe_result.json")
    with open(out_path, "w") as f:
        json.dump(captured, f, ensure_ascii=False, indent=2)

    print(f"[OK] {len(captured)}件のGraphQL応答を捕捉。詳細: {out_path}")

    # 最初の応答から構造をざっと要約
    first = captured[0]["body"]
    print("[STRUCTURE PREVIEW]")
    print(json.dumps(first, ensure_ascii=False)[:800])


if __name__ == "__main__":
    main()
