#!/usr/bin/env bash
set -euo pipefail

# ===== create-demo.sh =====
# 美容室デモサイト生成・GitHubデプロイスクリプト

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GITHUB_USER="indiandeathrock-boop"
GITHUB_REPO="local-biz-demos"
DEPLOY_BASE="https://local-biz-demos.indiandeathrock.workers.dev"

# ----- デフォルト値 -----
TYPE="beauty-salon"
NAME=""
CATCH=""
TEL=""
ADDRESS=""
HOURS=""
HOLIDAY=""
S1="カット"
S2="カラー"
S3="パーマ"
S4="トリートメント"
SLUG=""
EMAIL=""
MAP_EMBED_URL=""
MAP_URL=""
INSTAGRAM_URL=""
X_URL=""
TIKTOK_URL=""
R1_NAME="" R1_RATING="5" R1_TEXT=""
R2_NAME="" R2_RATING="5" R2_TEXT=""
R3_NAME="" R3_RATING="5" R3_TEXT=""
FAQ1_Q="" FAQ1_A=""
FAQ2_Q="" FAQ2_A=""
FAQ3_Q="" FAQ3_A=""

# ----- 引数パース -----
while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)        TYPE="$2";         shift 2 ;;
    --name)        NAME="$2";         shift 2 ;;
    --catch)       CATCH="$2";        shift 2 ;;
    --tel)         TEL="$2";          shift 2 ;;
    --address)     ADDRESS="$2";      shift 2 ;;
    --hours)       HOURS="$2";        shift 2 ;;
    --holiday)     HOLIDAY="$2";      shift 2 ;;
    --service1)    S1="$2";           shift 2 ;;
    --service2)    S2="$2";           shift 2 ;;
    --service3)    S3="$2";           shift 2 ;;
    --service4)    S4="$2";           shift 2 ;;
    --slug)        SLUG="$2";         shift 2 ;;
    --email)       EMAIL="$2";        shift 2 ;;
    --map-embed)   MAP_EMBED_URL="$2"; shift 2 ;;
    --map-url)     MAP_URL="$2";      shift 2 ;;
    --instagram)   INSTAGRAM_URL="$2"; shift 2 ;;
    --x-url)       X_URL="$2";        shift 2 ;;
    --tiktok)      TIKTOK_URL="$2";   shift 2 ;;
    --r1-name)     R1_NAME="$2";      shift 2 ;;
    --r1-rating)   R1_RATING="$2";    shift 2 ;;
    --r1-text)     R1_TEXT="$2";      shift 2 ;;
    --r2-name)     R2_NAME="$2";      shift 2 ;;
    --r2-rating)   R2_RATING="$2";    shift 2 ;;
    --r2-text)     R2_TEXT="$2";      shift 2 ;;
    --r3-name)     R3_NAME="$2";      shift 2 ;;
    --r3-rating)   R3_RATING="$2";    shift 2 ;;
    --r3-text)     R3_TEXT="$2";      shift 2 ;;
    --faq1-q)      FAQ1_Q="$2";       shift 2 ;;
    --faq1-a)      FAQ1_A="$2";       shift 2 ;;
    --faq2-q)      FAQ2_Q="$2";       shift 2 ;;
    --faq2-a)      FAQ2_A="$2";       shift 2 ;;
    --faq3-q)      FAQ3_Q="$2";       shift 2 ;;
    --faq3-a)      FAQ3_A="$2";       shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ----- バリデーション -----
if [[ -z "$NAME" || -z "$SLUG" ]]; then
  echo "ERROR: --name と --slug は必須です" >&2
  exit 1
fi

TEMPLATE="$REPO_ROOT/demos/$TYPE/index.html"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: テンプレートが見つかりません: $TEMPLATE" >&2
  exit 1
fi

TOKEN="${GITHUB_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  TOKEN=$(grep 'GITHUB_TOKEN' ~/.zshrc 2>/dev/null | head -1 | sed 's/.*"\(.*\)"/\1/')
fi
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: GITHUB_TOKEN が設定されていません" >&2
  exit 1
fi

# ----- sed用エスケープ関数（/と&と\を処理）-----
esc() { printf '%s' "$1" | sed 's/[\/&]/\\&/g'; }

# ----- 変数置換 -----
OUT_DIR="$REPO_ROOT/demos/clients/$SLUG"
OUT_FILE="$OUT_DIR/index.html"
mkdir -p "$OUT_DIR"

sed \
  -e "s/{{店名}}/$(esc "$NAME")/g" \
  -e "s/{{キャッチコピー}}/$(esc "$CATCH")/g" \
  -e "s/{{電話番号}}/$(esc "$TEL")/g" \
  -e "s/{{住所}}/$(esc "$ADDRESS")/g" \
  -e "s/{{営業時間}}/$(esc "$HOURS")/g" \
  -e "s/{{定休日}}/$(esc "$HOLIDAY")/g" \
  -e "s/{{サービス1}}/$(esc "$S1")/g" \
  -e "s/{{サービス2}}/$(esc "$S2")/g" \
  -e "s/{{サービス3}}/$(esc "$S3")/g" \
  -e "s/{{サービス4}}/$(esc "$S4")/g" \
  -e "s/{{メールアドレス}}/$(esc "$EMAIL")/g" \
  -e "s/{{Google_Maps_Embed_URL}}/$(esc "$MAP_EMBED_URL")/g" \
  -e "s/{{Google_Maps_URL}}/$(esc "$MAP_URL")/g" \
  -e "s/{{Instagram_URL}}/$(esc "$INSTAGRAM_URL")/g" \
  -e "s/{{X_URL}}/$(esc "$X_URL")/g" \
  -e "s/{{TikTok_URL}}/$(esc "$TIKTOK_URL")/g" \
  -e "s/{{レビュー1_名前}}/$(esc "$R1_NAME")/g" \
  -e "s/{{レビュー1_評価}}/$(esc "$R1_RATING")/g" \
  -e "s/{{レビュー1_テキスト}}/$(esc "$R1_TEXT")/g" \
  -e "s/{{レビュー2_名前}}/$(esc "$R2_NAME")/g" \
  -e "s/{{レビュー2_評価}}/$(esc "$R2_RATING")/g" \
  -e "s/{{レビュー2_テキスト}}/$(esc "$R2_TEXT")/g" \
  -e "s/{{レビュー3_名前}}/$(esc "$R3_NAME")/g" \
  -e "s/{{レビュー3_評価}}/$(esc "$R3_RATING")/g" \
  -e "s/{{レビュー3_テキスト}}/$(esc "$R3_TEXT")/g" \
  -e "s/{{FAQ1_Q}}/$(esc "$FAQ1_Q")/g" \
  -e "s/{{FAQ1_A}}/$(esc "$FAQ1_A")/g" \
  -e "s/{{FAQ2_Q}}/$(esc "$FAQ2_Q")/g" \
  -e "s/{{FAQ2_A}}/$(esc "$FAQ2_A")/g" \
  -e "s/{{FAQ3_Q}}/$(esc "$FAQ3_Q")/g" \
  -e "s/{{FAQ3_A}}/$(esc "$FAQ3_A")/g" \
  "$TEMPLATE" > "$OUT_FILE"

echo "✅ 生成完了: $OUT_FILE"

# ----- GitHub Push -----
GITHUB_PATH="demos/clients/$SLUG/index.html"
CONTENT=$(base64 < "$OUT_FILE")
COMMIT_MSG="Add demo: $NAME ($SLUG)"

echo "🚀 GitHubにpush中..."

EXISTING=$(curl -s \
  -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$GITHUB_USER/$GITHUB_REPO/contents/$GITHUB_PATH")
SHA=$(echo "$EXISTING" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sha',''))" 2>/dev/null || echo "")

if [[ -n "$SHA" ]]; then
  PAYLOAD="{\"message\":\"$COMMIT_MSG\",\"content\":\"$CONTENT\",\"sha\":\"$SHA\"}"
else
  PAYLOAD="{\"message\":\"$COMMIT_MSG\",\"content\":\"$CONTENT\"}"
fi

RESULT=$(curl -s -X PUT \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/$GITHUB_USER/$GITHUB_REPO/contents/$GITHUB_PATH" \
  -d "$PAYLOAD")

GITHUB_URL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('content',{}); print(r.get('html_url','') if r else 'ERROR: '+str(d.get('message','')))" 2>/dev/null)

if [[ "$GITHUB_URL" == ERROR* ]]; then
  echo "❌ GitHub push失敗: $GITHUB_URL" >&2
  exit 1
fi

echo "✅ GitHub push完了: $GITHUB_URL"

# ----- デプロイURL -----
DEPLOY_URL="$DEPLOY_BASE/demos/clients/$SLUG/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 デプロイURL（Cloudflare自動反映 ~1分）:"
echo "   $DEPLOY_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
