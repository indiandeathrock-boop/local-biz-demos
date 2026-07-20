---
name: fable-migration-watchlist
description: fable-method下位モデル移植（2026-07-20完了）の観察待ち3項目と分析レポートの所在
metadata: 
  node_type: memory
  type: project
  originSessionId: 19d0a36e-d447-4f72-ba07-c57e246d59e3
---

fable-methodの下位モデル向け具体化とCLAUDE.mdモデル分業既定の反転は2026-07-20に適用済み。
分析・検証レポートは `~/reports/fable-migration/`（gap-analysis.md / verification.md）。
git管理外なので消さないこと。

通常運用の中で観察して verification.md に追記する項目:
1. バグ発見時のデバッグの型（method.md §3＋§8）が実バグ入りタスクで踏まれるか
2. fable-methodが明示指示なしで自然発火するか（次回セッションで指示せず観察）
3. 着手宣言（ゴール一文）が対話タスクで出るか（サブエージェント経由では観察不能）

D-1（hookによる規律の物理強制層）は未実装・スコープ外。導入判断はOpus以上のメインで行う（CLAUDE.mdに記録済み）。
