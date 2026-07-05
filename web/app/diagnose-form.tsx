"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DiagnoseForm() {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // 二重実行防止
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, area }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "診断に失敗しました");
        setBusy(false);
        return;
      }
      router.push(`/d/${json.id}`);
    } catch {
      setError("通信エラーが発生しました");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <p style={{ fontSize: 16, fontWeight: 700 }}>分析中…</p>
        <p className="score-explain">
          Googleマップのデータ取得 → 採点 → 所見生成を行っています（30秒〜1分程度）
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="biz">事業者名</label>
        <input id="biz" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: アルドマーニ" />
      </div>
      <div className="field">
        <label htmlFor="area">エリア</label>
        <input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="例: 松戸" />
      </div>
      {error && <p className="error-note">{error}</p>}
      <button className="btn" type="submit" disabled={!name || !area}>
        診断する
      </button>
    </form>
  );
}
