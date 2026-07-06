"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HUMAN_SECTIONS,
  EXTRA_MEMOS,
  EMPTY_ANSWERS,
  scoreHuman,
  scoreSection,
  type HumanAnswers,
  type Section,
  type SubItem,
} from "@/lib/human-items";

function SubItemView({
  sub,
  answers,
  onRadio,
  onCheck,
}: {
  sub: SubItem;
  answers: HumanAnswers;
  onRadio: (subId: string, idx: number) => void;
  onCheck: (subId: string, idx: number, itemCount: number) => void;
}) {
  if (sub.kind === "radio") {
    return (
      <div>
        <p className="qtext">
          {sub.title}
          {sub.followup && <span className="followup">{sub.followup}</span>}
        </p>
        <div className="opt-list">
          {sub.options.map((o, i) => (
            <label className="opt" key={i}>
              <input
                type="radio"
                name={sub.id}
                checked={answers.radios[sub.id] === i}
                onChange={() => onRadio(sub.id, i)}
              />
              <span className="opt-label">{o.label}</span>
              <span className="opt-pt">{o.pts}</span>
            </label>
          ))}
        </div>
        {sub.hint && <p className="hint">{sub.hint}</p>}
      </div>
    );
  }
  const checks = answers.checks[sub.id] || [];
  return (
    <div>
      <p className="qtext">{sub.title}</p>
      <div className="checklist">
        {sub.items.map((label, i) => (
          <label key={i}>
            <input
              type="checkbox"
              checked={!!checks[i]}
              onChange={() => onCheck(sub.id, i, sub.items.length)}
            />
            {label}
          </label>
        ))}
      </div>
      {sub.hint && <p className="hint">{sub.hint}</p>}
    </div>
  );
}

function SectionView({
  section,
  answers,
  onRadio,
  onCheck,
  onNa,
  onMemo,
}: {
  section: Section;
  answers: HumanAnswers;
  onRadio: (subId: string, idx: number) => void;
  onCheck: (subId: string, idx: number, itemCount: number) => void;
  onNa: (sectionId: string) => void;
  onMemo: (key: string, value: string) => void;
}) {
  const r = scoreSection(section, answers);
  const naOn = !!answers.naFlags[section.id];
  const naTargets = new Set(section.na?.targetSubIds || []);
  return (
    <section className="item">
      <div className="item-head">
        <h3>{section.title}</h3>
        <span className="item-score">
          {r.score}/{r.effectiveMax}
          {r.naApplied ? "（判定不能分あり）" : ""}
        </span>
      </div>
      {section.hint && <p className="hint" style={{ marginTop: -4 }}>{section.hint}</p>}
      {section.subs
        .filter((s) => !naTargets.has(s.id))
        .map((sub) => (
          <SubItemView key={sub.id} sub={sub} answers={answers} onRadio={onRadio} onCheck={onCheck} />
        ))}
      {section.na && (
        <>
          <div className="na-toggle">
            <label>
              <input type="checkbox" checked={naOn} onChange={() => onNa(section.id)} />
              {section.na.label}
            </label>
          </div>
          <div className={naOn ? "na-active" : ""}>
            {section.subs
              .filter((s) => naTargets.has(s.id))
              .map((sub) => (
                <SubItemView key={sub.id} sub={sub} answers={answers} onRadio={onRadio} onCheck={onCheck} />
              ))}
          </div>
        </>
      )}
      {section.memoPlaceholder && (
        <div className="memo-field">
          <textarea
            placeholder={section.memoPlaceholder}
            value={answers.memos[section.id] || ""}
            onChange={(e) => onMemo(section.id, e.target.value)}
          />
        </div>
      )}
    </section>
  );
}

export default function CheckSheet({
  diagnosisId,
  autoEarned,
  autoPossible,
  initial,
}: {
  diagnosisId: string;
  autoEarned: number;
  autoPossible: number;
  initial: HumanAnswers | null;
}) {
  const [answers, setAnswers] = useState<HumanAnswers>(initial ?? EMPTY_ANSWERS);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [finalizing, setFinalizing] = useState(false);
  const router = useRouter();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);
  latest.current = answers;

  const save = useCallback(
    async (finalized: boolean) => {
      setSaveState("saving");
      const res = await fetch(`/api/diagnosis/${diagnosisId}/human`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: latest.current, finalized }),
      });
      setSaveState(res.ok ? "saved" : "error");
      return res.ok;
    },
    [diagnosisId]
  );

  // 入力から2秒後に自動下書き保存（現地でブラウザが落ちても消えないように）
  const scheduleAutosave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(false), 2000);
  }, [save]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function update(fn: (prev: HumanAnswers) => HumanAnswers) {
    setAnswers((prev) => fn(prev));
    scheduleAutosave();
  }

  const onRadio = (subId: string, idx: number) =>
    update((p) => ({ ...p, radios: { ...p.radios, [subId]: idx } }));
  const onCheck = (subId: string, idx: number, itemCount: number) =>
    update((p) => {
      const arr = [...(p.checks[subId] || Array(itemCount).fill(false))];
      arr[idx] = !arr[idx];
      return { ...p, checks: { ...p.checks, [subId]: arr } };
    });
  const onNa = (sectionId: string) =>
    update((p) => ({ ...p, naFlags: { ...p.naFlags, [sectionId]: !p.naFlags[sectionId] } }));
  const onMemo = (key: string, value: string) =>
    update((p) => ({ ...p, memos: { ...p.memos, [key]: value } }));

  const totals = scoreHuman(answers);

  async function finalize() {
    setFinalizing(true);
    const ok = await save(true);
    if (ok) {
      router.push(`/d/${diagnosisId}/report`);
    } else {
      setFinalizing(false);
    }
  }

  return (
    <div className="pad-bottom">
      <div className="score-bar">
        <span className="auto-score">ファーストチェック {autoEarned}/{autoPossible}（確定）</span>
        <div className="score-total">
          パーソナルインサイト {totals.total}
          <span className="denom">/{totals.effectiveMax}</span>
        </div>
        <div className="score-sub">
          <span>Part1 チェック: {totals.part1Score}/{totals.part1Max}</span>
          <span>Part2 ヒアリング: {totals.part2Score}/{totals.part2Max}</span>
        </div>
      </div>

      <div className="wrap">
        <p className="score-explain">
          選択するだけで自動採点されます。「判定不能」を使った項目は集計から除外されます（0点にはなりません）。入力は自動保存されます。
        </p>

        <div className="part-title">Part 1 — チェックシート（外部観察・80点）</div>
        <p className="part-desc">事業者に会わずに、公開されているGBPページ・HP・SNSを見て記入できます。</p>
        {HUMAN_SECTIONS.filter((s) => s.part === 1).map((s) => (
          <SectionView key={s.id} section={s} answers={answers} onRadio={onRadio} onCheck={onCheck} onNa={onNa} onMemo={onMemo} />
        ))}

        <div className="part-title">Part 2 — ヒアリングシート（面談・20点）</div>
        <p className="part-desc">外からは見えない管理画面の中と運用実態を、面談で聞いて記入します。</p>
        {HUMAN_SECTIONS.filter((s) => s.part === 2).map((s) => (
          <SectionView key={s.id} section={s} answers={answers} onRadio={onRadio} onCheck={onCheck} onNa={onNa} onMemo={onMemo} />
        ))}

        <div className="part-title">採点外メモ（改善提案の材料）</div>
        <p className="part-desc">配点には含めないが、契約後の改善提案書に使う情報。</p>
        <section className="item">
          {EXTRA_MEMOS.map((placeholder, i) => (
            <div className="memo-field" key={i}>
              <textarea
                placeholder={placeholder}
                value={answers.memos[`extra-${i}`] || ""}
                onChange={(e) => onMemo(`extra-${i}`, e.target.value)}
              />
            </div>
          ))}
        </section>
      </div>

      <div className="action-bar">
        <span className="save-note">
          {saveState === "saving" && "保存中…"}
          {saveState === "saved" && "下書き保存済み"}
          {saveState === "error" && "保存エラー（通信を確認）"}
        </span>
        <button className="btn btn-secondary" onClick={() => save(false)} disabled={saveState === "saving"}>
          一時保存
        </button>
        <button className="btn" onClick={finalize} disabled={!totals.complete || finalizing}>
          総合診断結果を見る
        </button>
      </div>
    </div>
  );
}
