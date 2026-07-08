import { describe, expect, test } from "bun:test";
import { injectPlatformDeps } from "./prepare-npm-publish.ts";

describe("injectPlatformDeps", () => {
  test("adds all five platform packages at the exact version", () => {
    const pkg = { name: "@hacksmith/doraval", version: "0.5.0", files: ["bin/doraval.cjs", "README.md"] };
    const out = injectPlatformDeps(structuredClone(pkg), "0.5.0");
    expect(out.optionalDependencies).toEqual({
      "@hacksmith/doraval-darwin-arm64": "0.5.0",
      "@hacksmith/doraval-darwin-x64": "0.5.0",
      "@hacksmith/doraval-linux-x64": "0.5.0",
      "@hacksmith/doraval-linux-arm64": "0.5.0",
      "@hacksmith/doraval-win32-x64": "0.5.0",
    });
  });

  test("pins exact versions — no caret (a version-skewed binary is a broken install)", () => {
    const out = injectPlatformDeps({ version: "1.2.3" } as never, "1.2.3");
    for (const v of Object.values(out.optionalDependencies as Record<string, string>)) {
      expect(v).toBe("1.2.3");
      expect(v.startsWith("^")).toBe(false);
    }
  });
});
