import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  fetchDiagnosis,
  autoScore,
  reviewCountRank,
  ITEM_LABELS,
  COMPETITOR_RADIUS_KM,
  competitorScopeNote,
  displayNote,
  type DiagnosisRow,
} from "@/lib/diag";
import { scoreHuman, HUMAN_SECTIONS, EXTRA_MEMOS } from "@/lib/human-items";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

// ブラウザの印刷/PDF保存ダイアログは document.title をデフォルトファイル名に使うため、
// 会社名ベースの名前にする（2026-07-06追加）。
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

// 強み/弱みの判定しきい値（得点率）。判定不能は対象外
const STRONG = 0.7;
const WEAK = 0.45;

function collectStrengthsWeaknesses(row: DiagnosisRow, human: ReturnType<typeof scoreHuman>) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const auto = autoScore(row);
  for (const [key, item] of Object.entries(auto.items)) {
    if (item.score === null) continue;
    const ratio = item.score / item.max;
    const label = `${ITEM_LABELS[key] || key}（ファーストチェック ${item.score}/${item.max}）`;
    if (ratio >= STRONG) strengths.push(label);
    else if (ratio <= WEAK) weaknesses.push(label);
  }
  for (const r of human.results) {
    if (r.effectiveMax === 0) continue;
    const ratio = r.score / r.effectiveMax;
    const label = `${r.section.title.replace(/^\d+\.\s*/, "")}（パーソナルインサイト ${r.score}/${r.effectiveMax}）`;
    if (ratio >= STRONG) strengths.push(label);
    else if (ratio <= WEAK) weaknesses.push(label);
  }
  return { strengths, weaknesses };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await fetchDiagnosis(id);
  if (!row) notFound();
  if (!row.human?.finalized) redirect(`/d/${id}/human`);

  const auto = autoScore(row);
  const human = scoreHuman(row.human);
  const total = row.total_score ?? Math.round(((auto.earned + human.total) / 2) * 10) / 10;
  const { rank, total: rankTotal } = reviewCountRank(row);
  const { strengths, weaknesses } = collectStrengthsWeaknesses(row, human);

  const unjudgedAuto = Object.entries(auto.items)
    .filter(([, v]) => v.score === null)
    .map(([k]) => ITEM_LABELS[k] || k);
  const naHuman = human.results
    .filter((r) => r.naApplied)
    .map((r) => r.section.title.replace(/^\d+\.\s*/, ""));

  const priorities = row.judged.priorities || [];
  const timeline: { title: string; items: string[] }[] = [
    { title: "すぐやる", items: priorities.slice(0, 1) },
    { title: "30日以内", items: priorities.slice(1, 2) },
    { title: "90日以内", items: priorities.slice(2) },
  ];

  const extraMemos = EXTRA_MEMOS.map((label, i) => ({
    label,
    value: row.human?.memos?.[`extra-${i}`] || "",
  })).filter((m) => m.value.trim());

  return (
    <div className="wrap">
      <header className="page">
        <div className="date">
          診断日: {new Date(row.created_at).toLocaleDateString("ja-JP")} ／ パーソナルインサイト:{" "}
          {row.human.updatedAt ? new Date(row.human.updatedAt).toLocaleDateString("ja-JP") : "-"}
        </div>
        <h1>{row.business_name} — GBP総合診断レポート</h1>
        <div className="total-score-line">
          <span className="total-score-num">{total}</span>
          <span className="total-score-denom">/ 100点（総合スコア）</span>
        </div>
        <div className="breakdown">
          <span>ファーストチェック: {auto.earned} / {auto.possible}点</span>
          <span>
            パーソナルインサイト: {human.total} / {human.effectiveMax}点
            {human.hasNa ? "（判定不能分を除外した満点）" : ""}
          </span>
        </div>
        <p className="score-explain">総合スコア =（ファーストチェック + パーソナルインサイト）÷ 2。満点は常に100点。</p>
        {(unjudgedAuto.length > 0 || naHuman.length > 0) && (
          <p className="unjudged-note">
            判定不能項目:{" "}
            {[...unjudgedAuto.map((s) => `${s}（ファーストチェック）`), ...naHuman.map((s) => `${s}（パーソナルインサイト）`)].join("、")}
            ※比例換算・0点混入はしていません
          </p>
        )}
      </header>

      <section>
        <h2>エリア内での立ち位置（クチコミ数）</h2>
        <div className="rank-line">
          <span className="rank-num">{rank ?? "—"}</span> 位 / {rankTotal}社中（{row.area}エリア）
        </div>
        <div className="rank-note">
          {competitorScopeNote(row.data.competitorScope, row.data.competitors.length)}
        </div>
      </section>

      <section>
        <h2>ファーストチェックの内訳</h2>
        <table className="score">
          <tbody>
            {Object.entries(auto.items).map(([key, item]) => (
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
        <h2>パーソナルインサイトの内訳</h2>
        <table className="score">
          <tbody>
            {human.results.map((r) => (
              <tr key={r.section.id}>
                <td>
                  {r.section.title}
                  {r.naApplied && <div className="note">判定不能分（{r.section.na?.label}）を満点から除外</div>}
                </td>
                <td className="pts">
                  {r.score} / {r.effectiveMax}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>
                合計（Part1 {human.part1Score}/{human.part1Max} + Part2 {human.part2Score}/{human.part2Max}）
              </td>
              <td className="pts">
                {human.total} / {human.effectiveMax}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>強み／弱みの整理</h2>
        <div className="sw-grid">
          <div className="sw-box strength">
            <h4>強み（得点率{STRONG * 100}%以上）</h4>
            {strengths.length ? (
              <ul>{strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            ) : (
              <p style={{ margin: 0 }}>該当なし</p>
            )}
          </div>
          <div className="sw-box weakness">
            <h4>弱み（得点率{WEAK * 100}%以下）</h4>
            {weaknesses.length ? (
              <ul>{weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
            ) : (
              <p style={{ margin: 0 }}>該当なし</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2>今後の対策（時間軸）</h2>
        {timeline.map(
          (block) =>
            block.items.length > 0 && (
              <div className="timeline-block" key={block.title}>
                <h4>{block.title}</h4>
                <ul>
                  {block.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            )
        )}
        <p className="score-explain">※ファーストチェックの改善優先順位（効果の大きい順）を時間軸に展開。</p>
      </section>

      <section>
        <h2>所見</h2>
        <div className="insight-box">{row.judged.insight}</div>
      </section>

      <section>
        <h2>放置した場合の見通し</h2>
        <div className="risk-box">{row.judged.risk}</div>
      </section>

      {extraMemos.length > 0 && (
        <section>
          <h2>採点外メモ（改善提案の材料）</h2>
          <table className="score">
            <tbody>
              {extraMemos.map((m, i) => (
                <tr key={i}>
                  <td>
                    {m.label}
                    <div className="note" style={{ whiteSpace: "pre-wrap" }}>{m.value}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div style={{ marginTop: 32, display: "flex", gap: 10, flexWrap: "wrap" }} className="no-print">
        <PrintButton />
        <Link className="btn btn-secondary" href={`/d/${row.id}`}>
          ファーストチェック結果へ
        </Link>
        <Link className="btn btn-secondary" href={`/d/${row.id}/human`}>
          パーソナルインサイトを修正
        </Link>
        <Link className="btn btn-secondary" href="/">
          一覧へ
        </Link>
      </div>

      <footer className="page">
        Google Business Profile 公開情報（Google Places API）＋現地確認・ヒアリングをもとに作成。取得競合数:{" "}
        {row.data.competitors.length}社（
        {row.data.competitorScope?.mode === "town"
          ? `町名「${row.data.competitorScope.townName}」優先・半径${row.data.competitorScope.radiusUsed / 1000}km圏`
          : `対象事業者から半径${COMPETITOR_RADIUS_KM}km以内`}
        、Nearby Search上位{row.data.competitors.length}件）。
      </footer>
    </div>
  );
}
