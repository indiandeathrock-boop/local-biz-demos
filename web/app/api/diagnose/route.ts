import { NextRequest } from "next/server";
import { runAutoDiagnosis } from "gbp-core";
import { supabase } from "@/lib/supabase";
import { judgeWithClaude } from "@/lib/judge";

// Places API 10回 + Claude判定で数十秒かかり得るため延長
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { name, address } = await request.json();
  if (!name || !address) {
    return Response.json({ error: "事業者名と住所を入力してください" }, { status: 400 });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GOOGLE_PLACES_API_KEY が未設定です" }, { status: 500 });
  }

  const data = await runAutoDiagnosis(name, address, apiKey);
  if (!data) {
    return Response.json(
      { error: `事業者が見つかりませんでした: ${name}（${address}）` },
      { status: 404 }
    );
  }

  const { judged, inputTokens, outputTokens, model } = await judgeWithClaude(
    data as Parameters<typeof judgeWithClaude>[0]
  );

  const db = supabase();
  // areaカラムには町名スコープのラベル（例: 台東区千束）を格納する（2026-07-14エリア入力廃止）
  const { data: row, error } = await db
    .from("diagnoses")
    .insert({ business_name: name, area: (data as { area?: string | null }).area ?? address, data, judged })
    .select("id")
    .single();
  if (error) {
    return Response.json({ error: `保存に失敗しました: ${error.message}` }, { status: 500 });
  }

  await db.from("diagnosis_logs").insert({
    diagnosis_id: row.id,
    places_api_calls: (data as { apiCallCount?: number }).apiCallCount ?? 0,
    anthropic_input_tokens: inputTokens,
    anthropic_output_tokens: outputTokens,
    model,
  });

  return Response.json({ id: row.id });
}
