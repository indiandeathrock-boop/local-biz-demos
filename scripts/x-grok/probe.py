#!/usr/bin/env python3
"""Phase1: X内Grokの会話取得APIの疎通確認・構造調査スクリプト。
x-bookmarks/probe.pyと同じ手法（cookie注入+ネットワーク応答横取り）で、
Grok関連のAPIエンドポイント・リクエストヘッダ・レスポンス構造を実測する。
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

ENV_PATH = os.path.expanduser("~/.secrets/x-bookmarks.env")  # 同じXアカウントのcookieを流用

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

    captured_requests = []
    captured_responses = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA, viewport={"width": 1280, "height": 1400})
        context.add_cookies([
            {"name": "auth_token", "value": auth_token, "domain": ".x.com", "path": "/"},
            {"name": "ct0", "value": ct0, "domain": ".x.com", "path": "/"},
        ])
        page = context.new_page()

        def on_request(req):
            url = req.url
            if "grok" in url.lower() and ("api" in url.lower() or "graphql" in url.lower()):
                captured_requests.append({"url": url, "method": req.method, "headers": dict(req.headers),
                                           "post_data": req.post_data})
                print(f"[REQUEST] {req.method} {url}", file=sys.stderr)

        def on_response(response):
            url = response.url
            if "grok" in url.lower() and ("api" in url.lower() or "graphql" in url.lower()):
                try:
                    body = response.json()
                except Exception:
                    try:
                        body = response.text()
                    except Exception:
                        body = None
                captured_responses.append({"url": url, "status": response.status, "body": body})
                print(f"[RESPONSE] status={response.status} url={url}", file=sys.stderr)

        page.on("request", on_request)
        page.on("response", on_response)

        print("[INFO] x.com/i/grok へアクセス中...", file=sys.stderr)
        page.goto("https://x.com/i/grok", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(6000)

        # Grok履歴一覧が別ページ/別操作の場合に備え、サイドバー等をスクロール・クリック試行
        try:
            page.mouse.wheel(0, 1500)
            page.wait_for_timeout(3000)
        except Exception:
            pass

        browser.close()

    out_path = os.path.expanduser("~/local-biz-demos/scripts/x-grok/probe_result.json")
    with open(out_path, "w") as f:
        json.dump({"requests": captured_requests, "responses": captured_responses}, f, ensure_ascii=False, indent=2)

    print(f"[SUMMARY] requests={len(captured_requests)} responses={len(captured_responses)}")
    print(f"詳細: {out_path}")

    if not captured_requests and not captured_responses:
        print("[FAIL] Grok関連の通信を捕捉できませんでした。"
              "ページ構造が想定と異なるか、Grok機能が別URLの可能性があります。", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
