import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchDiagnosis, autoScore } from "@/lib/diag";
import { scoreHuman, type HumanAnswers } from "@/lib/human-items";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { answers: HumanAnswers; finalized: boolean };
  if (!body?.answers) {
    return Response.json({ error: "answers がありません" }, { status: 400 });
  }

  const row = await fetchDiagnosis(id);
  if (!row) {
    return Response.json({ error: "診断が見つかりません" }, { status: 404 });
  }

  const human = {
    ...body.answers,
    finalized: !!body.finalized,
    updatedAt: new Date().toISOString(),
  };

  // 総合スコア = (自動 + 人間) / 2。人間診断の点数は自動診断側の計算に混入させない（確定ルール）
  let total_score: number | null = null;
  if (human.finalized) {
    const auto = autoScore(row);
    const humanScore = scoreHuman(body.answers);
    if (!humanScore.complete) {
      return Response.json({ error: "未入力の項目があります" }, { status: 400 });
    }
    total_score = Math.round(((auto.earned + humanScore.total) / 2) * 10) / 10;
  }

  const { error } = await supabase()
    .from("diagnoses")
    .update({ human, total_score })
    .eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, total_score });
}
