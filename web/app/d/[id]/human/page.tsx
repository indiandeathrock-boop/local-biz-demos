import { notFound } from "next/navigation";
import { fetchDiagnosis, autoScore } from "@/lib/diag";
import CheckSheet from "./check-sheet";

export const dynamic = "force-dynamic";

export default async function HumanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await fetchDiagnosis(id);
  if (!row) notFound();
  const auto = autoScore(row);
  return (
    <CheckSheet
      diagnosisId={row.id}
      autoEarned={auto.earned}
      autoPossible={auto.possible}
      initial={row.human}
    />
  );
}
