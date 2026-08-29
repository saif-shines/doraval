import { describe, expect, test } from "bun:test";
import { envFromProcess, liveDeps } from "./live.ts";

describe("identity live deps", () => {
  test("envFromProcess reads SCALEKIT_* names", () => {
    const env = envFromProcess({
      SCALEKIT_ENVIRONMENT_URL: "https://e.scalekit.com",
      SCALEKIT_CLIENT_ID: "skc_1",
      SCALEKIT_CLIENT_SECRET: "s",
      SCALEKIT_REDIRECT_URI: "https://doraval.dev/auth/callback",
    });
    expect(env.environmentUrl).toBe("https://e.scalekit.com");
    expect(env.clientId).toBe("skc_1");
    expect(liveDeps(env).authorize({ redirectUri: env.redirectUri! })).toContain("client_id=skc_1");
  });
});
