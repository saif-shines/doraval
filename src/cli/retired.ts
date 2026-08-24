/** Retired verbs: hard-break exit 2 + one Next. No aliases. */
export const RETIRED: Record<string, string | string[]> = {
  "agent-help": "dora --help --json",
  new: "dora skill new",
  reconcile: "dora conflicts",
  rules: "dora rule",
  sessions: "dora session",
  bump: "dora plugin bump",
  providers: ["dora config setup", "dora scan"],
};

export function retiredNext(name: string): string | string[] | undefined {
  return RETIRED[name];
}
