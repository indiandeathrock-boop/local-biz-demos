"use client";

export default function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()}>
      印刷 / PDF保存
    </button>
  );
}
