import Anthropic from "@anthropic-ai/sdk";

// Telegram版（scripts/gbp-diag/README.md 手順2）と同じ判定をAnthropic APIで行う。
// モデルは分類・所見生成用途のためHaiku系（コスト重視・指示書8項）。
const MODEL = "claude-haiku-4-5";

const JUDGED_SCHEMA = {
  type: "object",
  properties: {
    reviewQuality: {
      type: "object",
      properties: {
        score: { anyOf: [{ type: "integer" }, { type: "null" }] },
        max: { type: "integer" },
        note: { type: "string" },
      },
      required: ["score", "max", "note"],
      additionalProperties: false,
    },
    primaryCategoryFit: {
      type: "object",
      properties: {
        score: { anyOf: [{ type: "integer" }, { type: "null" }] },
        max: { type: "integer" },
        note: { type: "string" },
      },
      required: ["score", "max", "note"],
      additionalProperties: false,
    },
    insight: { type: "string" },
    priorities: { type: "array", items: { type: "string" } },
    risk: { type: "string" },
  },
  required: ["reviewQuality", "primaryCategoryFit", "insight", "priorities", "risk"],
  additionalProperties: false,
} as const;

export type Judged = {
  reviewQuality: { score: number | null; max: number; note: string };
  primaryCategoryFit: { score: number | null; max: number; note: string };
  insight: string;
  priorities: string[];
  risk: string;
};

type PlaceData = {
  name: string;
  area: string;
  target: Record<string, unknown>;
  competitors: Record<string, unknown>[];
  mechanical: Record<string, unknown>;
};

function buildPrompt(data: PlaceData): string {
  const t = data.target as {
    displayName?: { text?: string };
    types?: string[];
    primaryType?: string;
    reviews?: {
      rating?: number;
      text?: { text?: string };
      publishTime?: string;
      relativePublishTimeDescription?: string;
    }[];
  };
  const reviews = (t.reviews || []).slice(0, 5).map((r) => ({
    rating: r.rating,
    text: r.text?.text?.slice(0, 500) || "",
    publishTime: r.publishTime,
    relative: r.relativePublishTimeDescription,
  }));
  const compTypes = data.competitors.map((c) => ({
    name: (c as { displayName?: { text?: string } }).displayName?.text,
    primaryType: (c as { primaryType?: string }).primaryType,
  }));

  return `あなたはGoogle Business Profile（GBP）診断ツールの採点担当です。採点基準は gbp-scoring-rules.md 準拠。以下のデータから2項目を採点し、所見等を生成してください。

## 採点対象
事業者: ${data.name}（${data.area}）
primaryType: ${t.primaryType || "不明"} / types: ${(t.types || []).join(", ")}

## レビュー（Places APIは最大5件のみ返す。この5件だけを根拠に判定し、noteにその旨を含める）
${JSON.stringify(reviews, null, 2)}

## 競合のカテゴリ（primaryCategoryFit判定の参考）
${JSON.stringify(compTypes, null, 2)}

## 機械採点済みの結果（insight/priorities/riskの材料）
${JSON.stringify(data.mechanical, null, 2)}

## 採点ルール
1. reviewQuality（クチコミ内容の質・max 10）: レビュー本文の具体性・好意度に加え、publishTime/relativeから直近レビューの有無・頻度（最近性）を根拠に含めて0-10点。レビューが0件なら score は null（判定不能）とし note に理由を明記。
2. primaryCategoryFit（主カテゴリの適切性・max 6）: primaryType/typesが業種として適切かを競合のカテゴリと比較して0-6点。判定不能なら null。
3. insight: 所見3〜5行（日本語）。機械採点＋上記判定を統合し、事実に基づいて書く。未取得データに基づく断定はしない。
4. priorities: 改善優先順位を効果の大きい順に3つ（配列）。
5. risk: 放置した場合の見通し（2〜3文）。

判定不能な場合は score: null とし、比例換算しない。`;
}

export async function judgeWithClaude(
  data: PlaceData
): Promise<{ judged: Judged; inputTokens: number; outputTokens: number; model: string }> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: { type: "json_schema", schema: JUDGED_SCHEMA },
    },
    messages: [{ role: "user", content: buildPrompt(data) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Claude判定が拒否されました");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude判定の応答にテキストがありません");
  }
  const judged = JSON.parse(textBlock.text) as Judged;
  judged.reviewQuality.max = 10;
  judged.primaryCategoryFit.max = 6;
  return {
    judged,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: MODEL,
  };
}
