import { describe, it, expect, afterEach } from "bun:test";
import { describeCapabilities, detectCapabilities } from "./capability-detect.js";

const origEnv = { ...process.env };

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in origEnv)) delete (process.env as Record<string, string | undefined>)[k];
  }
  Object.assign(process.env, origEnv);
});

describe("describeCapabilities", () => {
  it("api path", () => {
    const caps = { api: true, cli: false, cliCommand: null, preferred: "api" as const };
    expect(describeCapabilities(caps)).toBe("API judge (direct)");
  });

  it("cli path with claude", () => {
    const caps = { api: false, cli: true, cliCommand: "claude", preferred: "cli" as const };
    expect(describeCapabilities(caps)).toBe("CLI judge (claude)");
  });

  it("none path contains helpful message", () => {
    const caps = { api: false, cli: false, cliCommand: null, preferred: "none" as const };
    expect(describeCapabilities(caps)).toContain("no judge available");
  });
});

describe("detectCapabilities", () => {
  it("api=true when OPENAI_API_KEY set", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const caps = detectCapabilities({});
    expect(caps.api).toBe(true);
    expect(caps.preferred).toBe("api");
  });

  it("api=false when all keys cleared", () => {
    for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "ZAI_API_KEY",
                     "OPENROUTER_API_KEY", "ZAI_BASE_URL", "OPENAI_BASE_URL"]) {
      delete (process.env as Record<string, string | undefined>)[k];
    }
    const caps = detectCapabilities({});
    expect(caps.api).toBe(false);
    expect(["cli", "none"]).toContain(caps.preferred);
  });

  it("evalCfg.api_key overrides env", () => {
    for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY"]) {
      delete (process.env as Record<string, string | undefined>)[k];
    }
    const caps = detectCapabilities({ api_key: "sk-from-config" });
    expect(caps.api).toBe(true);
  });
});
