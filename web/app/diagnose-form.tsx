"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DiagnoseForm() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
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
        body: JSON.stringify({ name, address }),
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
        <div className="spinner" aria-hidden="true" />
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
        <input id="biz" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 喫茶みほん堂" />
      </div>
      <div className="field">
        <label htmlFor="address">住所（競合の検索範囲は住所の町名から自動設定されます）</label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="例: 東京都中央区京橋9丁目99-9"
        />
      </div>
      {error && <p className="error-note">{error}</p>}
      <button className="btn" type="submit" disabled={!name || !address}>
        診断する
      </button>
    </form>
  );
}
