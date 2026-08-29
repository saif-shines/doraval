import { describe, expect, test } from "bun:test";
import { handleIdentity, type IdentityDeps } from "./http.ts";

function jwt(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `e30.${payload}.x`;
}

function deps(over: Partial<IdentityDeps> = {}): IdentityDeps {
  const access = jwt({ oid: "org_1", sub: "usr_1" });
  return {
    env: {
      environmentUrl: "https://env.scalekit.com",
      clientId: "skc_test",
      clientSecret: "secret",
      redirectUri: "https://doraval.dev/auth/callback",
    },
    authorize: (opts) =>
      `https://env.scalekit.com/oauth/authorize?prompt=${opts.prompt ?? "login"}`,
    exchangeCode: async () => ({
      idToken: jwt({ sub: "usr_1" }),
      accessToken: access,
    }),
    logoutUrl: () => "https://env.scalekit.com/oidc/logout",
    mintToken: async () => ({ token: "dv_plain_once", tokenId: "apit_1" }),
    readAccess: (token) => {
      const part = token.split(".")[1];
      if (!part) return null;
      const c = JSON.parse(Buffer.from(part, "base64url").toString()) as { oid?: string; sub?: string };
      return c.oid ? { organizationId: c.oid, userId: c.sub } : null;
    },
    ...over,
  };
}

const empty = { env: {} } as IdentityDeps;

async function call(path: string, init: RequestInit = {}, d = deps()): Promise<Response> {
  return handleIdentity(new Request(`https://doraval.dev${path}`, init), d);
}

describe("identity HTTP (#77)", () => {
  test("missing Scalekit env fails login with a clear error", async () => {
    const res = await call("/auth/login", {}, empty);
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).toMatch(/Scalekit/i);
    expect(body).not.toMatch(/session/i);
  });

  test("login redirects to Scalekit hosted authorize", async () => {
    const res = await call("/auth/login");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/oauth/authorize");
  });

  test("signup uses the hosted create prompt", async () => {
    const res = await call("/auth/signup");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("prompt=create");
  });

  test("callback exchanges the code on the server and sets cookies", async () => {
    let saw = "";
    const d = deps({
      exchangeCode: async (code) => {
        saw = code;
        return {
          idToken: jwt({ sub: "usr_1" }),
          accessToken: jwt({ oid: "org_1" }),
        };
      },
    });
    const res = await call("/auth/callback?code=abc", {}, d);
    expect(saw).toBe("abc");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://doraval.dev/account");
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies.join("\n")).toMatch(/sk_access=/);
    expect(cookies.join("\n")).toMatch(/HttpOnly/i);
    expect(cookies.join("\n")).not.toContain("secret");
  });

  test("account without a cookie sends the visitor to login", async () => {
    const res = await call("/account");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://doraval.dev/auth/login");
  });

  test("account with a cookie shows mint, not Config, and never says session", async () => {
    const access = jwt({ oid: "org_1" });
    const res = await call("/account", { headers: { cookie: `sk_access=${access}` } });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/API key/i);
    expect(body).toMatch(/[Ll]og out/);
    expect(body).not.toMatch(/session/i);
    expect(body).not.toMatch(/config\.yml/i);
  });

  test("mint shows the plain token once", async () => {
    const access = jwt({ oid: "org_1" });
    const res = await call("/account/key", {
      method: "POST",
      headers: { cookie: `sk_access=${access}` },
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("dv_plain_once");
    expect(body).toContain("identity.api_key");
  });

  test("mint without login is refused", async () => {
    const res = await call("/account/key", { method: "POST" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://doraval.dev/auth/login");
  });

  test("logout clears cookies", async () => {
    const res = await call("/auth/logout", {
      headers: { cookie: "sk_access=x; sk_id=y" },
    });
    expect(res.status).toBe(302);
    const cookies = res.headers.getSetCookie?.() ?? [];
    expect(cookies.join("\n")).toMatch(/sk_access=;/);
  });
});
