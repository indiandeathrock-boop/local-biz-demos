#!/usr/bin/env python3
"""X内Grok会話収集の共有ロジック。x-bookmarks/lib.pyと同じ設計方針を踏襲する。

会話一覧(GrokHistory)→各会話のメッセージ一覧(GrokConversationItemsByRestId)の
2段構成。cookieはx-bookmarksと同じXアカウントのものを流用する。
"""
import json
import os
import sqlite3
import time

ENV_PATH = os.path.expanduser("~/.secrets/x-bookmarks.env")  # 同一Xアカウントのcookieを流用
DB_PATH = os.path.expanduser("~/local-biz-demos/scripts/x-grok/grok_conversations.db")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

BEARER_TOKEN = ("Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs"
                "%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA")

# Grok関連query ID。X側の仕様変更で不定期に変わりうる（probe.pyで再取得）。
GROK_HISTORY_QUERY_ID = "9Hyh5D4-WXLnExZkONSkZg"
GROK_CONVERSATION_ITEMS_QUERY_ID = "olzDR71JULywD2dDNZbb5A"

CONVERSATION_ITEMS_FEATURES = {
    "creator_subscriptions_tweet_preview_api_enabled": True, "premium_content_api_read_enabled": False,
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
    "rweb_cashtags_enabled": True, "freedom_of_speech_not_reach_fetch_enabled": True,
    "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True, "longform_notetweets_inline_media_enabled": False,
    "profile_label_improvements_pcf_label_in_post_enabled": True,
    "responsive_web_profile_redirect_enabled": False, "rweb_tipjar_consumption_enabled": False,
    "verified_phone_label_enabled": False, "responsive_web_grok_image_annotation_enabled": True,
    "responsive_web_grok_imagine_annotation_enabled": True,
    "responsive_web_grok_community_note_auto_translation_is_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "responsive_web_graphql_timeline_navigation_enabled": True,
}


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


def build_request_context(pw, env):
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


def cookie_expired_markers(body):
    if not isinstance(body, dict):
        return False
    errors = body.get("errors")
    if errors:
        for e in errors:
            msg = str(e.get("message", "")).lower()
            if "could not authenticate" in msg or "bad guest token" in msg:
                return True
    return False


def fetch_history_page(request_ctx, cursor=None):
    """会話一覧を1ページ取得する。戻り値は(status, body)。"""
    variables = {} if not cursor else {"cursor": cursor}
    url = f"/i/api/graphql/{GROK_HISTORY_QUERY_ID}/GrokHistory"
    resp = request_ctx.get(url, params={"variables": json.dumps(variables, separators=(",", ":"))})
    try:
        body = resp.json()
    except Exception:
        body = None
    return resp.status, body


def parse_history_page(body):
    """会話一覧応答から(conversations, cursor)を抽出する。"""
    try:
        data = body["data"]["grok_conversation_history"]
    except (KeyError, TypeError):
        return [], None
    convs = []
    for item in data.get("items", []):
        conv = item.get("grokConversation", {})
        rest_id = conv.get("rest_id")
        if not rest_id:
            continue
        convs.append({
            "rest_id": rest_id,
            "title": item.get("title", ""),
            "created_at_ms": item.get("created_at_ms"),
        })
    return convs, data.get("cursor")


def fetch_conversation_items(request_ctx, rest_id):
    """1会話分のメッセージ一覧を取得する。戻り値は(status, body)。"""
    variables = {"restId": rest_id}
    url = f"/i/api/graphql/{GROK_CONVERSATION_ITEMS_QUERY_ID}/GrokConversationItemsByRestId"
    resp = request_ctx.get(url, params={
        "variables": json.dumps(variables, separators=(",", ":")),
        "features": json.dumps(CONVERSATION_ITEMS_FEATURES, separators=(",", ":")),
    })
    try:
        body = resp.json()
    except Exception:
        body = None
    return resp.status, body


def parse_conversation_items(body):
    """メッセージ一覧応答から[{sender, message, created_at_ms}, ...]を抽出する。"""
    try:
        items = body["data"]["grok_conversation_items_by_rest_id"]["items"]
    except (KeyError, TypeError):
        return []
    messages = []
    for it in items:
        msg = it.get("message")
        if not msg:
            continue
        messages.append({
            "sender": it.get("sender_type", "unknown"),
            "message": msg,
            "created_at_ms": it.get("created_at_ms"),
            "chat_item_id": it.get("chat_item_id"),
        })
    # created_at_msは新しい順で返るため古い順に並べ替える（会話として読める順）
    messages.sort(key=lambda m: m.get("created_at_ms") or 0)
    return messages


def db_connect(path=DB_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            rest_id TEXT PRIMARY KEY,
            title TEXT,
            created_at_ms INTEGER,
            messages_json TEXT,
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


def conversation_known(conn, rest_id):
    return conn.execute("SELECT 1 FROM conversations WHERE rest_id = ?", (rest_id,)).fetchone() is not None


def upsert_conversation(conn, rest_id, title, created_at_ms, messages):
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    conn.execute(
        "INSERT INTO conversations (rest_id, title, created_at_ms, messages_json, fetched_at) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(rest_id) DO UPDATE SET title=excluded.title, messages_json=excluded.messages_json, "
        "fetched_at=excluded.fetched_at",
        (rest_id, title, created_at_ms, json.dumps(messages, ensure_ascii=False), now),
    )
    conn.commit()


def get_unsynced(conn):
    rows = conn.execute(
        "SELECT rest_id, title, created_at_ms, messages_json FROM conversations WHERE drive_synced = 0"
    ).fetchall()
    return [
        {"rest_id": r[0], "title": r[1], "created_at_ms": r[2], "messages": json.loads(r[3])}
        for r in rows
    ]


def mark_synced(conn, rest_ids):
    if not rest_ids:
        return
    conn.executemany("UPDATE conversations SET drive_synced = 1 WHERE rest_id = ?", [(i,) for i in rest_ids])
    conn.commit()
