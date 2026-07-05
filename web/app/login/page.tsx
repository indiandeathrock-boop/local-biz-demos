"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("アクセスコードが違います");
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <header className="page">
        <h1>GBP診断ツール</h1>
      </header>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="code">アクセスコード</label>
          <input
            id="code"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="error-note">{error}</p>}
        <button className="btn" type="submit" disabled={busy || !code}>
          入る
        </button>
      </form>
    </div>
  );
}
