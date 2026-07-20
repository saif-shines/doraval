import { describe, expect, test } from "bun:test";
import { buildCompletionScript, parseCompletionArg } from "./completion-script.js";

describe("parseCompletionArg", () => {
  test("returns null when flag absent", () => {
    expect(parseCompletionArg(["scan"])).toBeNull();
  });

  test("parses --completion shell and = form", () => {
    expect(parseCompletionArg(["--completion", "bash"])).toBe("bash");
    expect(parseCompletionArg(["--completion=zsh"])).toBe("zsh");
  });
});

describe("buildCompletionScript", () => {
  test("bash script includes top-level commands and memory subs", async () => {
    const r = await buildCompletionScript("bash");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.script).toContain("complete -F _doraval_completions doraval");
    expect(r.script).toContain("scan");
    expect(r.script).toContain("memory)");
    expect(r.script).toMatch(/compgen -W ".*add/);
    expect(r.script).toContain("rules) COMPREPLY=");
    expect(r.script).toContain("list on off set package explain");
  });

  test("zsh script includes _arguments and sessions", async () => {
    const r = await buildCompletionScript("zsh");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.script).toContain("#compdef doraval");
    expect(r.script).toContain("_arguments");
    expect(r.script).toContain("sessions)");
    expect(r.script).toContain("rules)");
    expect(r.script).toContain("list on off set package explain");
  });

  test("fish script registers complete -c doraval", async () => {
    const r = await buildCompletionScript("fish");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.script).toContain("complete -c doraval");
    expect(r.script).toContain("config");
    expect(r.script).toContain("__fish_seen_subcommand_from rules");
    expect(r.script).toContain("list on off set package explain");
  });

  test("missing / unsupported shell returns usage error", async () => {
    const missing = await buildCompletionScript(undefined);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toContain("Usage:");

    const bad = await buildCompletionScript("powershell");
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error).toContain("Unsupported shell");
  });
});
