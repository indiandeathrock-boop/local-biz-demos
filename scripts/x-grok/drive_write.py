#!/usr/bin/env python3
"""サービスアカウントでGoogle Drive Docsへの書き込み。
x-bookmarks/drive_write.pyと同じ設計（HTML変換によるフォーマット、
サービスアカウントのDrive容量制約への対処）を会話データ向けに調整。
同じサービスアカウント・同じ「X」フォルダを使い、ファイル名のみ区別する。
"""
import html as html_lib
import io
import os
from datetime import datetime

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SERVICE_ACCOUNT_PATH = os.path.expanduser("~/.secrets/x-bookmarks-service-account.json")
SCOPES = ["https://www.googleapis.com/auth/drive"]
DRIVE_FOLDER_NAME = "X"
DOC_MIME = "application/vnd.google-apps.document"


def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_PATH, scopes=SCOPES)
    return build("drive", "v3", credentials=creds)


def find_folder(service, name=DRIVE_FOLDER_NAME):
    q = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    res = service.files().list(q=q, fields="files(id, name)").execute()
    files = res.get("files", [])
    if not files:
        raise RuntimeError(f"フォルダ「{name}」が見つかりません。サービスアカウントに共有されているか確認してください。")
    return files[0]["id"]


class YearDocMissing(Exception):
    """年次ファイルが存在せず、サービスアカウントでは作成できない場合に送出する。
    理由はx-bookmarks/drive_write.pyのYearDocMissingと同じ（Drive容量制約）。
    """
    def __init__(self, title):
        self.title = title
        super().__init__(f"「{title}」が見つかりません。RKに手動作成を依頼してください。")


def find_year_doc(service, folder_id, year):
    title = f"Xグロック会話_{year}"
    q = f"name = '{title}' and '{folder_id}' in parents and trashed = false"
    res = service.files().list(q=q, fields="files(id, name)").execute()
    files = res.get("files", [])
    if not files:
        raise YearDocMissing(title)
    return files[0]["id"]


def export_doc_html(service, file_id):
    data = service.files().export(fileId=file_id, mimeType="text/html").execute()
    html_text = data.decode("utf-8") if isinstance(data, bytes) else data
    if "</body>" not in html_text:
        html_text = "<html><body></body></html>"
    return html_text


def _format_date(created_at_ms):
    try:
        dt = datetime.fromtimestamp(created_at_ms / 1000)
        return f"{dt.year}年{dt.month}月{dt.day}日 {dt.hour:02d}:{dt.minute:02d}"
    except (TypeError, ValueError, OSError):
        return str(created_at_ms)


def _conversation_to_html(conv):
    """会話1件をHTML化する。タイトルを見出し(太字大)、各メッセージは
    送信者(User/Grok)を太字ラベルにして本文と視覚的に区別する。
    """
    date_str = html_lib.escape(_format_date(conv["created_at_ms"]))
    title = html_lib.escape(conv["title"] or "(無題)")
    parts = [
        f'<p style="margin:20pt 0 4pt 0"><span style="font-size:15pt;font-weight:700">'
        f"{title}</span></p>"
        f'<p style="margin:0 0 8pt 0"><span style="font-size:9pt;color:#666666">{date_str}</span></p>'
    ]
    sender_label = {"User": "ユーザー", "Agent": "Grok"}
    for m in conv["messages"]:
        label = html_lib.escape(sender_label.get(m["sender"], m["sender"]))
        text = html_lib.escape(m["message"]).replace("\n", "<br>")
        weight = "700" if m["sender"] == "User" else "400"
        parts.append(
            f'<p style="margin:6pt 0 2pt 0"><span style="font-size:11pt;font-weight:{weight}">'
            f"【{label}】</span></p>"
            f'<p style="margin:0 0 4pt 0"><span style="font-size:11pt">{text}</span></p>'
        )
    return "".join(parts)


def append_conversations(service, file_id, existing_html, conversations):
    new_html = "".join(_conversation_to_html(c) for c in conversations)
    updated = existing_html.replace("</body>", new_html + "</body>")
    media = MediaIoBaseUpload(io.BytesIO(updated.encode("utf-8")), mimetype="text/html", resumable=False)
    service.files().update(fileId=file_id, media_body=media).execute()
    return len(conversations)


def write_conversations(conversations_by_year):
    """conversations_by_year: {2026: [conv(rest_idを含む), ...], ...}
    戻り値: (年ごとの成功件数, 成功したrest_idリスト, 年次ファイル不足の年リスト)
    """
    service = get_drive_service()
    folder_id = find_folder(service)
    result = {}
    synced_ids = []
    missing_years = []
    for year, convs in conversations_by_year.items():
        if not convs:
            continue
        try:
            file_id = find_year_doc(service, folder_id, year)
        except YearDocMissing as e:
            print(f"[NEED ACTION] {e}")
            missing_years.append(year)
            continue
        existing = export_doc_html(service, file_id)
        n = append_conversations(service, file_id, existing, convs)
        result[year] = n
        synced_ids.extend(c["rest_id"] for c in convs)
        print(f"[OK] {year}年: {n}件追記（file_id={file_id}）")
    return result, synced_ids, missing_years
