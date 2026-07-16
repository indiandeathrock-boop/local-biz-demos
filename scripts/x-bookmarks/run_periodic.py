#!/usr/bin/env python3
"""launchdから3日毎に呼ばれるエントリポイント。
差分収集 → Drive Docs追記 → Telegram報告（0件でも報告）を一括実行する。
cookie失効時、Drive年次ファイル不足時はTelegramに対応手順を通知する。
"""
import sys
import traceback
from collections import defaultdict

sys.path.insert(0, "/Users/ryukando/local-biz-demos/scripts/x-bookmarks")
from fetch_diff import CookieExpired, fetch_new_bookmarks
from drive_write import write_bookmarks
from lib import db_connect, get_unsynced, mark_synced
from notify import send_telegram

COOKIE_REACQUIRE_GUIDE = (
    "Xブックマーク自動収集: cookieが失効した可能性があります。\n\n"
    "再取得手順:\n"
    "1. x.comにログインした状態でChromeを開く\n"
    "2. F12でDevTools→Application→Cookies→https://x.com\n"
    "3. auth_token と ct0 の値をコピー\n"
    "4. 「auth_token: xxxx」「ct0: xxxx」の形でここに送信してください"
)


def main():
    try:
        new_entries = fetch_new_bookmarks()
    except CookieExpired:
        send_telegram(COOKIE_REACQUIRE_GUIDE)
        print("[COOKIE_EXPIRED] Telegram通知済み", file=sys.stderr)
        sys.exit(2)
    except Exception:
        err = traceback.format_exc()
        send_telegram(f"Xブックマーク自動収集でエラーが発生しました:\n{err[-500:]}")
        print(err, file=sys.stderr)
        sys.exit(1)

    # 今回の新規分に加え、前回までにDrive書き込みが失敗して未同期のまま残っている分も対象にする
    conn = db_connect()
    unsynced = get_unsynced(conn)
    conn.close()

    if not unsynced:
        send_telegram(f"Xブックマーク自動収集: 新規{len(new_entries)}件でした")
        return

    by_year = defaultdict(list)
    for e in unsynced:
        year = e["created_at"].split()[-1] if e.get("created_at") else "unknown"
        by_year[year].append(e)

    try:
        result, synced_ids, missing_years = write_bookmarks(dict(by_year))
    except Exception:
        err = traceback.format_exc()
        send_telegram(
            f"Xブックマーク自動収集: 新規{len(new_entries)}件取得したがDrive書き込みでエラー:\n{err[-500:]}\n"
            f"（データはローカルDBに保存済みのため、次回実行時に再試行されます）"
        )
        print(err, file=sys.stderr)
        sys.exit(1)

    conn = db_connect()
    mark_synced(conn, synced_ids)
    conn.close()

    lines = [f"Xブックマーク自動収集: 新規{len(new_entries)}件取得、Driveに{len(synced_ids)}件追記しました"]
    for year, n in result.items():
        lines.append(f"  {year}年: {n}件")
    if missing_years:
        years_str = "、".join(str(y) for y in missing_years)
        unsynced_count = len(unsynced) - len(synced_ids)
        lines.append(
            f"\n未書き込み: {years_str}年分（{unsynced_count}件、次回再試行されます）。"
            f"Driveの「X」フォルダに「Xブックマーク_{missing_years[0]}」という空のGoogleドキュメントを"
            f"作成してください。"
        )
    send_telegram("\n".join(lines))


if __name__ == "__main__":
    main()
