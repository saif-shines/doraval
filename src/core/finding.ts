export type FindingTier = "structure" | "heuristics" | "llm" | "sessions";

export interface Finding {
  id: string;
  tier: FindingTier;
  severity: "error" | "warning" | "info" | "pass";
  message: string;
  hint?: string;
  file?: string;
  line?: number;
  fixable: boolean;
  fix?: { type: "rename_field" | "add_field" | "content"; description: string };
  code?: string;
  slug?: string;
  docUrl?: string;
}
