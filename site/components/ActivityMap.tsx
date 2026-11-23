"use client";
import { useState } from "react";
import type { Scenario, Verdict } from "@/lib/facts";
import { VERDICT_LABEL } from "@/lib/facts";
import { STEP_LABELS, VERDICT_DARK, stepCode, succeededOf, verdictOf } from "./replay";

const NODES: Array<{ id: Scenario["node"]; label: string; y: number }> = [
  { id: "files", label: "Files", y: 40 },
  { id: "creds", label: "Credentials", y: 130 },
  { id: "tools", label: "Tools · MCP", y: 220 },
  { id: "shell", label: "Shell", y: 310 },
  { id: "out", label: "External services", y: 400 },
];

const STROKE: Record<Verdict, { color: string; width: number; dash?: string }> = {
  exposed: { color: "#F5B455", width: 3 },
  unknown: { color: "#A5B4FC", width: 2, dash: "7 4" },
  no: { color: "#56616B", width: 2, dash: "2 6" },
  none: { color: "#14B8A6", width: 2 },
};

/** The signature: one demo session, every call a path from the agent to what it reached for. */
export function ActivityMap({ scenarios }: { scenarios: Scenario[] }) {
  const [sel, setSel] = useState(0);
  const [step, setStep] = useState(0);
  const s = scenarios[sel];
  const v = verdictOf(s);

  // Several calls to the same place fan out a little so each path stays visible.
  const seen: Record<string, number> = {};
  const paths = scenarios.map((sc, i) => {
    const n = (seen[sc.node] = (seen[sc.node] ?? -1) + 1);
    const base = NODES.find((x) => x.id === sc.node)!.y + 28;
    const y = base + (n === 0 ? 0 : n % 2 ? 12 : -12) * Math.ceil(n / 2);
    return { i, d: `M180 220 C 380 220, 380 ${y}, 560 ${y}`, ...STROKE[verdictOf(sc)] };
  });

  const pick = (i: number) => { setSel(i); setStep(0); };
  const next = () => (step < 3 ? setStep(step + 1) : pick((sel + 1) % scenarios.length));
  const prev = () => pick((sel + scenarios.length - 1) % scenarios.length);
  const lit = (from: number) => (step >= from ? 1 : 0.32);

  return (
    <div className="dark" style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 40px 100px rgba(13,15,18,0.18)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: "1px solid var(--night-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 15 }}>Agent Activity Map</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--snow-3)" }}>demo session · {scenarios.length} tool calls · decided by the real rules</span>
        </div>
        <span className="tag-demo">DEMO SESSION · NOT YOUR DATA</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {/* the map */}
        <div style={{ flex: "1.7 1 640px", minWidth: 0, overflowX: "auto", padding: "28px 22px 18px", backgroundImage: "radial-gradient(#1A2128 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
          <div style={{ position: "relative", width: 760, height: 440, margin: "0 auto" }}>
            <svg width="760" height="440" viewBox="0 0 760 440" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
              {paths.map((p) => (
                <path key={p.i} d={p.d} fill="none" stroke={p.color} strokeWidth={p.width + (p.i === sel ? 1.5 : 0)} strokeDasharray={p.dash} strokeLinecap="round" opacity={p.i === sel ? 1 : 0.32} style={{ transition: "opacity .25s, stroke-width .25s" }} />
              ))}
            </svg>
            <div style={{ position: "absolute", left: 40, top: 180, width: 140, height: 80, borderRadius: 14, background: "#0F1F1D", border: "1.5px solid var(--teal-mid)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 16 }}>Agent</span>
              <span className="mono" style={{ fontSize: 11, color: "#5EEAD4" }}>{s.agent}</span>
            </div>
            {NODES.map((n) => {
              const on = n.id === s.node;
              return (
                <div key={n.id} style={{ position: "absolute", left: 560, top: n.y, width: 180, height: 56, borderRadius: 12, background: "var(--night-3)", border: `1px solid ${on ? VERDICT_DARK[v] : "var(--night-line-2)"}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", transition: "border-color .25s" }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: on ? VERDICT_DARK[v] : "#3A444D" }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{n.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 22px", marginTop: 10, fontSize: 11, color: "#9AA4AD" }}>
            {([["no", "failed · nothing reached it"], ["none", "succeeded · no event"], ["unknown", "unknown"], ["exposed", "exposed"]] as Array<[Verdict, string]>).map(([k, label]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="28" height="6" aria-hidden="true"><line x1="0" y1="3" x2="28" y2="3" stroke={STROKE[k].color} strokeWidth={STROKE[k].width} strokeDasharray={STROKE[k].dash} /></svg>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* calls + replay */}
        <div style={{ flex: "1 1 380px", minWidth: 0, borderLeft: "1px solid var(--night-line)", display: "flex", flexDirection: "column" }}>
          <div className="mono" style={{ padding: "16px 18px 8px", fontSize: 11, letterSpacing: "0.08em", color: "var(--snow-3)" }}>TOOL CALLS · PICK ONE</div>
          <div role="group" aria-label="Tool calls" style={{ display: "flex", flexDirection: "column", padding: "0 10px" }}>
            {scenarios.map((sc, i) => {
              const vv = verdictOf(sc);
              return (
                <button key={sc.id} type="button" onClick={() => pick(i)} aria-pressed={i === sel} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 46, padding: "8px 10px", border: "none", borderRadius: 8, background: i === sel ? "#16212A" : "transparent", color: "var(--snow)", textAlign: "left", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 13 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: STROKE[vv].color, flex: "none" }} />
                  <span style={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sc.call}</span>
                  <span style={{ fontSize: 11, color: VERDICT_DARK[vv] }}>{VERDICT_LABEL[vv]}</span>
                </button>
              );
            })}
          </div>

          <div style={{ margin: "14px 18px 20px", padding: 18, borderRadius: 12, background: "var(--night-3)", border: `1px solid ${VERDICT_DARK[v]}`, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <code style={{ fontSize: 14, wordBreak: "break-all" }}>{s.call}</code>
              <span className="mono" style={{ fontSize: 11, color: "#6E7A84", whiteSpace: "nowrap" }}>call {sel + 1} of {scenarios.length}</span>
            </div>
            <div role="tablist" aria-label="Replay steps" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 4 }}>
              {STEP_LABELS.map((l, i) => (
                <button key={l} type="button" role="tab" aria-selected={i === step} onClick={() => setStep(i)} style={{ minHeight: 44, padding: "6px 4px", borderRadius: 7, border: `1px solid ${i === step ? "var(--teal-mid)" : "var(--night-line-2)"}`, background: i === step ? "#11201F" : i < step ? "var(--night-2)" : "transparent", color: i <= step ? "var(--snow)" : "#6E7A84", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span>{i + 1}</span><span>{l}</span>
                </button>
              ))}
            </div>
            <div role="tabpanel" style={{ minHeight: 150, display: "flex", flexDirection: "column", gap: 10 }}>
              <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: "var(--night)", fontSize: 12, lineHeight: 1.6, color: "#D5DBE0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{stepCode(s, step)}</pre>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#D5DBE0" }}>{s.steps[step].evidence}</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--snow-3)" }}><span style={{ color: "var(--indigo-hi)" }}>Does not prove: </span>{s.steps[step].limit === "-" ? "—" : s.steps[step].limit}</p>
            </div>
            <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, fontSize: 11 }}>
              <div style={{ background: "var(--night)", borderRadius: 8, padding: 10 }}><div style={{ color: "#6E7A84" }}>ATTEMPTED</div><div style={{ marginTop: 5, fontSize: 14 }}>yes</div></div>
              <div style={{ background: "var(--night)", borderRadius: 8, padding: 10, opacity: lit(1), transition: "opacity .25s" }}><div style={{ color: "#6E7A84" }}>SUCCEEDED</div><div style={{ marginTop: 5, fontSize: 14 }}>{succeededOf(s)}</div></div>
              <div style={{ background: "var(--night)", borderRadius: 8, padding: 10, opacity: lit(3), transition: "opacity .25s" }}><div style={{ color: "#6E7A84" }}>EXPOSED</div><div style={{ marginTop: 5, fontSize: 14, color: VERDICT_DARK[v] }}>{VERDICT_LABEL[v].toLowerCase()}</div></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <button type="button" onClick={prev} className="btn btn-ghost" style={{ fontSize: 13 }}>← Previous call</button>
              <button type="button" onClick={next} className="btn btn-teal" style={{ fontSize: 13 }}>{step < 3 ? "Next step →" : "Next call →"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
