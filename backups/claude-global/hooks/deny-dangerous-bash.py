#!/usr/bin/env python3
"""PreToolUse hook: Bashコマンド全文をregex検査し、危険操作をブロックする。

settings.jsonのdenyルールはprefix一致のため、複合コマンド（cd x && rm -rf y）や
フラグ順の変形（rm -fr、git push -f）をすり抜ける。このhookが全文検査で補完する。
CLAUDE.md CRITICALルール（破壊的操作の事前確認、--no-verify禁止）の強制層。
"""
import json
import re
import sys

SAFE_RM_PREFIXES = ("/tmp/", "/private/tmp/")

def check(cmd: str):
    # rm -rf系: 再帰+強制フラグの組み合わせ。/tmp配下のみの操作は許可
    for m in re.finditer(r"\brm\s+((?:-{1,2}[\w-]+\s+)*)(.*?)(?=\||;|&&|$)", cmd):
        flags, targets = m.group(1), m.group(2)
        joined = flags + targets
        has_r = re.search(r"(^|\s)-\w*[rR]|--recursive", joined)
        has_f = re.search(r"(^|\s)-\w*f|--force", joined)
        if has_r and has_f:
            paths = re.findall(r"(?:^|\s)(/[^\s]*|~[^\s]*)", targets)
            if not paths or any(not p.startswith(SAFE_RM_PREFIXES) for p in paths):
                return "rm の再帰+強制削除。/tmp配下以外は禁止。RKに確認を取り、対象を限定した削除方法に変えること"

    if re.search(r"\bgit\s+push\b(?![\w-])(?!.*--force-with-lease)[^\n]*(\s--force\b|\s-f\b)", cmd):
        return "force pushは禁止。必要ならRKの確認を取り --force-with-lease を使うこと"

    if re.search(r"\bgit\s+commit\b[^\n]*(--no-verify\b|\s-n\b)", cmd):
        return "git commit --no-verify はCLAUDE.md CRITICAL #3で禁止。フックを迂回しない"

    if re.search(r"\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b", cmd, re.IGNORECASE):
        return "DROP/TRUNCATEは破壊的操作。実行前にRKの確認とバックアップ（CRITICAL #7）が必要"

    if re.search(r"\blaunchctl\s+(unload|remove|bootout)\b.*claude-telegram", cmd):
        return "claude-telegramのlaunchdジョブを外すとリモート操作経路が死ぬ。RKの明示指示なしに実行禁止"

    return None

def main():
    try:
        data = json.load(sys.stdin)
        cmd = data.get("tool_input", {}).get("command", "")
    except Exception:
        sys.exit(0)  # 入力不正時はブロックしない（permission層が最後の砦）

    reason = check(cmd)
    if reason:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }, ensure_ascii=False))
    sys.exit(0)

if __name__ == "__main__":
    main()
