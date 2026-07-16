#!/usr/bin/env python3
"""定期実行用の差分収集。ブックマークは新しい順に並ぶ前提で、
先頭ページから走査し「そのページの全件が既知」になった時点で打ち切る。
新規ブックマークがあった分だけを取得するため、毎回全件走査するより高速・低負荷。
"""
import sys

sys.path.insert(0, "/Users/ryukando/local-biz-demos/scripts/x-bookmarks")
from playwright.sync_api import sync_playwright
from lib import (build_request_context, cookie_expired_markers, db_connect,
                  fetch_bookmarks_page, load_env, parse_entries, upsert_tweets)


class CookieExpired(Exception):
    pass


def fetch_new_bookmarks(max_pages=10, wait_sec=4):
    """新規ブックマークをDBに保存し、新規分のリストを返す。"""
    env = load_env()
    conn = db_connect()
    new_entries = []

    with sync_playwright() as pw:
        ctx = build_request_context(pw, env)
        cursor = None
        try:
            for page_no in range(max_pages):
                status, body = fetch_bookmarks_page(ctx, cursor=cursor, count=20)
                if status in (401, 403) or cookie_expired_markers(body):
                    raise CookieExpired(f"status={status}")
                if status != 200:
                    raise RuntimeError(f"status={status} body={body}")

                tweets, next_cursor = parse_entries(body)
                if not tweets:
                    break

                # 既知ID数を数え、ページ全体が既知なら打ち切り
                existing_ids = {
                    row[0] for row in conn.execute(
                        "SELECT id FROM bookmarks WHERE id IN (%s)" % ",".join("?" * len(tweets)),
                        [t["id"] for t in tweets],
                    )
                }
                fresh = [t for t in tweets if t["id"] not in existing_ids]
                if fresh:
                    upsert_tweets(conn, fresh)
                    new_entries.extend(fresh)

                if len(fresh) < len(tweets):
                    # このページに既知IDが混ざっていた = 前回収集分に追いついた
                    break
                if not next_cursor:
                    break
                cursor = next_cursor
                import time
                time.sleep(wait_sec)
        finally:
            ctx.dispose()

    conn.close()
    return new_entries


if __name__ == "__main__":
    try:
        entries = fetch_new_bookmarks()
        print(f"新規{len(entries)}件")
        for e in entries:
            print(" -", e["id"], e["screen_name"], e["text"][:40].replace("\n", " "))
    except CookieExpired as e:
        print(f"[COOKIE_EXPIRED] {e}", file=sys.stderr)
        sys.exit(2)
