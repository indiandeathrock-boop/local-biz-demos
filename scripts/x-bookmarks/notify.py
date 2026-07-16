#!/usr/bin/env python3
"""launchd無人実行からのTelegram通知。CC(claude)本体を経由せず直接Bot APIを叩く。
既存のgbp-watch/notify.jsと同じ資格情報（~/.claude/channels/telegram/.env）を流用する。
"""
import os
import re
import urllib.request
import json

ENV_FILE = os.path.expanduser("~/.claude/channels/telegram/.env")
CHAT_ID = "5881925140"


def _read_bot_token():
    with open(ENV_FILE) as f:
        txt = f.read()
    m = re.search(r"^TELEGRAM_BOT_TOKEN=(.+)$", txt, re.M)
    if not m:
        raise RuntimeError(f"TELEGRAM_BOT_TOKEN が {ENV_FILE} に見つかりません")
    return m.group(1).strip()


def send_telegram(text):
    token = _read_bot_token()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = json.dumps({"chat_id": CHAT_ID, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = json.loads(resp.read())
    if not body.get("ok"):
        raise RuntimeError(f"Telegram送信失敗: {body}")
    return body["result"]["message_id"]
