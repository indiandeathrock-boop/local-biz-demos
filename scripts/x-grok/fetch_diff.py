#!/usr/bin/env python3
"""定期実行用の差分収集。会話一覧を先頭ページから走査し、既知のrest_idに
到達した時点で打ち切る（x-bookmarks/fetch_diff.pyと同じ考え方）。
"""
import sys
import time

sys.path.insert(0, "/Users/ryukando/local-biz-demos/scripts/x-grok")
from playwright.sync_api import sync_playwright
from lib import (build_request_context, conversation_known, cookie_expired_markers,
                  db_connect, fetch_conversation_items, fetch_history_page, load_env,
                  parse_conversation_items, parse_history_page, upsert_conversation)


class CookieExpired(Exception):
    pass


def fetch_new_conversations(max_pages=10, wait_sec=3):
    env = load_env()
    conn = db_connect()
    new_conversations = []

    with sync_playwright() as pw:
        ctx = build_request_context(pw, env)
        cursor = None
        try:
            for page_no in range(max_pages):
                status, body = fetch_history_page(ctx, cursor=cursor)
                if status in (401, 403) or cookie_expired_markers(body):
                    raise CookieExpired(f"status={status}")
                if status != 200:
                    raise RuntimeError(f"status={status} body={body}")

                convs, next_cursor = parse_history_page(body)
                if not convs:
                    break

                hit_known = False
                for conv in convs:
                    rest_id = conv["rest_id"]
                    if conversation_known(conn, rest_id):
                        hit_known = True
                        break
                    c_status, c_body = fetch_conversation_items(ctx, rest_id)
                    if c_status in (401, 403) or cookie_expired_markers(c_body):
                        raise CookieExpired(f"status={c_status}（会話取得時）")
                    if c_status != 200:
                        continue
                    messages = parse_conversation_items(c_body)
                    upsert_conversation(conn, rest_id, conv["title"], conv["created_at_ms"], messages)
                    new_conversations.append({
                        "rest_id": rest_id, "title": conv["title"],
                        "created_at_ms": conv["created_at_ms"], "messages": messages,
                    })
                    time.sleep(wait_sec)

                if hit_known or not next_cursor:
                    break
                cursor = next_cursor
        finally:
            ctx.dispose()

    conn.close()
    return new_conversations


if __name__ == "__main__":
    try:
        convs = fetch_new_conversations()
        print(f"新規{len(convs)}件")
        for c in convs:
            print(" -", c["title"])
    except CookieExpired as e:
        print(f"[COOKIE_EXPIRED] {e}", file=sys.stderr)
        sys.exit(2)
