# ツール棚卸し (最終更新: 2026-07-14)

初版。intro-logで新規導入を記録するたびに、この表へ1行追記する。
※依頼時の指定は「スキル4」だったが、実際の`~/.claude/skills/`には5件ある（2026-07-13導入のbrowser-fetchを含む）ため、実態の5件で記載。

## 1. 一覧（導入済み10件）

| 名称 | 6分類 | 権限範囲 | ブラスト半径 | 保守リスク | 標準機能で代替 | 判定 |
|---|---|---|---|---|---|---|
| fable-method | skill | 読み取りのみ（方法論テキスト。ツール権限なし） | なし | 自作 | 不可（CLAUDE.mdに入れるには分量過大） | 維持 |
| demo-site-generator | skill | テンプレート読み取り＋ファイル生成＋Cloudflare Workersへデプロイ（対外公開） | 中（公開デモサイトの誤生成・誤デプロイ。git管理で復元可） | 自作 | 不可 | 維持 |
| intro-log | skill | ~/.claude/intro-log.md への追記のみ | なし | 自作（外部由来・RK管理） | 一部可（メモリ機能で記録は可能だが固定様式の台帳は不可） | 維持 |
| tool-inventory | skill | ~/.claude/ 配下の読み取り＋本ファイルの書き出し。削除は提示のみ | なし | 自作（外部由来・RK管理） | 一部可（同上） | 維持 |
| browser-fetch | skill | 任意URLの読み取り（ヘッドレスChromium）＋ローカル保存 | なし（読み取り専用。取得先の規約・著作権配慮はスキル内に明記） | 自作＋Playwright依存（公式ライブラリ） | 不可（WebFetchはJS非実行） | 維持 |
| advisor (Fable 5) | agent | Read/Grep/Glob/WebSearch/WebFetch（読み取りのみ） | なし（助言のみ。リスクは呼び出しコストのみ） | 自作 | 不可（メインがSonnet時の品質補強はagentでのみ可能） | 維持 |
| worker (Sonnet 5) | agent | 全ツール（ファイル編集・Bash実行を含む） | 中〜大（メインの直接監督外でコード変更・コマンド実行。permission設定の安全層は共有） | 自作 | 不可（コスト分業はagentの固有機能） | 維持 |
| verifier (Haiku 4.5) | agent | Read/Grep/Glob/Bash/WebFetch（Bashを持つため理論上書き込み可。役割上は検証のみ） | 小 | 自作 | 一部可（/verify・/code-reviewと部分重複。安価な要件照合は固有） | 維持 |
| Telegramプラグイン | MCP | メッセージ送受信・ファイル送受信（対外送信） | 中（誤送信＝外部公開。botトークンの管理が前提） | 公式プラグイン（claude-plugins-official） | 不可（スマホのみ運用の生命線） | 維持 |
| Google Drive MCP | MCP | Drive読み取り＋作成・複製（ツール一覧に削除なし） | 小〜中（Drive上へのファイル作成・複製。削除不可のため既存データ破壊はなし） | 公式（claude.aiコネクタ） | 不可 | 維持 |

補足:
- **agent 3件は導入以来まだ実使用ゼロ**（2026-07-14時点）。intro-logの後日評価（3週間後目安）で「未使用のまま」なら外す判断の対象にする。
- Google Drive MCPは2026-07-13に大容量PDF（各5〜10MB）のアップロード用途で検討したが、ペイロードサイズの懸念から実行せずローカル保存に切り替えた実績あり。大容量ファイルには不向き。
- claude.aiコネクタとしてGmail・Google Calendarも接続可能な状態にあるが、認証・使用実績は未確認。使い始めたらこの表に追加する。
- hooksは未導入（settings.jsonにhooksなし）。launchdジョブ（claude-telegram起動、gemini-compass通知）はCC外のOS層の仕組みのため本表の対象外とした。

## 2. 振り分け不能

該当なし。10件すべて6分類に収まった。

## 3. 観察リスト（未導入・トリガー条件つき）

| 名称 | 概要 | トリガー条件 |
|---|---|---|
| Meetily | 100%ローカルのAI会議アシスタント(Parakeet/Whisper文字起こし、外部送信なし) | 機密性の高いミーティングの文字起こしニーズが発生したら |
| agent-skills (addyosmani) | コードエージェント向けの本番品質スキル集(spec駆動開発・TDD強制・コードレビュー等) | spec/TDDの強制が必要になったら。既存原則との重複を精査してから |
| OfficeCLI | AIエージェントがWord/Excel/PowerPointを直接読み書きするCLI(Office不要) | Office文書の直接編集が頻発するようになったら。既存のdocx/pptx/xlsxスキルとの重複を精査してから |
| page-agent | 自然言語でブラウザのDOM操作(クリック・フォーム入力)を行うエージェント | Claude in Chromeで不足を感じたら。閲覧のみならbrowser-fetchで足りる |

## 4. 見送り

| 名称 | 理由 |
|---|---|
| Orca | 複数コーディングエージェントの並行管理ツール。ブラスト半径大(複数エージェントが並行でコード変更)、かつ自作のorchestratorパターンと機能重複 |
| OmniRoute | 231+ AIプロバイダを束ねるゲートウェイ。APIキー等の認証情報を一箇所に集約するためブラスト半径が最大。個人開発で実験的機能も多く保守リスクも高い |
| claude-video | Claudeに動画を「見せる」スキル。動画分析ニーズが今のところなく、YouTube文字起こしは既にGemini/NotebookLMで運用済みのため代替不要 |
| system_prompts_leaks | Claude自身のシステムプロンプト抽出物を扱うリポジトリのため、性質上棚卸し対象から除外 |

## 5. 外す候補

現時点では該当なし。ただし次回見直し時のチェックポイント:
- agent 3件（advisor/worker/verifier）: 実使用ゼロのまま3週間経過していたら要検討
- verifier: 使用が始まっても/verify・/code-reviewで足りているようなら統合を検討
