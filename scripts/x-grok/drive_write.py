#!/usr/bin/env python3
"""サービスアカウントでGoogle Docsへの追記書き込み。

2026-07-19: Drive API export+reupload方式から Docs API batchUpdate(insertText)
方式に移行した。旧方式は「毎回Doc全体をHTMLエクスポート→追記→丸ごと再アップロード」
のため、Docが大きくなるほど確実に破綻する設計だった（実測: Xグロック会話_2026が
172件でGoogleのHTMLエクスポート容量上限に達し"file too large to be exported"で
書き込み不能になった）。Docs APIのinsertTextは文書末尾への差分追記のみで、
既存内容を毎回読み込む必要がないため、この種のサイズ上限問題が原理的に発生しない。
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
        raise RuntimeError(f"フォルダ「{name}」が見つかりません。サービスアカウントに共有されているか確認してください。")
    return files[0]["id"]


class YearDocMissing(Exception):
    """年次ファイルが存在せず、サービスアカウントでは作成できない場合に送出する。
    サービスアカウントはDrive容量を持たないため新規ファイル作成が
    storageQuotaExceededで失敗する（個人Googleアカウントの既知の制約）。
    """
    def __init__(self, title):
        self.title = title
        super().__init__(f"「{title}」が見つかりません。RKに手動作成を依頼してください。")


def find_year_doc(drive, folder_id, year):
    title = f"Xグロック会話_{year}"
    q = f"name = '{title}' and '{folder_id}' in parents and trashed = false"
    res = drive.files().list(q=q, fields="files(id, name)").execute()
    files = res.get("files", [])
    if not files:
        raise YearDocMissing(title)
    return files[0]["id"]


def _format_date(created_at_ms):
    try:
        dt = datetime.fromtimestamp(created_at_ms / 1000)
        return f"{dt.year}年{dt.month}月{dt.day}日 {dt.hour:02d}:{dt.minute:02d}"
    except (TypeError, ValueError, OSError):
        return str(created_at_ms)


def _utf16_len(text):
    """Docs APIのindexはUTF-16コード単位。Pythonのlen()はコードポイント数のため、
    絵文字等のサロゲートペア文字が含まれると挿入位置がずれてDocが壊れる。"""
    return len(text.encode("utf-16-le")) // 2


def _get_doc_end_index(docs, file_id):
    """Docs APIのinsertTextは挿入位置indexを明示する必要がある。
    文書末尾のendIndexを取得する（末尾の改行の直前に挿入するため-1する）。
    """
    doc = docs.documents().get(documentId=file_id, fields="body(content(endIndex))").execute()
    content = doc.get("body", {}).get("content", [])
    end_index = content[-1]["endIndex"] if content else 1
    return max(end_index - 1, 1)


SENDER_LABEL = {"User": "ユーザー", "Agent": "Grok"}


def _conversation_requests(conv, start_index):
    """1会話分のbatchUpdateリクエスト列を作る。
    タイトルは大きめ太字、送信者ラベルは太字、本文は通常ウェイトで挿入する。
    Docs APIはテキスト挿入→スタイル適用の順で、挿入位置がずれるため
    後ろから（末尾側から）テキストを積んでindexを計算する方式ではなく、
    ここでは単純に「1ブロックずつ挿入して直後にスタイルを当てる」を
    conversation内で逐次実行する設計にし、呼び出し側でインデックスを追跡する。
    """
    requests = []
    idx = start_index

    def insert(text, bold=False, size=11):
        nonlocal idx
        n = _utf16_len(text)
        requests.append({"insertText": {"location": {"index": idx}, "text": text}})
        requests.append({
            "updateTextStyle": {
                "range": {"startIndex": idx, "endIndex": idx + n},
                "textStyle": {"bold": bold, "fontSize": {"magnitude": size, "unit": "PT"}},
                "fields": "bold,fontSize",
            },
        })
        idx += n

    title = conv["title"] or "(無題)"
    date_str = _format_date(conv["created_at_ms"])
    insert(f"\n{title}\n", bold=True, size=15)
    insert(f"{date_str}\n", bold=False, size=9)
    for m in conv["messages"]:
        label = SENDER_LABEL.get(m["sender"], m["sender"])
        insert(f"【{label}】\n", bold=True, size=11)
        insert(f"{m['message']}\n", bold=False, size=11)

    return requests, idx


def append_conversations(docs, file_id, conversations):
    """会話を1件ずつ文書末尾に追記する。1回のbatchUpdateで全件まとめて送る
    （API呼び出し回数を抑える。indexは事前に逐次計算して整合させる）。
    """
    idx = _get_doc_end_index(docs, file_id)
    all_requests = []
    for conv in conversations:
        reqs, idx = _conversation_requests(conv, idx)
        all_requests.extend(reqs)
    if all_requests:
        docs.documents().batchUpdate(documentId=file_id, body={"requests": all_requests}).execute()
    return len(conversations)


def write_conversations(conversations_by_year):
    """conversations_by_year: {2026: [conv(rest_idを含む), ...], ...}
    戻り値: (年ごとの成功件数, 成功したrest_idリスト, 年次ファイル不足の年リスト)
    """
    drive, docs = get_services()
    folder_id = find_folder(drive)
    result = {}
    synced_ids = []
    missing_years = []
    for year, convs in conversations_by_year.items():
        if not convs:
            continue
        try:
            file_id = find_year_doc(drive, folder_id, year)
        except YearDocMissing as e:
            print(f"[NEED ACTION] {e}")
            missing_years.append(year)
            continue
        n = append_conversations(docs, file_id, convs)
        result[year] = n
        synced_ids.extend(c["rest_id"] for c in convs)
        print(f"[OK] {year}年: {n}件追記（file_id={file_id}）")
    return result, synced_ids, missing_years
