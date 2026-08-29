import { describe, expect, test } from "bun:test";
import { handleIdentity, type IdentityDeps } from "./http.ts";
import { MemoryProbeStore } from "./store.ts";

function jwt(claims: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.x`;
}

function deps(): IdentityDeps {
  const store = new MemoryProbeStore();
  const access = jwt({ oid: "org_1" });
  return {
    env: {
      environmentUrl: "https://env.scalekit.com",
      clientId: "skc_test",
      clientSecret: "secret",
      redirectUri: "https://doraval.dev/auth/callback",
    },
    authorize: () => "https://env.scalekit.com/oauth/authorize",
    exchangeCode: async () => ({ idToken: jwt({ sub: "u" }), accessToken: access }),
    logoutUrl: () => "/",
    mintToken: async () => ({ token: "t", tokenId: "apit_1" }),
    readAccess: (token) => {
      const p = token.split(".")[1];
      if (!p) return null;
      const c = JSON.parse(Buffer.from(p, "base64url").toString()) as { oid?: string };
      return c.oid ? { organizationId: c.oid } : null;
    },
    validateKey: (token) => (token === "good" ? { organizationId: "org_1" } : null),
    store,
  };
}

async function call(path: string, init: RequestInit = {}, d = deps()): Promise<Response> {
  return handleIdentity(new Request(`https://doraval.dev${path}`, init), d);
}

describe("probe HTTP (#78)", () => {
  test("visitor without a key cannot create a probe", async () => {
    const res = await call("/probe", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("bad key is refused", async () => {
    const res = await call("/probe", {
      method: "POST",
      headers: { authorization: "Bearer bad" },
    });
    expect(res.status).toBe(401);
  });

  test("good key creates a hello", async () => {
    const res = await call("/probe", {
      method: "POST",
      headers: { authorization: "Bearer good" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload).toBe("hello");
    expect(body.status).toBe("pending");
    expect(body.id).toBeTruthy();
  });

  test("account shows hello only when logged in; visitor is sent to login", async () => {
    const d = deps();
    await call("/probe", { method: "POST", headers: { authorization: "Bearer good" } }, d);
    const visitor = await call("/account", {}, d);
    expect(visitor.status).toBe(302);
    expect(visitor.headers.get("location")).toBe("/auth/login");
    const access = jwt({ oid: "org_1" });
    const page = await call("/account", { headers: { cookie: `sk_access=${access}` } }, d);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("hello");
    expect(html).toMatch(/ack/i);
    expect(html).not.toMatch(/session/i);
  });

  test("ack completes that hello only", async () => {
    const d = deps();
    const first = await (await call("/probe", { method: "POST", headers: { authorization: "Bearer good" } }, d)).json();
    const second = await (await call("/probe", { method: "POST", headers: { authorization: "Bearer good" } }, d)).json();
    const access = jwt({ oid: "org_1" });
    const ack = await call(`/probe/${first.id}/ack`, {
      method: "POST",
      headers: { cookie: `sk_access=${access}` },
    }, d);
    expect(ack.status).toBe(200);
    const a = await (await call(`/probe/${first.id}`, { headers: { authorization: "Bearer good" } }, d)).json();
    const b = await (await call(`/probe/${second.id}`, { headers: { authorization: "Bearer good" } }, d)).json();
    expect(a.status).toBe("acked");
    expect(b.status).toBe("pending");
  });
});
