import { combineScores, COMPETITOR_RADIUS_METERS, type ScoreItem } from "gbp-core";
import { supabase } from "./supabase";
import type { Judged } from "./judge";
import { scoreHuman, type HumanAnswers } from "./human-items";

export const ITEM_LABELS: Record<string, string> = {
  reviewCountRelative: "クチコミ数（競合相対）",
  basicInfo: "基本情報の完備",
  ratingRelative: "評価（星）",
  reviewQuality: "クチコミ内容の質",
  primaryCategoryFit: "主カテゴリの適切性",
  additionalCategoryPresence: "追加カテゴリの有無",
  photoVolume: "写真の量",
  productsAttributes: "商品・サービス・属性の登録",
};

// 人間診断の項目一覧（自動診断レポートに「要確認」として掲載。render.jsと同一）
export const HUMAN_OVERVIEW: [string, number][] = [
  ["投稿の頻度と質（月4回目安・APSORA構成・誘導ボタン）", 20],
  ["クチコミ返信（全件返信・低評価対応の作法）", 20],
  ["写真の質（カバー・ロゴ・多様性・不安解消の構図）", 15],
  ["説明文・商品説明の訴求力（お客様主語・具体性）", 15],
  ["アカウント体制（オーナー確認・複数人管理・動画認証対応）", 10],
  ["インサイト分析（検索語句・ルート検索の定期確認）", 10],
  ["外部連携（自社HP充実・SNS連携・ローカルSEO）", 10],
];

export const COMPETITOR_RADIUS_KM = COMPETITOR_RADIUS_METERS / 1000;

export type CompetitorScope = {
  mode: "town" | "radius-fallback";
  townName: string | null;
  locality: string | null;
  radiusUsed: number;
  sameTownCount: number;
};

/**
 * 競合母集団の注記文（採点基準3-6: 母集団の前提を必ず明記する）。
 * 2026-07-14の町名スコープ化以降のデータはcompetitorScopeを持つ。
 * それ以前の保存データ（半径3km固定時代）は従来文言にフォールバックする。
 */
export function competitorScopeNote(
  scope: CompetitorScope | undefined,
  competitorCount: number
): string {
  if (scope?.mode === "town" && scope.townName) {
    const km = scope.radiusUsed / 1000;
    return `※競合は対象事業者と同じ町名「${scope.townName}」の同業種を最優先し、不足分を半径${km}km圏内の近隣同業種で補完した${competitorCount}社です（エリア内の全事業者数ではありません）`;
  }
  const base = `※対象事業者から半径${COMPETITOR_RADIUS_KM}km圏内でGoogleマップ上位表示される同業種${competitorCount}社との比較です（エリア内の全事業者数ではありません）`;
  if (scope?.mode === "radius-fallback") {
    return `${base}（町名スコープ不可のため半径${COMPETITOR_RADIUS_KM}km方式で算出）`;
  }
  return base;
}

export type Place = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
};

export type DiagnosisRow = {
  id: string;
  business_name: string;
  area: string;
  created_at: string;
  data: {
    target: Place & Record<string, unknown>;
    competitors: (Place & Record<string, unknown>)[];
    mechanical: Record<string, ScoreItem>;
    apiCallCount?: number;
    competitorScope?: CompetitorScope;
  };
  judged: Judged;
  human: (HumanAnswers & { finalized?: boolean; updatedAt?: string }) | null;
  total_score: number | null;
};

export async function fetchDiagnosis(id: string): Promise<DiagnosisRow | null> {
  const { data, error } = await supabase().from("diagnoses").select("*").eq("id", id).single();
  if (error) return null;
  return data as DiagnosisRow;
}

export function autoScore(row: DiagnosisRow) {
  return combineScores(row.data.mechanical, {
    reviewQuality: row.judged.reviewQuality,
    primaryCategoryFit: row.judged.primaryCategoryFit,
  });
}

/** クチコミ数のエリア内順位（render.jsと同じ: userRatingCount降順） */
export function reviewCountRank(row: DiagnosisRow) {
  const all = [row.data.target, ...row.data.competitors].filter(
    (p) => typeof p.userRatingCount === "number"
  );
  const sorted = [...all].sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0));
  const rank = sorted.findIndex((p) => p === row.data.target) + 1;
  return { rank: rank || null, total: all.length };
}

/** 総合スコア（人間診断確定後のみ）。満点は常に100点、総合は平均（確定ルール） */
export function combinedTotal(row: DiagnosisRow): number | null {
  if (!row.human?.finalized) return null;
  const auto = autoScore(row);
  const human = scoreHuman(row.human);
  return Math.round(((auto.earned + human.total) / 2) * 10) / 10;
}
