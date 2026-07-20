---
name: Google Drive upload method
description: Google Driveへのファイルアップロードはローカルマウントのcpコマンドを使う。MCP APIのbase64経由は使わない。
type: feedback
originSessionId: 2d13107a-ab6c-4087-afa8-422fe33ae635
---
Google Driveへのファイル保存は、MCPツール（base64経由）ではなくローカルマウントフォルダへの直接コピーで行う。

**Why:** base64エンコードした大きなファイルをMCPツールのパラメーターとして渡すと、文字が欠けたり壊れたりして「不正なbase64」エラーになる。ローカルマウント経由なら文字化けなし。

**How to apply:** Google Driveへの保存が必要なときは、まず `/Users/ryukando/Library/CloudStorage/GoogleDrive-indiandeathrock@gmail.com/マイドライブ/` 以下の対象フォルダを確認し、`cp` コマンドで直接コピーする。MCP `mcp__claude_ai_Google_Drive__create_file` は使わない。
