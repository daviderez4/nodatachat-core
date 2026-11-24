"use client";
import { useState } from "react";

/** A command with a copy button. `dark` for the night sections. */
export function CopyCommand({ command, dark = false }: { command: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard refused: the command is still selectable */
    }
  };
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, maxWidth: "100%",
        background: dark ? "var(--night-3)" : "var(--card)",
        border: `1px solid ${dark ? "var(--night-line-2)" : "var(--line-2)"}`,
        borderRadius: 10, padding: "5px 5px 5px 16px",
      }}
    >
      <code style={{ fontSize: 15, whiteSpace: "nowrap", overflowX: "auto", minWidth: 0, flex: "1 1 auto", color: dark ? "var(--snow)" : "var(--ink)" }}>
        <span style={{ color: dark ? "#5c6872" : "#9aa0a6" }} aria-hidden="true">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy: ${command}`}
        style={{
          height: 44, padding: "0 14px", borderRadius: 7, cursor: "pointer", fontSize: 14, fontWeight: 500,
          border: `1px solid ${dark ? "var(--night-line-2)" : "var(--line)"}`,
          background: dark ? "#1a2128" : "#f4f3ef", color: dark ? "var(--snow)" : "var(--ink)",
        }}
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
