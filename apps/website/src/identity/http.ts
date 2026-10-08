export type ScalekitEnv = {
  environmentUrl?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
};

export type IdentityDeps = {
  env: ScalekitEnv;
  authorize: (opts: { prompt?: string; redirectUri: string }) => string;
  exchangeCode: (
    code: string,
    redirectUri: string,
  ) => Promise<{ idToken: string; accessToken: string }>;
  logoutUrl: (opts: { idTokenHint?: string; postLogoutRedirectUri: string }) => string;
  mintToken: (organizationId: string) => Promise<{ token: string; tokenId: string }>;
  readAccess: (accessToken: string) => { organizationId: string; userId?: string } | null;
  validateKey?: (token: string) => { organizationId: string } | null | Promise<{ organizationId: string } | null>;
  store?: import("./store.ts").ProbeStore;
};

const ACCESS = "sk_access";
const ID = "sk_id";

export function envReady(env: ScalekitEnv): env is Required<ScalekitEnv> {
  return Boolean(env.environmentUrl && env.clientId && env.clientSecret && env.redirectUri);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

const PAGE_CSS = `
:root{--bg:#fff;--fg:#171717;--muted:#737373;--line:#e5e5e5;--code:#fafafa}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:inherit}
.top{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.25rem;border-bottom:1px solid var(--line)}
.top a{font-weight:600;letter-spacing:-.02em;text-decoration:none}
main{max-width:36rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
h1{margin:0 0 .75rem;font-size:1.75rem;line-height:1.15;letter-spacing:-.02em;font-weight:600}
p{margin:0 0 1rem;color:var(--muted)}
pre{margin:0 0 1.25rem;padding:.85rem 1rem;background:var(--code);border:1px solid var(--line);border-radius:.75rem;overflow:auto}
code{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:.9rem;color:var(--fg)}
button{appearance:none;background:var(--fg);color:var(--bg);border:0;border-radius:.75rem;padding:.6rem 1rem;font:inherit;font-weight:600;cursor:pointer}
form{margin:0 0 1.25rem}
.hello{margin:0 0 1rem;padding:1rem;border:1px solid var(--line);border-radius:.75rem}
.hello p{margin:0 0 .75rem;color:var(--fg)}
`;

function page(status: number, title: string, body: string, headers: HeadersInit = {}): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · doraval</title><style>${PAGE_CSS}</style></head><body><header class="top"><a href="/">doraval</a><a href="/get-started/connect/">Connect the CLI</a></header><main><h1>${esc(title)}</h1>${body}</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } },
  );
}

function cookie(name: string, value: string, extra = ""): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${extra}`;
}

function clearCookie(name: string): string {
  return cookie(name, "", "; Max-Age=0");
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
}

function redirect(req: Request, to: string): Response {
  const location = to.startsWith("http") ? to : new URL(to, req.url).href;
  return new Response(null, { status: 302, headers: { location } });
}

function withCookies(res: Response, cookies: string[]): Response {
  const headers = new Headers(res.headers);
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(res.body, { status: res.status, headers });
}

export async function handleIdentity(req: Request, deps: IdentityDeps): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (path === "/auth/login" || path === "/auth/signup") {
    if (!envReady(deps.env)) {
      return page(
        503,
        "Sign-in is not configured",
        `<p>Set SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_REDIRECT_URI.</p><p><a href="/">Back to the docs</a></p>`,
      );
    }
    const location = deps.authorize({
      prompt: path.endsWith("signup") ? "create" : undefined,
      redirectUri: deps.env.redirectUri,
    });
    return redirect(req, location);
  }

  if (path === "/auth/callback") {
    return finishLogin(req, deps, url.searchParams.get("code") ?? "");
  }

  if (path === "/auth/logout") {
    const hint = readCookie(req, ID);
    const dest = envReady(deps.env)
      ? deps.logoutUrl({
          idTokenHint: hint,
          postLogoutRedirectUri: new URL("/", req.url).origin,
        })
      : "/";
    return withCookies(redirect(req, dest), [clearCookie(ACCESS), clearCookie(ID)]);
  }

  if (path === "/account" && req.method === "GET") {
    const access = readCookie(req, ACCESS);
    const who = access ? deps.readAccess(access) : null;
    const code = url.searchParams.get("code");
    if (code) {
      if (who) return redirect(req, "/account");
      return finishLogin(req, deps, code);
    }
    if (!who) {
      return redirect(req, "/auth/login");
    }
    const pending = (await deps.store?.pending(who.organizationId)) ?? [];
    const probes = pending
      .map(
        (p) =>
          `<section class="hello"><p>hello</p><form method="post" action="/probe/${esc(p.id)}/ack"><button type="submit">ack</button></form></section>`,
      )
      .join("");
    return page(
      200,
      "Mint an API key",
      `${probes}<p>Copy it once. Then run this command.</p><pre><code>dora config set identity.api_key &lt;token&gt; --yes</code></pre><form method="post" action="/account/key"><button type="submit">Mint API key</button></form><p><a href="/auth/logout">Log out</a></p>`,
    );
  }

  if (path === "/account/key" && req.method === "POST") {
    const access = readCookie(req, ACCESS);
    const claims = access ? deps.readAccess(access) : null;
    if (!claims) return redirect(req, "/auth/login");
    const minted = await deps.mintToken(claims.organizationId);
    const token = esc(minted.token);
    return page(
      200,
      "Copy this API key",
      `<p>It will not be shown again.</p><pre><code>${token}</code></pre><p>Then run this command.</p><pre><code>dora config set identity.api_key ${token} --yes</code></pre><p><a href="/account">Back</a> · <a href="/auth/logout">Log out</a></p>`,
    );
  }

  const probeId = path.match(/^\/probe\/([^/]+)$/)?.[1];
  const ackId = path.match(/^\/probe\/([^/]+)\/ack$/)?.[1];
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (path === "/probe" && req.method === "POST") {
    const who = (await deps.validateKey?.(bearer)) ?? null;
    if (!who || !deps.store) return json(401, { error: "bad-key" });
    const row = await deps.store.create(who.organizationId);
    return json(200, row);
  }

  if (probeId && req.method === "GET") {
    const who = (await deps.validateKey?.(bearer)) ?? null;
    if (!who || !deps.store) return json(401, { error: "bad-key" });
    const row = await deps.store.get(probeId);
    if (!row || row.organizationId !== who.organizationId) return json(404, { error: "missing" });
    return json(200, row);
  }

  if (ackId && req.method === "POST") {
    const access = readCookie(req, ACCESS);
    const who = access ? deps.readAccess(access) : null;
    if (!who) return redirect(req, "/auth/login");
    const row = await deps.store?.ack(ackId, who.organizationId);
    if (!row) return page(404, "No such hello", `<p><a href="/account">Back</a></p>`);
    return page(200, "Ack sent", `<p><a href="/account">Back</a></p>`);
  }

  return page(404, "Not found", `<p><a href="/">Back to the docs</a></p>`);
}

async function finishLogin(req: Request, deps: IdentityDeps, code: string): Promise<Response> {
  if (!envReady(deps.env)) {
    return page(
      503,
      "Sign-in is not configured",
      `<p>Set SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_REDIRECT_URI.</p><p><a href="/">Back to the docs</a></p>`,
    );
  }
  if (!code) {
    return page(400, "Sign-in did not finish", `<p>Missing authorization code.</p><p><a href="/auth/login">Try again</a></p>`);
  }
  const tokens = await deps.exchangeCode(code, deps.env.redirectUri);
  return withCookies(redirect(req, "/account"), [
    cookie(ACCESS, tokens.accessToken),
    cookie(ID, tokens.idToken),
  ]);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
