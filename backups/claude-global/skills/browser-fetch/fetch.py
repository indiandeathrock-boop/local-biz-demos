#!/usr/bin/env python3
"""JSレンダリング後のページを取得するヘッドレスブラウザフェッチャ。

使い方:
  python3 fetch.py <URL>                        # 描画後の可視テキストを出力
  python3 fetch.py <URL> --html                 # 描画後のHTML全体を出力
  python3 fetch.py <URL> --screenshot out.png   # フルページスクリーンショット
  python3 fetch.py <URL> --links                # 描画後のリンク一覧(href|text)
  python3 fetch.py <URL> --media                # img/iframe/video のsrc一覧
  python3 fetch.py <URL> --wait 8000            # 追加待機ms(既定4000)
"""
import argparse
import sys
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--html", action="store_true")
    p.add_argument("--links", action="store_true")
    p.add_argument("--media", action="store_true")
    p.add_argument("--screenshot", metavar="PATH")
    p.add_argument("--wait", type=int, default=4000)
    args = p.parse_args()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(user_agent=UA, viewport={"width": 1280, "height": 900})
        page.goto(args.url, wait_until="domcontentloaded", timeout=60000)
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass  # networkidleに達しないサイトは追加待機のみで続行
        page.wait_for_timeout(args.wait)

        if args.screenshot:
            page.screenshot(path=args.screenshot, full_page=True)
            print(f"screenshot: {args.screenshot}", file=sys.stderr)
        if args.html:
            print(page.content())
        elif args.links:
            for a in page.eval_on_selector_all(
                    "a[href]", "els => els.map(e => e.href + '|' + e.innerText.trim())"):
                print(a)
        elif args.media:
            for m in page.eval_on_selector_all(
                    "img[src], iframe[src], video[src], video source[src]",
                    "els => els.map(e => e.tagName + '|' + e.src)"):
                print(m)
        elif not args.screenshot:
            print(page.evaluate("document.body.innerText"))
        browser.close()


if __name__ == "__main__":
    main()
