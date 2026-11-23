"use client";
import { useState } from "react";
import { CopyCommand } from "./CopyCommand";

export function QuickstartTabs({ tabs }: { tabs: Array<{ label: string; comment: string; cmd: string }> }) {
  const [i, setI] = useState(0);
  const t = tabs[i];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div role="tablist" aria-label="Examples" style={{ display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid var(--night-line)" }}>
        {tabs.map((x, j) => (
          <button key={x.label} type="button" role="tab" aria-selected={j === i} onClick={() => setI(j)} style={{ height: 44, padding: "0 14px", border: "none", borderBottom: `2px solid ${j === i ? "var(--teal-hi)" : "transparent"}`, background: "transparent", color: j === i ? "var(--snow)" : "var(--snow-3)", fontFamily: "var(--mono)", fontSize: 13, cursor: "pointer" }}>
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="mono" style={{ fontSize: 13, color: "#6E7A84" }}># {t.comment}</span>
        <CopyCommand command={t.cmd} dark />
      </div>
    </div>
  );
}
