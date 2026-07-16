#!/usr/bin/env python3
"""Xグローク会話の初回全件収集。cursorをmetaに保存し中断・再開に対応する。

使い方:
  python3 fetch_all.py [--max-conversations 30] [--wait-sec 3]
"""
import argparse
import sys
import time

sys.path.insert(0, "/Users/ryukando/local-biz-demos/scripts/x-grok")
from playwright.sync_api import sync_playwright
from lib import (build_request_context, cookie_expired_markers, db_connect,
                  fetch_conversation_items, fetch_history_page, get_meta,
                  load_env, parse_conversation_items, parse_history_page,
                  set_meta, upsert_conversation)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--max-conversations", type=int, default=30,
                    help="この実行で取得する最大会話数")
    p.add_argument("--wait-sec", type=float, default=3.0,
                    help="会話取得間の待機秒数（レート制限対策）")
    args = p.parse_args()

    env = load_env()
    conn = db_connect()
    cursor = get_meta(conn, "history_cursor")
    done = get_meta(conn, "initial_fetch_done") == "1"

    if done:
        print("[INFO] 初回全件収集は完了済みです（fetch_diff.pyで差分収集してください）")
        return

    fetched_count = 0
    with sync_playwright() as pw:
        ctx = build_request_context(pw, env)
        try:
            while fetched_count < args.max_conversations:
                status, body = fetch_history_page(ctx, cursor=cursor)
                if status in (401, 403) or cookie_expired_markers(body):
                    print(f"[FATAL] cookie失効の可能性（status={status}）。再取得が必要です。", file=sys.stderr)
                    sys.exit(2)
                if status != 200:
                    print(f"[ERROR] status={status} body={body}", file=sys.stderr)
                    sys.exit(1)

                convs, next_cursor = parse_history_page(body)
                if not convs:
                    print("[DONE] 会話一覧が尽きました。初回全件収集を完了とみなします。")
                    set_meta(conn, "initial_fetch_done", "1")
                    cursor = None
                    break

                for conv in convs:
                    if fetched_count >= args.max_conversations:
                        break
                    rest_id = conv["rest_id"]
                    c_status, c_body = fetch_conversation_items(ctx, rest_id)
                    if c_status in (401, 403) or cookie_expired_markers(c_body):
                        print(f"[FATAL] cookie失効の可能性（会話取得時 status={c_status}）。", file=sys.stderr)
                        sys.exit(2)
                    if c_status != 200:
                        print(f"[WARN] 会話取得失敗 rest_id={rest_id} status={c_status}", file=sys.stderr)
                        continue
                    messages = parse_conversation_items(c_body)
                    upsert_conversation(conn, rest_id, conv["title"], conv["created_at_ms"], messages)
                    fetched_count += 1
                    print(f"[CONV {fetched_count}] {conv['title']} ({len(messages)}メッセージ)")
                    time.sleep(args.wait_sec)

                cursor = next_cursor
                if cursor:
                    set_meta(conn, "history_cursor", cursor)
                if not cursor:
                    print("[DONE] cursorが尽きました。初回全件収集を完了とみなします。")
                    set_meta(conn, "initial_fetch_done", "1")
                    break
        finally:
            ctx.dispose()

    remaining = "完了" if get_meta(conn, "initial_fetch_done") == "1" else "未完了（再実行で続きから取得されます）"
    print(f"[SUMMARY] 新規{fetched_count}件の会話を取得 状態: {remaining}")
    conn.close()


if __name__ == "__main__":
    main()
