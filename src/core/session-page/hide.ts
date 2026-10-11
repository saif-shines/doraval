export function isHiddenCwd(cwd: string): boolean {
  if (cwd.includes("subagent-")) return true;
  if (cwd === "/tmp" || cwd.startsWith("/tmp/")) return true;
  if (cwd === "/private/tmp" || cwd.startsWith("/private/tmp/")) return true;
  if (cwd.includes("/var/folders/") && cwd.includes("/T/")) return true;
  return false;
}

export function isHiddenSession(summary: unknown): boolean {
  if (!summary || typeof summary !== "object") return false;
  const kind = (summary as { session_kind?: unknown }).session_kind;
  return kind === "subagent" || kind === "subagent_resume";
}
