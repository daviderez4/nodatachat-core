import type { Scenario, Verdict } from "@/lib/facts";
import { succeededOf, verdictOf } from "@/lib/facts";

export const STEP_LABELS = ["Request", "Result", "Returned", "Decision"] as const;

export const VERDICT_DARK: Record<Verdict, string> = {
  exposed: "#F5B455",
  unknown: "#A5B4FC",
  no: "#9AA4AD",
  none: "#5EEAD4",
};
export const VERDICT_LIGHT: Record<Verdict, string> = {
  exposed: "#B45309",
  unknown: "#4F46E5",
  no: "#4A5057",
  none: "#0B7A6E",
};

/** What each step shows from the log, for one scenario. */
export function stepCode(s: Scenario, step: number): string {
  if (step === 0) return s.request;
  if (step === 1) return s.toolError === null ? "outcome: not recorded by this agent" : `is_error: ${s.toolError}`;
  if (step === 2) return s.returned;
  if (!s.decided.length) return "no event: outside every category, no key returned";
  return s.decided
    .map((e) => `${e.category} · ${e.outcome.replace("_", " ")} · exposed: ${e.exposed}${e.sample ? " · sample" : ""}`)
    .join("\n");
}

export { succeededOf, verdictOf };
