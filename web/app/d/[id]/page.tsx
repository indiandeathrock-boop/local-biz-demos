import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchDiagnosis,
  autoScore,
  reviewCountRank,
  ITEM_LABELS,
  HUMAN_OVERVIEW,
  COMPETITOR_RADIUS_KM,
  competitorScopeNote,
  displayNote,
  type DiagnosisRow,
} from "@/lib/diag";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await fetchDiagnosis(id);
  const safeName = (row?.business_name || "事業者").replace(/[\\/:*?"<>|]/g, "");
  return { title: `${safeName}_診断結果` };
}

function BarChart({ row }: { row: DiagnosisRow }) {
  const entries = [
    { name: row.data.target.displayName?.text || row.business_name, count: row.data.target.userRatingCount || 0, target: true },
    ...row.data.competitors.map((c) => ({
      name: c.displayName?.text || "(不明)",
      count: c.userRatingCount || 0,
      target: false,
    })),
  ].sort((a, b) => b.count - a.count);
  const max = Math.max(...entries.map((e) => e.count), 1);
  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} className={`bar-row${e.target ? " target" : ""}`}>
          <span className="name">{e.name}</span>
          <div className="bar" style={{ width: `${Math.max((e.count / max) * 100, 1)}%` }} />
          <span className="cnt">{e.count}件</span>
        </div>
      ))}
    </div>
  );
}

export default async function AutoResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await fetchDiagnosis(id);
  if (!row) notFound();

  const combined = autoScore(row);
  const { rank, total } = reviewCountRank(row);
  const items = combined.items;

  return (
    <div className="wrap">
      <header className="page">
        <div className="date">診断日: {new Date(row.created_at).toLocaleDateString("ja-JP")}</div>
        <h1>{row.business_name} — GBP診断レポート</h1>
        <div className="score-badge">
          ファーストチェック {combined.earned}点 ／ {combined.possible}点
        </div>
        {combined.hasUnjudged && (
          <div className="unjudged-note">※判定不能の項目があります（下表参照。比例換算はしていません）</div>
        )}
        <p className="score-explain">
          本診断は「ファーストチェック100点＋パーソナルインサイト100点」の2部構成で、両方完了後の平均値が最終スコアとなります。
        </p>
      </header>

      <section>
        <h2>エリア内順位（クチコミ数）</h2>
        <div className="rank-line">
          <span className="rank-num">{rank ?? "—"}</span> 位 / {total}社中（{row.area}エリア）
        </div>
        <div className="rank-note">
          {competitorScopeNote(row.data.competitorScope, row.data.competitors.length)}
        </div>
      </section>

      <section>
        <h2>クチコミ数の競合比較</h2>
        <BarChart row={row} />
      </section>

      <section>
        <h2>項目別採点</h2>
        <table className="score">
          <tbody>
            {Object.entries(items).map(([key, item]) => (
              <tr key={key}>
                <td>
                  {ITEM_LABELS[key] || key}
                  <div className="note">{displayNote(item.note)}</div>
                </td>
                <td className={`pts${item.score === null ? " na" : ""}`}>
                  {item.score === null ? "判定不能" : `${item.score} / ${item.max}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>所見</h2>
        <div className="insight-box">{row.judged.insight || "（未記入）"}</div>
      </section>

      <section>
        <h2>改善優先順位</h2>
        <ol className="priorities">
          {(row.judged.priorities || []).map((p, i) => (
            <li key={i}>
              <span className="num">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>要確認項目（パーソナルインサイト・現地確認/ヒアリングが必要）</h2>
        <p className="score-explain">以下はツールでは自動採点していません。現地確認・ヒアリングで採点します。</p>
        <table className="score">
          <tbody>
            {HUMAN_OVERVIEW.map(([label, max]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="pts na">/ {max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>放置した場合の見通し</h2>
        <div className="risk-box">{row.judged.risk || "（未記入）"}</div>
      </section>

      <div style={{ marginTop: 32, display: "flex", gap: 10, flexWrap: "wrap" }} className="no-print">
        <Link className="btn" href={`/d/${row.id}/human`}>
          {row.human ? (row.human.finalized ? "パーソナルインサイトを修正する" : "パーソナルインサイトの続きを入力") : "パーソナルインサイトを始める"}
        </Link>
        {row.human?.finalized && (
          <Link className="btn btn-secondary" href={`/d/${row.id}/report`}>
            総合診断レポートを見る
          </Link>
        )}
        <Link className="btn btn-secondary" href="/">
          一覧へ戻る
        </Link>
      </div>

      <footer className="page">
        Google Business Profile 公開情報（Google Places API）をもとに自動生成。取得競合数:{" "}
        {row.data.competitors.length}社（
        {row.data.competitorScope?.mode === "town"
          ? `町名「${row.data.competitorScope.townName}」優先・半径${row.data.competitorScope.radiusUsed / 1000}km圏`
          : `対象事業者から半径${COMPETITOR_RADIUS_KM}km以内`}
        、Nearby Search上位{row.data.competitors.length}件）。
      </footer>
    </div>
  );
}
