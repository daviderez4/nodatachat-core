// Typed access to generated/toolbox.json, which scripts/toolbox-check.mjs builds from
// content/toolbox.json on every build. Every entry carries its source and the date it was checked.
import raw from "@/generated/toolbox.json";

export type Tri = "yes" | "partial" | "no";
export type Where = "your machine" | "your cloud" | "vendor";

export interface Tool {
  id: string;
  name: string;
  url: string;
  level: number;
  category: string;
  enforces: Tri;
  proves: Tri;
  runs_where: Where[];
  content_leaves: "yes" | "no" | "depends";
  open_source: string;
  covers: string;
  price: string;
  basis: "docs" | "tested";
  how_to_verify: string;
  last_checked: string;
  limits: string;
  summary: string;
  disclosure?: string;
  /** Shown after content_leaves when the yes/no alone would mislead (for example: the agent sends content to its model provider). */
  content_note?: string;
  stale: boolean;
  /** The whole tool is under an open licence (derived at build time). */
  oss: boolean;
  /** It can run on your own machine (derived at build time). */
  local: boolean;
}

export const tools = raw as Tool[];
