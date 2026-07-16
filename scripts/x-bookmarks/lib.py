#!/usr/bin/env python3
"""Xブックマーク収集の共有ロジック。

cookie読み込み・GraphQL応答からのツイート抽出・SQLite管理を
fetch_all.py（初回全件収集）とfetch_diff.py（定期差分収集）の
両方から共有する（採点ロジックの単一実装原則と同じ考え方）。
"""
import json
import os
import re
import sqlite3
import time

ENV_PATH = os.path.expanduser("~/.secrets/x-bookmarks.env")
DB_PATH = os.path.expanduser("~/local-biz-demos/scripts/x-bookmarks/bookmarks.db")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

# x.comのWebクライアントが使う公開Bearerトークン（アカウント非依存の固定値）。
# 実際のブラウザリクエストをキャプチャして確認済み（2026-07-16）。
BEARER_TOKEN = ("Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs"
                "%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA")

# Bookmarks GraphQL query ID。X側の仕様変更で不定期に変わりうる。
# 変わった場合はprobe.pyで再取得し、この値を更新する。
BOOKMARKS_QUERY_ID = "LoLaMO4GuHLEPJOhH9kjAw"

BOOKMARKS_FEATURES = {
    "rweb_video_screen_enabled": False, "rweb_cashtags_enabled": True,
    "profile_label_improvements_pcf_label_in_post_enabled": True,
    "responsive_web_profile_redirect_enabled": False, "rweb_tipjar_consumption_enabled": False,
    "verified_phone_label_enabled": False, "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "premium_content_api_read_enabled": False,
    "communities_web_enable_tweet_community_results_fetch": True,
    "c9s_tweet_anatomy_moderator_badge_enabled": True,
    "responsive_web_grok_analyze_button_fetch_trends_enabled": False,
    "responsive_web_grok_analyze_post_followups_enabled": True,
    "rweb_cashtags_composer_attachment_enabled": True, "responsive_web_jetfuel_frame": True,
    "responsive_web_grok_share_attachment_enabled": True, "responsive_web_grok_annotations_enabled": True,
    "articles_preview_enabled": True, "responsive_web_edit_tweet_api_enabled": True,
    "rweb_conversational_replies_downvote_enabled": False,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
    "view_counts_everywhere_api_enabled": True, "longform_notetweets_consumption_enabled": True,
    "responsive_web_twitter_article_tweet_consumption_enabled": True,
    "content_disclosure_indicator_enabled": True, "content_disclosure_ai_generated_indicator_enabled": True,
    "responsive_web_grok_show_grok_translated_post": True,
    "responsive_web_grok_analysis_button_from_backend": True, "post_ctas_fetch_enabled": False,
    "freedom_of_speech_not_reach_fetch_enabled": True, "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True, "longform_notetweets_inline_media_enabled": False,
    "responsive_web_grok_image_annotation_enabled": True, "responsive_web_grok_imagine_annotation_enabled": True,
    "responsive_web_grok_community_note_auto_translation_is_enabled": True,
    "responsive_web_enhance_cards_enabled": False,
}


def build_request_context(pw, env):
    """cookie・認証ヘッダを組み込んだPlaywright APIRequestContextを作る。
    実ブラウザページを開かず直接GraphQLエンドポイントを叩けるため、
    スクロール操作が不要になり、cursorで正確にページングできる。
    """
    return pw.request.new_context(
        base_url="https://x.com",
        extra_http_headers={
            "authorization": BEARER_TOKEN,
            "x-csrf-token": env["X_CT0"],
            "x-twitter-active-user": "yes",
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-client-language": "ja",
            "content-type": "application/json",
            "user-agent": UA,
        },
        storage_state={
            "cookies": [
                {"name": "auth_token", "value": env["X_AUTH_TOKEN"], "domain": ".x.com", "path": "/",
                 "expires": -1, "httpOnly": True, "secure": True, "sameSite": "None"},
                {"name": "ct0", "value": env["X_CT0"], "domain": ".x.com", "path": "/",
                 "expires": -1, "httpOnly": False, "secure": True, "sameSite": "Lax"},
            ],
            "origins": [],
        },
    )


def fetch_bookmarks_page(request_ctx, cursor=None, count=20):
    """Bookmarks GraphQLを1ページ分呼び出す。戻り値は(status, body)。"""
    variables = {"count": count, "includePromotedContent": True}
    if cursor:
        variables["cursor"] = cursor
    url = f"/i/api/graphql/{BOOKMARKS_QUERY_ID}/Bookmarks"
    resp = request_ctx.get(url, params={
        "variables": json.dumps(variables, separators=(",", ":")),
        "features": json.dumps(BOOKMARKS_FEATURES, separators=(",", ":")),
    })
    try:
        body = resp.json()
    except Exception:
        body = None
    return resp.status, body


def load_env(path=ENV_PATH):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


def cookie_expired_markers(body):
    """cookie失効・認証エラーを示すGraphQL応答の特徴を検出する。"""
    if not isinstance(body, dict):
        return False
    errors = body.get("errors")
    if errors:
        for e in errors:
            msg = str(e.get("message", "")).lower()
            if "could not authenticate" in msg or "bad guest token" in msg or "37" == str(e.get("code")):
                return True
    return False


def parse_entries(body):
    """GraphQL Bookmarks応答からツイートのリストとcursor(次ページ用)を抽出する。"""
    tweets = []
    cursor = None
    try:
        instructions = body["data"]["bookmark_timeline_v2"]["timeline"]["instructions"]
    except (KeyError, TypeError):
        return tweets, cursor

    for instr in instructions:
        for entry in instr.get("entries", []):
            content = entry.get("content", {})
            entry_type = content.get("entryType")

            if entry_type == "TimelineTimelineCursor" and content.get("cursorType") == "Bottom":
                cursor = content.get("value")
                continue

            if entry_type != "TimelineTimelineItem":
                continue

            try:
                item = content["itemContent"]
                if item.get("itemType") != "TimelineTweet":
                    continue
                tweet = item["tweet_results"]["result"]
                if tweet.get("__typename") == "TweetTombstone":
                    continue  # 削除済み・非公開化されたツイート
                legacy = tweet.get("legacy", {})
                tweet_id = legacy.get("id_str") or tweet.get("rest_id")
                if not tweet_id:
                    continue

                # 長文ポストはnote_tweetに全文が入る（legacy.full_textは280字で切られる）
                note_tweet = tweet.get("note_tweet", {})
                note_text = (
                    note_tweet.get("note_tweet_results", {})
                    .get("result", {})
                    .get("text")
                )
                full_text = note_text or legacy.get("full_text", "")

                user = tweet.get("core", {}).get("user_results", {}).get("result", {})
                screen_name = (
                    user.get("core", {}).get("screen_name")
                    or user.get("legacy", {}).get("screen_name")
                    or "unknown"
                )

                created_at = legacy.get("created_at", "")

                tweets.append({
                    "id": tweet_id,
                    "screen_name": screen_name,
                    "text": full_text,
                    "created_at": created_at,
                    "url": f"https://x.com/{screen_name}/status/{tweet_id}",
                })
            except (KeyError, TypeError) as e:
                print(f"[WARN] entry解析失敗: {e}", flush=True)
                continue

    return tweets, cursor


def db_connect(path=DB_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            screen_name TEXT,
            text TEXT,
            created_at TEXT,
            url TEXT,
            fetched_at TEXT,
            drive_synced INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    conn.commit()
    return conn


def get_meta(conn, key, default=None):
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def set_meta(conn, key, value):
    conn.execute("INSERT INTO meta (key, value) VALUES (?, ?) "
                 "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))
    conn.commit()


def get_unsynced(conn):
    """Drive未書き込みのツイートを全件返す（前回の部分失敗分の再送用）。"""
    rows = conn.execute(
        "SELECT id, screen_name, text, created_at, url FROM bookmarks WHERE drive_synced = 0"
    ).fetchall()
    return [
        {"id": r[0], "screen_name": r[1], "text": r[2], "created_at": r[3], "url": r[4]}
        for r in rows
    ]


def mark_synced(conn, ids):
    if not ids:
        return
    conn.executemany("UPDATE bookmarks SET drive_synced = 1 WHERE id = ?", [(i,) for i in ids])
    conn.commit()


def upsert_tweets(conn, tweets):
    """新規ツイートのみ挿入。戻り値は新規挿入件数。"""
    new_count = 0
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    for t in tweets:
        cur = conn.execute("SELECT 1 FROM bookmarks WHERE id = ?", (t["id"],))
        if cur.fetchone():
            continue
        conn.execute(
            "INSERT INTO bookmarks (id, screen_name, text, created_at, url, fetched_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (t["id"], t["screen_name"], t["text"], t["created_at"], t["url"], now),
        )
        new_count += 1
    conn.commit()
    return new_count
