declare module "gbp-core" {
  export type ScoreItem = { score: number | null; max: number; note: string };

  export type CategoryResolution = {
    category: string;
    source: "manual" | "primaryType" | "types-fallback" | "generic-only";
  };

  export type AutoDiagnosisData = {
    name: string;
    area: string;
    generatedAt: string;
    target: Record<string, unknown>;
    competitors: Record<string, unknown>[];
    mechanical: Record<string, ScoreItem>;
    categoryResolution: CategoryResolution;
    apiCallCount: number;
  };

  export function runAutoDiagnosis(
    name: string,
    area: string,
    apiKey: string,
    options?: { address?: string; categoryOverride?: string }
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
  export const PHOTO_CAP: number;
}
