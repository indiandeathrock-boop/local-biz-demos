import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DiagnoseForm from "./diagnose-form";

export const dynamic = "force-dynamic";

type ListRow = {
  id: string;
  business_name: string;
  area: string;
  created_at: string;
  human: { finalized?: boolean } | null;
  total_score: number | null;
};

export default async function HomePage() {
  const { data: rows, error } = await supabase()
    .from("diagnoses")
    .select("id, business_name, area, created_at, human, total_score")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="wrap">
      <header className="page">
        <h1>GBP診断ツール</h1>
        <p className="score-explain">
          ファーストチェック100点＋パーソナルインサイト100点の2部構成。総合スコアは両者の平均。
        </p>
      </header>

      <h2>新規診断</h2>
      <DiagnoseForm />

      <h2>診断履歴</h2>
      {error && <p className="error-note">履歴の取得に失敗しました: {error.message}</p>}
      {rows && rows.length === 0 && <p className="score-explain">まだ診断がありません。</p>}
      {(rows as ListRow[] | null)?.map((r) => {
        const humanDone = !!r.human?.finalized;
        const humanStarted = !!r.human && !humanDone;
        return (
          <Link key={r.id} href={`/d/${r.id}`} className="list-item">
            <span className="biz">{r.business_name}</span>
            {humanDone ? (
              <span className="tag done">総合 {r.total_score}点</span>
            ) : (
              <span className="tag pending">{humanStarted ? "パーソナルインサイト 入力中" : "パーソナルインサイト 未実施"}</span>
            )}
            <div className="meta">
              {r.area}エリア ／ {new Date(r.created_at).toLocaleString("ja-JP")}
            </div>
          </Link>
        );
      })}

      <footer className="page">
        Google Business Profile 公開情報（Google Places API）をもとに自動生成。
      </footer>
    </div>
  );
}
