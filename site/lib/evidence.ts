// Typed access to generated/evidence.json, which scripts/evidence-check.mjs builds from
// content/evidence.json on every build. Every item was opened at its source and matched.
import raw from "@/generated/evidence.json";

export type TechnicalStatus = "attempted" | "succeeded" | "exposed" | "unknown";
export type LegalStage = "not_legal" | "allegation" | "evidence_filed" | "finding_of_fact" | "court_decision" | "final_judgment";

export interface EvidenceItem {
  id: string;
  date: string | null;
  headline: string;
  claim: string;
  quote: string;
  why: string;
  source_id: string;
  source_name: string;
  source_url: string;
  last_verified: string;
  event_type: string;
  jurisdiction: string;
  technical_status: TechnicalStatus | null;
  legal_stage: LegalStage;
  confidence: "high" | "medium" | "low";
  verification_status: "opened_and_matched";
  limits: string;
  stale: boolean;
}

export const evidence = raw as EvidenceItem[];
export const tickerItems = evidence.filter((i) => !i.stale);

export const SITE_URL = "https://whatmyagentsaw.com";
export const itemUrl = (i: EvidenceItem) => `${SITE_URL}/evidence/${i.id}/`;

export const TECH_LABEL: Record<TechnicalStatus, string> = {
  attempted: "Attempted",
  succeeded: "Succeeded",
  exposed: "Reported exposed",
  unknown: "Unknown, not safe",
};

export const LEGAL_LABEL: Record<LegalStage, string> = {
  not_legal: "",
  allegation: "Allegation",
  evidence_filed: "Evidence filed",
  finding_of_fact: "Finding of fact",
  court_decision: "Court decision",
  final_judgment: "Final judgment",
};

export const TYPE_LABEL: Record<string, string> = {
  incident: "Incident",
  hazard: "Hazard",
  vulnerability: "Vulnerability",
  lawsuit: "Lawsuit",
  court_decision: "Court decision",
  enforcement_action: "Enforcement",
  regulation: "Regulation",
  guidance: "Guidance",
  standard: "Standard",
  technical_finding: "Finding",
  research: "Research",
};
