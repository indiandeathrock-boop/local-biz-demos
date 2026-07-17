declare module "gbp-core" {
  export type ScoreItem = { score: number | null; max: number; note: string };

  export type CategoryResolution = {
    category: string | null;
    source:
      | "primaryType"
      | "types-fallback"
      | "generic-only"
      | "text-search-fallback"
      | "no-type-filter";
  };

  export type CompetitorScope = {
    mode: "town" | "radius-fallback";
    townName: string | null;
    locality: string | null;
    radiusUsed: number;
    sameTownCount: number;
  };

  export type AutoDiagnosisData = {
    name: string;
    area: string | null;
    address: string;
    generatedAt: string;
    target: Record<string, unknown>;
    competitors: Record<string, unknown>[];
    mechanical: Record<string, ScoreItem>;
    categoryResolution: CategoryResolution;
    competitorScope: CompetitorScope;
    apiCallCount: number;
  };

  export function runAutoDiagnosis(
    name: string,
    address: string,
    apiKey: string
  ): Promise<AutoDiagnosisData | null>;

  export function scoreMechanical(
    target: Record<string, unknown>,
    competitors: Record<string, unknown>[]
  ): Record<string, ScoreItem>;

  export function combineScores(
    mechanical: Record<string, ScoreItem>,
    judged: { reviewQuality: ScoreItem; primaryCategoryFit: ScoreItem }
  ): {
    items: Record<string, ScoreItem>;
    earned: number;
    possible: number;
    hasUnjudged: boolean;
  };

  export const COMPETITOR_RADIUS_METERS: number;
  export const COMPETITOR_RADIUS_STAGES: number[];
  export const PHOTO_CAP: number;

  export type DisplayCategory = { id: string; label: string };
  export function toDisplayCategories(typeIds: string[]): DisplayCategory[];
}
