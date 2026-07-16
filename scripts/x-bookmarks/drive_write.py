#!/usr/bin/env python3
"""Phase3: サービスアカウントでGoogle Drive Docsへの書き込み。

年次ファイル「Xブックマーク_YYYY」に追記する。Google Docs API不使用
（追加のAPI有効化をRKに求めずに済むよう、Drive APIのみで完結させる設計）。
方式: 既存Docの内容をtext/plainでエクスポート → 末尾に新規分を追加した
テキストを組み立て → files.update()でtext/plain contentをアップロードし、
Drive側の自動変換でGoogle Doc本文を丸ごと置き換える（読み取り→書き戻し方式）。
"""
import html as html_lib
import io
import os
import re
from datetime import datetime

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SERVICE_ACCOUNT_PATH = os.path.expanduser("~/.secrets/x-bookmarks-service-account.json")
SCOPES = ["https://www.googleapis.com/auth/drive"]
DRIVE_FOLDER_NAME = "X"
DOC_MIME = "application/vnd.google-apps.document"


def get_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_PATH, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)


def find_folder(service, name=DRIVE_FOLDER_NAME):
    q = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    res = service.files().list(q=q, fields="files(id, name)").execute()
    files = res.get("files", [])
    if not files:
        raise RuntimeError(
            f"フォルダ「{name}」が見つかりません。サービスアカウントに共有されているか確認してください。"
        )
    return files[0]["id"]


class YearDocMissing(Exception):
    """年次ファイルが存在せず、サービスアカウントでは作成できない場合に送出する。

    サービスアカウントはDrive容量を持たないため、新規ファイル作成は
    storageQuotaExceededで失敗する（個人Googleアカウントの既知の制約。
    Google Workspaceの共有ドライブなら解決するが対象外）。
    既存ファイルの更新は所有者(RK)の容量が使われるため問題ない。
    年次の切り替わり（年1回程度）のみRKに手動作成を依頼する設計とする。
    """
    def __init__(self, title):
        self.title = title
        super().__init__(f"「{title}」が見つかりません。RKに手動作成を依頼してください。")


def find_year_doc(service, folder_id, year):
    title = f"Xブックマーク_{year}"
    q = f"name = '{title}' and '{folder_id}' in parents and trashed = false"
    res = service.files().list(q=q, fields="files(id, name)").execute()
    files = res.get("files", [])
    if not files:
        raise YearDocMissing(title)
    return files[0]["id"]


def export_doc_html(service, file_id):
    """既存Docの内容をHTMLで取得する。空のDocでも最低限のhtml/body構造は返る。"""
    data = service.files().export(fileId=file_id, mimeType="text/html").execute()
    html_text = data.decode("utf-8") if isinstance(data, bytes) else data
    if "</body>" not in html_text:
        html_text = "<html><body></body></html>"
    return html_text


def _format_date(created_at):
    """Twitter形式（例: 'Tue Jul 14 18:36:45 +0000 2026'）を日本語の読みやすい表記に変換する。
    解析に失敗した場合は元の文字列をそのまま返す（表示劣化はしても収集データは失わない）。
    """
    try:
        dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
        return f"{dt.year}年{dt.month}月{dt.day}日 {dt.hour:02d}:{dt.minute:02d}"
    except (ValueError, TypeError):
        return created_at


def _entry_to_html(e):
    date_str = html_lib.escape(_format_date(e["created_at"]))
    screen_name = html_lib.escape(e["screen_name"])
    text = html_lib.escape(e["text"]).replace("\n", "<br>")
    url = html_lib.escape(e["url"])
    return (
        f'<p style="margin:16pt 0 2pt 0"><span style="font-size:13pt;font-weight:700">'
        f"{date_str} @{screen_name}</span></p>"
        f'<p style="margin:0 0 4pt 0"><span style="font-size:11pt">{text}</span></p>'
        f'<p style="margin:0 0 0 0"><span style="font-size:9pt;color:#666666">{url}</span></p>'
    )


def append_entries(service, file_id, existing_html, entries):
    """entries: [{"created_at": ..., "screen_name": ..., "text": ..., "url": ...}, ...]
    日付を太字・大きめフォントで見出し的に表示し、本文と視覚的に区別する。
    既存HTMLの</body>直前に新規分を挿入し、text/htmlとしてアップロードして
    Doc内容を置き換える（Drive側がHTML→Google Doc形式へ自動変換する）。
    """
    new_html = "".join(_entry_to_html(e) for e in entries)
    updated = existing_html.replace("</body>", new_html + "</body>")

    media = MediaIoBaseUpload(io.BytesIO(updated.encode("utf-8")), mimetype="text/html", resumable=False)
    service.files().update(fileId=file_id, media_body=media).execute()
    return len(entries)


def write_bookmarks(entries_by_year):
    """entries_by_year: {2026: [entry(idを含む), ...], 2025: [...]}
    年をまたぐ場合に備え年ごとに振り分けて書き込む。
    戻り値: (年ごとの成功件数の辞書, 成功したentryのidリスト, 年次ファイル不足で書けなかった年のリスト)
    """
    service = get_drive_service()
    folder_id = find_folder(service)
    result = {}
    synced_ids = []
    missing_years = []
    for year, entries in entries_by_year.items():
        if not entries:
            continue
        try:
            file_id = find_year_doc(service, folder_id, year)
        except YearDocMissing as e:
            print(f"[NEED ACTION] {e}")
            missing_years.append(year)
            continue
        existing = export_doc_html(service, file_id)
        n = append_entries(service, file_id, existing, entries)
        result[year] = n
        synced_ids.extend(e["id"] for e in entries)
        print(f"[OK] {year}年: {n}件追記（file_id={file_id}）")
    return result, synced_ids, missing_years
