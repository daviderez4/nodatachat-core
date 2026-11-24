"use client";
import { useState } from "react";
import type { Facts, Scenario } from "@/lib/facts";
import { VERDICT_LABEL } from "@/lib/facts";
import { STEP_LABELS, VERDICT_DARK, VERDICT_LIGHT, stepCode, succeededOf, verdictOf } from "./replay";

const REPO_SRC = "https://github.com/daviderez4/nodatachat-core/blob/main/packages/protect/src/";

/** Which source lines decided this scenario, matched by their text so they follow the code. */
function decidingLines(s: Scenario): string[] {
  if (!s.decided.length) return ["if (!cats.length) continue;"];
  const out: string[] = [];
  if (s.decided.some((e) => e.category === "provider_key")) out.push('cats.push({ category: "provider_key"');
  const v = verdictOf(s);
  if (v === "exposed") out.push('return "yes"', "const keyFound =");
  if (v === "no") out.push('return "no"');
  if (v === "unknown") out.push('return "unknown"');
  return out;
}

export function Lab({ scenarios, code, command }: { scenarios: Scenario[]; code: Facts["code"]; command: string }) {
  const [sel, setSel] = useState(0);
  const [step, setStep] = useState(0);
  const s = scenarios[sel];
  const v = verdictOf(s);
  const decided = step >= 3;
  const hits = decided ? decidingLines(s) : [];
  const isHit = (t: string) => hits.some((h) => t.includes(h));

  const pick = (i: number) => { setSel(i); setStep(0); };
  const next = () => (step < 3 ? setStep(step + 1) : pick((sel + 1) % scenarios.length));
  const back = () => (step > 0 ? setStep(step - 1) : (setSel((sel + scenarios.length - 1) % scenarios.length), setStep(3)));

  const state: Array<[string, string, string, boolean]> = [
    ["attempted", "yes", "var(--ink)", true],
    ["succeeded", succeededOf(s), "var(--teal)", step >= 1],
    ["what came back", s.returned.includes("sk_live_") ? "key-shaped value" : s.toolError ? "an error" : "content, no key pattern", "var(--ink)", step >= 2],
    ["decision", VERDICT_LABEL[v].toLowerCase(), VERDICT_LIGHT[v], decided],
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
      {/* scenario list */}
      <nav aria-label="Scenarios" style={{ flex: "1 1 280px", minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="mono" style={{ padding: "8px 10px", fontSize: 11, color: "var(--faint)" }}>SCENARIOS</span>
        {scenarios.map((x, i) => {
          const xv = verdictOf(x);
          const on = i === sel;
          return (
            <button key={x.id} type="button" onClick={() => pick(i)} aria-pressed={on} style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left", minHeight: 56, padding: "10px 12px", borderRadius: 9, border: `1px solid ${on ? "var(--ink)" : "transparent"}`, background: on ? "#f6f5f1" : "transparent", color: "var(--ink)", cursor: "pointer", fontSize: 14 }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{String(i + 1).padStart(2, "0")} · {x.agent}</span>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: VERDICT_LIGHT[xv], border: `1px solid ${VERDICT_LIGHT[xv]}`, borderRadius: 4, padding: "1px 6px" }}>{VERDICT_LABEL[xv]}</span>
              </span>
              <span style={{ fontWeight: 500, lineHeight: 1.35 }}>{x.title}</span>
            </button>
          );
        })}
      </nav>

      {/* the scenario */}
      <div style={{ flex: "999 1 720px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--teal)" }}>SCENARIO {String(sel + 1).padStart(2, "0")} · {s.agent === "codex" ? "CODEX" : "CLAUDE CODE"}</span>
          <h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 34, lineHeight: 1.08, letterSpacing: "-0.03em", fontWeight: 700 }}>{s.title}</h2>
          <p style={{ margin: 0, fontSize: 16, color: "var(--muted)" }}>{s.question}</p>
        </div>

        <figure className="dark" style={{ margin: 0, borderRadius: 14, overflow: "hidden" }}>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--night-line)", fontSize: 11, color: "var(--snow-3)" }}>
            <span>{s.agent === "codex" ? "~/.codex/sessions/…/rollout.jsonl" : "~/.claude/projects/…/session.jsonl"}</span>
            <span>simulated log · the format the reader parses</span>
          </div>
          <pre style={{ margin: 0, padding: 16, fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#D5DBE0" }}>
            {s.logDisplay.map((l, i) => (
              <span key={i} style={{ display: "block", color: i === 0 ? "#5EEAD4" : s.toolError ? "#9AA4AD" : "#D5DBE0" }}>{l}</span>
            ))}
          </pre>
        </figure>

        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <div role="tablist" aria-label="Steps" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", borderBottom: "1px solid var(--line)" }}>
            {STEP_LABELS.map((l, i) => (
              <button key={l} type="button" role="tab" aria-selected={i === step} onClick={() => setStep(i)} style={{ minHeight: 56, padding: 10, border: "none", borderBottom: `2px solid ${i === step ? "var(--teal-mid)" : "transparent"}`, background: i === step ? "#f3fbfa" : "var(--card)", color: i <= step ? "var(--ink)" : "#80868c", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span className="mono" style={{ fontSize: 11 }}>{i + 1}</span><span>{l}</span>
              </button>
            ))}
          </div>
          <div role="tabpanel" style={{ padding: 22, display: "flex", flexWrap: "wrap", gap: 24 }}>
            <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>EVIDENCE</span>
              <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: "#f6f5f1", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{stepCode(s, step)}</pre>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>{s.steps[step].evidence}</p>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)", marginTop: 6 }}>WHAT IT DOES NOT PROVE</span>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>{s.steps[step].limit === "-" ? "—" : s.steps[step].limit}</p>
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>STATE SO FAR</span>
              {state.map(([k, val, color, on]) => (
                <div key={k} className="mono" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 40, padding: "0 12px", borderRadius: 8, background: "#f6f5f1", opacity: on ? 1 : 0.3, fontSize: 12, transition: "opacity .25s" }}>
                  <span style={{ color: "var(--faint)" }}>{k}</span><span style={{ fontWeight: 700, color }}>{on ? val : "…"}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "0 22px 20px" }}>
            <button type="button" onClick={back} className="btn btn-ghost" style={{ fontSize: 14 }}>← Back</button>
            <button type="button" onClick={next} className="btn btn-ink" style={{ fontSize: 14 }}>{step < 3 ? "Next step →" : "Next scenario →"}</button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div className="dark" style={{ flex: "1.3 1 440px", minWidth: 0, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--night-line)" }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--snow-3)" }}>THE DECISION · THE PUBLISHED CODE</span>
            </div>
            {(["toEvents", "exposure"] as const).map((k) => (
              <div key={k} style={{ paddingBottom: 8 }}>
                <a href={`${REPO_SRC}${code[k].file}#L${code[k].lines[0].no}`} className="mono" style={{ display: "block", padding: "10px 16px 4px", fontSize: 11, color: "var(--teal-hi)" }}>{code[k].file} ↗</a>
                {code[k].lines.map((l) => {
                  const on = isHit(l.text);
                  return (
                    <div key={l.no} className="mono" style={{ display: "flex", gap: 14, padding: "1px 16px", fontSize: 12, lineHeight: 1.7, background: on ? "#16242A" : "transparent", borderLeft: `3px solid ${on ? VERDICT_DARK[v] : "transparent"}`, transition: "background .25s" }}>
                      <span style={{ color: "#4A545D", width: 28, textAlign: "right", flex: "none" }}>{l.no}</span>
                      <span style={{ color: "#D5DBE0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{l.text}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--night-line)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--snow-3)" }}>DECISION</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: VERDICT_DARK[v] }}>{decided ? VERDICT_LABEL[v] : "…"}</span>
              <span style={{ fontSize: 13, color: "var(--snow-2)" }}>{decided ? s.note : "Step through to the decision."}</span>
            </div>
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>LIMITS OF THIS CONCLUSION</span>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)" }}>
              {s.limits.map((l) => <li key={l}>{l}</li>)}
            </ul>
            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--faint)" }}>CHECK YOUR OWN HISTORY</span>
              <code style={{ fontSize: 12, background: "#f6f5f1", borderRadius: 6, padding: 10, wordBreak: "break-all" }}>{command} --events</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
