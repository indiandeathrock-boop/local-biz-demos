#!/usr/bin/env python3
"""サービスアカウントでGoogle Docsへの追記書き込み。

2026-07-19: Drive API export+reupload方式から Docs API batchUpdate(insertText)
方式に移行した（x-grok/drive_write.pyと同じ変更、詳細はそちらのコメント参照）。
旧方式は「毎回Doc全体をHTMLエクスポート→追記→丸ごと再アップロード」のため
Docが大きくなるほど確実に破綻する設計だった（Xグロック会話_2026が172件で
Googleのエクスポート容量上限に達し書き込み不能になった事象を受けての変更）。
insertTextは文書末尾への差分追記のみで、既存内容の読み込みが不要なため、
この種のサイズ上限問題が原理的に発生しない。
"""
import os
from datetime import datetime

from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_PATH = os.path.expanduser("~/.secrets/x-bookmarks-service-account.json")
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
]
DRIVE_FOLDER_NAME = "X"


def get_services():
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_PATH, scopes=SCOPES)
    return build("drive", "v3", credentials=creds), build("docs", "v1", credentials=creds)


def find_folder(drive, name=DRIVE_FOLDER_NAME):
    q = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    res = drive.files().list(q=q, fields="files(id, name)").execute()
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


def find_year_doc(drive, folder_id, year):
    title = f"Xブックマーク_{year}"
    q = f"name = '{title}' and '{folder_id}' in parents and trashed = false"
    res = drive.files().list(q=q, fields="files(id, name)").execute()
    files = res.get("files", [])
    if not files:
        raise YearDocMissing(title)
    return files[0]["id"]


def _format_date(created_at):
    """Twitter形式（例: 'Tue Jul 14 18:36:45 +0000 2026'）を日本語の読みやすい表記に変換する。
    解析に失敗した場合は元の文字列をそのまま返す（表示劣化はしても収集データは失わない）。
    """
    try:
        dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
        return f"{dt.year}年{dt.month}月{dt.day}日 {dt.hour:02d}:{dt.minute:02d}"
    except (ValueError, TypeError):
        return created_at


def _utf16_len(text):
    """Docs APIのindexはUTF-16コード単位。Pythonのlen()はコードポイント数のため、
    絵文字等のサロゲートペア文字が含まれると挿入位置がずれてDocが壊れる。"""
    return len(text.encode("utf-16-le")) // 2


def _get_doc_end_index(docs, file_id):
    doc = docs.documents().get(documentId=file_id, fields="body(content(endIndex))").execute()
    content = doc.get("body", {}).get("content", [])
    end_index = content[-1]["endIndex"] if content else 1
    return max(end_index - 1, 1)


def _entry_requests(entry, start_index):
    requests = []
    idx = start_index

    def insert(text, bold=False, size=11, color=None):
        nonlocal idx
        n = _utf16_len(text)
        requests.append({"insertText": {"location": {"index": idx}, "text": text}})
        style = {"bold": bold, "fontSize": {"magnitude": size, "unit": "PT"}}
        fields = "bold,fontSize"
        if color:
            style["foregroundColor"] = {"color": {"rgbColor": color}}
            fields += ",foregroundColor"
        requests.append({
            "updateTextStyle": {
                "range": {"startIndex": idx, "endIndex": idx + n},
                "textStyle": style,
                "fields": fields,
            },
        })
        idx += n

    date_str = _format_date(entry["created_at"])
    insert(f"\n{date_str} @{entry['screen_name']}\n", bold=True, size=13)
    insert(f"{entry['text']}\n", bold=False, size=11)
    insert(f"{entry['url']}\n", bold=False, size=9, color={"red": 0.4, "green": 0.4, "blue": 0.4})

    return requests, idx


def append_entries(docs, file_id, entries):
    """entries: [{"created_at": ..., "screen_name": ..., "text": ..., "url": ...}, ...]
    文書末尾に差分追記する。日付を太字・大きめフォントで見出し的に表示し、
    本文と視覚的に区別する。
    """
    idx = _get_doc_end_index(docs, file_id)
    all_requests = []
    for entry in entries:
        reqs, idx = _entry_requests(entry, idx)
        all_requests.extend(reqs)
    if all_requests:
        docs.documents().batchUpdate(documentId=file_id, body={"requests": all_requests}).execute()
    return len(entries)


def write_bookmarks(entries_by_year):
    """entries_by_year: {2026: [entry(idを含む), ...], 2025: [...]}
    年をまたぐ場合に備え年ごとに振り分けて書き込む。
    戻り値: (年ごとの成功件数の辞書, 成功したentryのidリスト, 年次ファイル不足で書けなかった年のリスト)
    """
    drive, docs = get_services()
    folder_id = find_folder(drive)
    result = {}
    synced_ids = []
    missing_years = []
    for year, entries in entries_by_year.items():
        if not entries:
            continue
        try:
            file_id = find_year_doc(drive, folder_id, year)
        except YearDocMissing as e:
            print(f"[NEED ACTION] {e}")
            missing_years.append(year)
            continue
        n = append_entries(docs, file_id, entries)
        result[year] = n
        synced_ids.extend(e["id"] for e in entries)
        print(f"[OK] {year}年: {n}件追記（file_id={file_id}）")
    return result, synced_ids, missing_years
