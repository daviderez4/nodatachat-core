"use client";
import { useMemo, useState } from "react";
import type { Tool, Tri } from "@/lib/toolbox";
import { links } from "@/lib/links";
import raw from "@/content/copy.json";

type C = typeof raw.toolbox;

/** The one-sided label a card carries, so a tool that only enforces or only logs says so plainly. */
function sideLabel(t: Tool, c: C["card"]): string | null {
  if (t.enforces !== "no" && t.proves === "no") return c.enforcementOnly;
  if (t.enforces === "no" && t.proves !== "no") return c.loggingOnly;
  if (t.enforces === "no" && t.proves === "no") return c.detectionOnly;
  return null;
}

function Badge({ label, v, c }: { label: string; v: Tri; c: C["card"] }) {
  return (
    <span className="tb-badge" data-v={v}>
      {label}: <strong style={{ fontWeight: 700 }}>{c[v]}</strong>
    </span>
  );
}

/** The ladder and the cards share one filter: selecting a level on the stair filters the list. */
export function Toolbox({ tools, c }: { tools: Tool[]; c: C }) {
  const [level, setLevel] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [oss, setOss] = useState(false);
  const [local, setLocal] = useState(false);

  const counts = useMemo(() => {
    const n = [0, 0, 0, 0, 0, 0, 0];
    for (const t of tools) n[t.level - 1] += 1;
    return n;
  }, [tools]);
  const categories = useMemo(() => [...new Set(tools.map((t) => t.category))].sort(), [tools]);
  const shown = tools.filter((t) => (level === null || t.level === level) && (!category || t.category === category) && (!oss || t.oss) && (!local || t.local));
  const f = c.filters;
  const k = c.card;
  const countLabel = (n: number) => (n === 0 ? c.ladderTools[0] : `${n} ${n === 1 ? c.ladderTools[1] : c.ladderTools[2]}`);
  const pick = (n: number) => {
    setLevel((cur) => (cur === n ? null : n));
    document.getElementById("tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* THE LADDER */}
      <section className="wrap" aria-labelledby="ladder-title" style={{ paddingTop: 24, paddingBottom: 64, display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="eyebrow">{c.ladderEyebrow}</div>
        <h2 id="ladder-title" className="h2">{c.ladderTitle}</h2>
        <p className="lede" style={{ maxWidth: 780 }}>{c.ladderLede}</p>
        <p className="mono" style={{ margin: 0, fontSize: 12, color: "var(--faint)" }}>{c.ladderHint}</p>
        <ol className="tb-stair">
          {c.levels.map((lv, i) => {
            const n = i + 1;
            return (
              <li key={lv.name} className={`tb-step tb-lv${n}`} style={{ ["--rise" as string]: i } as React.CSSProperties}>
                <button type="button" aria-pressed={level === n} onClick={() => pick(n)}>
                  <span className="tb-step-n">{k.level.toUpperCase()} {n}</span>
                  <span className="tb-step-name">{lv.name}</span>
                  <span className="tb-step-meaning">{lv.meaning}</span>
                  <span className="tb-step-count">{countLabel(counts[i])}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {c.levels.map((lv, i) =>
            "note" in lv && lv.note ? (
              <p key={lv.name} style={{ flex: "1 1 320px", margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--muted)", display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className={`tb-chip tb-lv${i + 1}`} style={{ flex: "none" }}>{i + 1}</span>
                <span>{lv.note}</span>
              </p>
            ) : null,
          )}
        </div>
      </section>

      {/* HOW TO CHOOSE */}
      <section style={{ background: "var(--paper-2)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ paddingTop: 64, paddingBottom: 64, display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="eyebrow">{c.testsEyebrow}</div>
          <h2 className="h2">{c.testsTitle}</h2>
          <p className="lede" style={{ maxWidth: 760 }}>{c.testsLede}</p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
            {c.tests.map(([t, b], i) => (
              <li key={t} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, display: "flex", gap: 12 }}>
                <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: 5, border: "1.5px solid var(--teal-mid)", marginTop: 1 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{i + 1} / {c.tests.length}</span>
                  <span style={{ fontWeight: 700 }}>{t}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>{b}</span>
                </span>
              </li>
            ))}
          </ol>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: 760 }}>{c.alsoAsk}</p>
        </div>
      </section>

      {/* THE TOOLS */}
      <section id="tools" className="wrap" aria-labelledby="tools-title" style={{ paddingTop: 64, paddingBottom: 72, display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="eyebrow">{c.toolsEyebrow}</div>
        <h2 id="tools-title" className="h2">{c.toolsTitle}</h2>
        <p className="lede" style={{ maxWidth: 760 }}>{c.toolsLede}</p>
        <div className="tb-filters" role="group" aria-label="Filters">
          <label>
            {f.level}
            <select value={level ?? ""} onChange={(e) => setLevel(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{f.allLevels}</option>
              {c.levels.map((lv, i) => <option key={lv.name} value={i + 1}>{i + 1}. {lv.name}</option>)}
            </select>
          </label>
          <label>
            {f.category}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{f.allCategories}</option>
              {categories.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={oss} onChange={(e) => setOss(e.target.checked)} />{f.openSource}</label>
          <label><input type="checkbox" checked={local} onChange={(e) => setLocal(e.target.checked)} />{f.local}</label>
          {level !== null || category || oss || local ? (
            <button type="button" className="btn btn-ghost" style={{ minHeight: 40, fontSize: 14 }} onClick={() => { setLevel(null); setCategory(""); setOss(false); setLocal(false); }}>{f.clear}</button>
          ) : null}
          <span className="mono" aria-live="polite" style={{ fontSize: 12, color: "var(--faint)", marginLeft: "auto" }}>{f.showing} {shown.length} {f.of} {tools.length}</span>
        </div>

        {shown.length === 0 ? <p style={{ margin: 0, color: "var(--muted)" }}>{f.none}</p> : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 14 }}>
          {shown.map((t) => {
            const side = sideLabel(t, k);
            return (
              <article key={t.id} id={t.id} className={`tb-card tb-lv${t.level}`}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span className={`tb-chip tb-lv${t.level}`}>{k.level} {t.level} · {c.levels[t.level - 1].name}</span>
                  <span className="chip">{t.category}</span>
                  <span className="chip">{t.basis === "tested" ? k.basisTested : k.basisDocs}</span>
                  {t.stale ? <span className="chip" style={{ color: "var(--amber)", borderColor: "#e7cf9a" }}>{k.stale}</span> : null}
                </div>
                <h3 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 20, letterSpacing: "-0.015em", fontWeight: 700 }}>
                  <a href={t.url} style={{ color: "var(--ink)" }}>{t.name} <span aria-hidden="true" style={{ color: "var(--faint)", fontSize: 14 }}>↗</span></a>
                </h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>{t.summary}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <Badge label={k.enforces} v={t.enforces} c={k} />
                  <Badge label={k.proves} v={t.proves} c={k} />
                  {side ? <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{side}</span> : null}
                </div>
                <dl className="tb-facts">
                  <dt>{k.runsWhere}</dt><dd>{t.runs_where.join(", ")}</dd>
                  <dt>{k.contentLeaves}</dt><dd>{t.content_leaves}</dd>
                  <dt>{k.covers}</dt><dd>{t.covers}</dd>
                  <dt>{k.license}</dt><dd>{t.open_source}</dd>
                  <dt>{k.price}</dt><dd>{t.price}</dd>
                  <dt>{k.limits}</dt><dd>{t.limits}</dd>
                </dl>
                {t.disclosure ? <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>{t.disclosure}</p> : null}
                <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--faint)" }}>
                  <a href={t.how_to_verify} style={{ fontSize: 13, overflowWrap: "anywhere" }}>{k.verify} →</a>
                  <span>{k.footer} {t.last_checked}. {k.error} <a href={links.newIssue}>{k.openIssue}</a></span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
