#!/usr/bin/env python3
"""launchdから3日毎に呼ばれるエントリポイント（Grok会話版）。
x-bookmarks/run_periodic.pyと同じ構造。差分収集→Drive追記→Telegram報告。
"""
import sys
import traceback
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, "/Users/ryukando/local-biz-demos/scripts/x-grok")
from fetch_diff import CookieExpired, fetch_new_conversations
from drive_write import write_conversations
from lib import db_connect, get_unsynced, mark_synced
from notify import send_telegram

COOKIE_REACQUIRE_GUIDE = (
    "Xグロック会話自動収集: cookieが失効した可能性があります。\n\n"
    "再取得手順:\n"
    "1. x.comにログインした状態でChromeを開く\n"
    "2. F12でDevTools→Application→Cookies→https://x.com\n"
    "3. auth_token と ct0 の値をコピー\n"
    "4. 「auth_token: xxxx」「ct0: xxxx」の形でここに送信してください\n"
    "（ブックマーク収集と同じcookieを共有しているため、再取得は両方に反映されます）"
)


def main():
    try:
        new_convs = fetch_new_conversations()
    except CookieExpired:
        send_telegram(COOKIE_REACQUIRE_GUIDE)
        print("[COOKIE_EXPIRED] Telegram通知済み", file=sys.stderr)
        sys.exit(2)
    except Exception:
        err = traceback.format_exc()
        send_telegram(f"Xグロック会話自動収集でエラーが発生しました:\n{err[-500:]}")
        print(err, file=sys.stderr)
        sys.exit(1)

    conn = db_connect()
    unsynced = get_unsynced(conn)
    conn.close()

    if not unsynced:
        send_telegram(f"Xグロック会話自動収集: 新規{len(new_convs)}件でした")
        return

    by_year = defaultdict(list)
    for c in unsynced:
        year = datetime.fromtimestamp(c["created_at_ms"] / 1000).year
        by_year[year].append(c)

    try:
        result, synced_ids, missing_years = write_conversations(dict(by_year))
    except Exception:
        err = traceback.format_exc()
        send_telegram(
            f"Xグロック会話自動収集: 新規{len(new_convs)}件取得したがDrive書き込みでエラー:\n{err[-500:]}\n"
            f"（データはローカルDBに保存済みのため、次回実行時に再試行されます）"
        )
        print(err, file=sys.stderr)
        sys.exit(1)

    conn = db_connect()
    mark_synced(conn, synced_ids)
    conn.close()

    lines = [f"Xグロック会話自動収集: 新規{len(new_convs)}件取得、Driveに{len(synced_ids)}件追記しました"]
    for year, n in result.items():
        lines.append(f"  {year}年: {n}件")
    if missing_years:
        years_str = "、".join(str(y) for y in missing_years)
        unsynced_count = len(unsynced) - len(synced_ids)
        lines.append(
            f"\n未書き込み: {years_str}年分（{unsynced_count}件、次回再試行されます）。"
            f"Driveの「X」フォルダに「Xグロック会話_{missing_years[0]}」という空のGoogleドキュメントを"
            f"作成してください。"
        )
    send_telegram("\n".join(lines))


if __name__ == "__main__":
    main()
