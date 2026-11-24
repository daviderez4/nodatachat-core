"use client";
import { useState } from "react";
import type { WebScenario } from "@/lib/facts";
import { CopyCommand } from "./CopyCommand";

/** One scenario at a time: the attack, the session, what the check records, what it cannot prove. */
export function AgenticWeb({ scenarios }: { scenarios: WebScenario[] }) {
  const [sel, setSel] = useState(0);
  const s = scenarios[sel];
  const recorded = s.calls.filter((c) => c.decided.length).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div role="tablist" aria-label="Scenarios" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
        {scenarios.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === sel} onClick={() => setSel(i)} style={{ textAlign: "left", minHeight: 64, padding: "12px 14px", borderRadius: 10, border: `1px solid ${i === sel ? "var(--ink)" : "var(--line-2)"}`, background: i === sel ? "var(--ink)" : "var(--card)", color: i === sel ? "var(--paper)" : "var(--ink)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{x.title}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {/* the attack */}
        <div style={{ flex: "1 1 340px", minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>WHAT HAPPENS</span>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 15, lineHeight: 1.5 }}>
            {s.attack.map((a) => <li key={a}>{a}</li>)}
          </ol>
        </div>

        {/* the session */}
        <figure className="dark" style={{ flex: "1.6 1 520px", minWidth: 0, margin: 0, borderRadius: 14, overflow: "hidden" }}>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--night-line)", fontSize: 11, color: "var(--snow-3)" }}>
            <span>~/.claude/projects/…/session.jsonl</span><span>simulated · example domains</span>
          </div>
          <pre style={{ margin: 0, padding: 16, fontSize: 11.5, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#D5DBE0", maxHeight: 320, overflowY: "auto" }}>
            {s.logDisplay.map((l, i) => <span key={i} style={{ display: "block", color: i % 2 === 0 ? "#5EEAD4" : "#B4BDC5" }}>{l}</span>)}
          </pre>
        </figure>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {/* what agent-check records */}
        <div style={{ flex: "1 1 360px", minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>WHAT AGENT-CHECK RECORDS</span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            {recorded === 0 ? <><strong>Nothing.</strong> None of these calls is in a category the check counts.</> : <><strong>{recorded} of {s.calls.length} calls.</strong> Only the effect, not what caused it.</>}
          </p>
          {s.calls.map((c) => (
            <div key={c.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, minHeight: 40, padding: "6px 12px", borderRadius: 8, background: "#f6f5f1" }}>
              <code style={{ fontSize: 12, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</code>
              <span className="mono" style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", color: c.decided.length ? "var(--indigo)" : "var(--faint)" }}>
                {c.decided.length ? c.decided.map((e) => `${e.category} · ${e.exposed}`).join(", ") : "no event"}
              </span>
            </div>
          ))}
          <span style={{ fontSize: 12, color: "var(--faint)" }}>Decided at build time by the published rules.</span>
        </div>

        {/* what the transcript holds + check */}
        <div style={{ flex: "1 1 360px", minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>WHAT YOUR HISTORY STILL HOLDS</span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{s.transcript}</p>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)", marginTop: 4 }}>LOOK FOR IT YOURSELF</span>
          <CopyCommand command={s.check} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>{s.checkNote} For Codex, search <code>~/.codex/sessions</code> the same way.</p>
        </div>

        {/* what it cannot prove */}
        <div style={{ flex: "1 1 300px", minWidth: 0, background: "var(--paper-2)", border: "1px dashed var(--line-2)", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>WHAT IT CANNOT PROVE</span>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)" }}>
            {s.limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
