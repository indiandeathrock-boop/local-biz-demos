'use strict';

const { execFileSync } = require('child_process');

const SCORING_ITEMS = [
  'クチコミ数（競合相対）',
  '基本情報の完備',
  '評価（星）',
  'クチコミ内容の質',
  '主カテゴリの適切性',
  '追加カテゴリの有無',
  '写真の量',
  '商品・サービス・属性の登録',
  '投稿の頻度と質（月4回目安・APSORA構成・誘導ボタン）',
  'クチコミ返信（全件返信・低評価対応の作法）',
  '写真の質（カバー・ロゴ・多様性・不安解消の構図）',
  '説明文・商品説明の訴求力（お客様主語・具体性）',
  'アカウント体制（オーナー確認・複数人管理・動画認証対応）',
  'インサイト分析（検索語句・ルート検索の定期確認）',
  '外部連携（自社HP充実・SNS連携・ローカルSEO）',
];

function buildPrompt(article, maxChars) {
  return `あなたはGoogle Business Profile（GBP）診断ツールの採点基準メンテナンス担当です。
以下の記事が、GBP診断の採点基準に影響する「変化」を含むかを判定し、JSONのみを出力してください。

## 採点基準の項目一覧（affected_items はこの中から選ぶこと）
${SCORING_ITEMS.map((s) => `- ${s}`).join('\n')}

## 判定基準
relevant: true とするのは、GBPの機能・仕様・アルゴリズム・公式データに「変化」があった場合のみ:
- 機能の廃止・追加・仕様変更（例: Q&A機能廃止、動画認証導入）
- ランキングアルゴリズムの変更（例: Prominence→Popularityシフト）
- 施策効果に関する新しい調査データ（例: 写真枚数と問い合わせ数の相関調査の更新）

relevant: false とする例（変化を含まないもの）:
- 一般的なノウハウ・ハウツー記事（「GBPの登録方法」「クチコミを増やす5つの方法」等）
- ツール・サービスの宣伝記事
- 既知情報の再掲・まとめ記事（新規性がないもの）
- GBPと無関係な記事（一般SEO、広告等）

## 記事
タイトル: ${article.title}
URL: ${article.url}
本文（冒頭）: ${(article.content || '').slice(0, maxChars)}

## 出力形式（このJSONのみを出力。説明文・コードフェンス不要）
{
  "relevant": true/false,
  "affected_items": ["項目名", ...],
  "change_type": "機能廃止 | 機能追加 | アルゴリズム変更 | 効果データ更新 | その他",
  "summary": "変更内容の要約（日本語・3文以内）",
  "proposed_update": "採点基準ドキュメントの更新履歴に追記する1エントリとして成立する文面（日本語・出典に基づく事実のみ）",
  "confidence": "high | medium | low"
}
relevant: false の場合、affected_items は空配列、summary に無関係と判定した理由を1文で書く。`;
}

/** Claude CLI（ヘッドレス）で記事1件を分類する。失敗時は null を返す */
function classifyArticle(article, config) {
  const prompt = buildPrompt(article, config.maxContentCharsForClassify);
  let out;
  try {
    out = execFileSync(config.claudeBin, ['-p', '--model', config.claudeModel], {
      input: prompt,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
  } catch (e) {
    return { error: `claude実行失敗: ${e.message}` };
  }
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return { error: `JSON抽出失敗: ${out.slice(0, 200)}` };
  try {
    const j = JSON.parse(m[0]);
    return {
      relevant: j.relevant === true,
      affected_items: Array.isArray(j.affected_items) ? j.affected_items : [],
      change_type: j.change_type || 'その他',
      summary: j.summary || '',
      proposed_update: j.proposed_update || '',
      source_url: article.url,
      title: article.title,
      confidence: j.confidence || 'low',
    };
  } catch (e) {
    return { error: `JSONパース失敗: ${e.message}` };
  }
}

module.exports = { classifyArticle, SCORING_ITEMS };
