#!/usr/bin/env python3
"""Phase2: Xブックマーク初回全件収集。

cursorをmetaテーブルに保存して中断・再開に対応する。
1回の実行あたりの最大ページ数を制限でき、レート制限対策として
分割実行できる（例: 1日1回、数百件ずつ）。

使い方:
  python3 fetch_all.py [--max-pages 20] [--wait-sec 5]
"""
import argparse
import sys
import time

sys.path.insert(0, "/Users/ryukando/local-biz-demos/scripts/x-bookmarks")
from playwright.sync_api import sync_playwright
from lib import (build_request_context, cookie_expired_markers, db_connect,
                  fetch_bookmarks_page, get_meta, load_env, parse_entries,
                  set_meta, upsert_tweets)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max-pages", type=int, default=20,
                    help="この実行で取得する最大ページ数（1ページ=最大20件）")
    p.add_argument("--wait-sec", type=float, default=5.0,
                    help="ページ間の待機秒数（レート制限対策）")
    args = p.parse_args()

    env = load_env()
    conn = db_connect()
    cursor = get_meta(conn, "initial_fetch_cursor")
    done = get_meta(conn, "initial_fetch_done") == "1"

    if done:
        print("[INFO] 初回全件収集は完了済みです（fetch_diff.pyで差分収集してください）")
        return

    total_new = 0
    total_seen = 0
    with sync_playwright() as pw:
        ctx = build_request_context(pw, env)
        for page_no in range(args.max_pages):
            status, body = fetch_bookmarks_page(ctx, cursor=cursor, count=20)
            if status == 401 or status == 403:
                print(f"[FATAL] cookie失効の可能性（status={status}）。再取得が必要です。", file=sys.stderr)
                sys.exit(2)
            if cookie_expired_markers(body):
                print("[FATAL] GraphQL応答が認証エラーを示しています。cookie再取得が必要です。", file=sys.stderr)
                sys.exit(2)
            if status != 200:
                print(f"[ERROR] status={status} body={body}", file=sys.stderr)
                sys.exit(1)

            tweets, next_cursor = parse_entries(body)
            total_seen += len(tweets)
            new_count = upsert_tweets(conn, tweets)
            total_new += new_count
            print(f"[PAGE {page_no + 1}] 取得{len(tweets)}件 新規{new_count}件 cursor={next_cursor}")

            if not next_cursor or not tweets:
                print("[DONE] cursorが尽きました。初回全件収集を完了とみなします。")
                set_meta(conn, "initial_fetch_done", "1")
                cursor = None
                break

            cursor = next_cursor
            set_meta(conn, "initial_fetch_cursor", cursor)
            time.sleep(args.wait_sec)
        ctx.dispose()

    remaining = "完了" if get_meta(conn, "initial_fetch_done") == "1" else "未完了（再実行で続きから取得されます）"
    print(f"[SUMMARY] 新規{total_new}件（走査{total_seen}件） 状態: {remaining}")
    conn.close()


if __name__ == "__main__":
    main()
