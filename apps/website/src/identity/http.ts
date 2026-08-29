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
  store?: import("./store.ts").MemoryProbeStore;
};

const ACCESS = "sk_access";
const ID = "sk_id";

export function envReady(env: ScalekitEnv): env is Required<ScalekitEnv> {
  return Boolean(env.environmentUrl && env.clientId && env.clientSecret && env.redirectUri);
}

function html(status: number, body: string, headers: HeadersInit = {}): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>doraval</title>${body}`,
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
      return html(503, `<p>Scalekit is not configured. Set SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_REDIRECT_URI.</p>`);
    }
    const location = deps.authorize({
      prompt: path.endsWith("signup") ? "create" : undefined,
      redirectUri: deps.env.redirectUri,
    });
    return redirect(req, location);
  }

  if (path === "/auth/callback") {
    if (!envReady(deps.env)) {
      return html(503, `<p>Scalekit is not configured.</p>`);
    }
    const code = url.searchParams.get("code") ?? "";
    if (!code) return html(400, `<p>Missing authorization code.</p>`);
    const tokens = await deps.exchangeCode(code, deps.env.redirectUri);
    const res = redirect(req, "/account");
    return withCookies(res, [
      cookie(ACCESS, tokens.accessToken),
      cookie(ID, tokens.idToken),
    ]);
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
    if (!who) {
      return redirect(req, "/auth/login");
    }
    const pending = deps.store?.pending(who.organizationId) ?? [];
    const probes = pending
      .map(
        (p) =>
          `<p>hello</p><form method="post" action="/probe/${p.id}/ack"><button type="submit">ack</button></form>`,
      )
      .join("");
    return html(
      200,
      `${probes}
       <p>Mint an API key for the CLI. Copy it once. Then: <code>dora config set identity.api_key &lt;token&gt; --yes</code></p>
       <form method="post" action="/account/key"><button type="submit">Mint API key</button></form>
       <p><a href="/auth/logout">Log out</a></p>`,
    );
  }

  if (path === "/account/key" && req.method === "POST") {
    const access = readCookie(req, ACCESS);
    const claims = access ? deps.readAccess(access) : null;
    if (!claims) return redirect(req, "/auth/login");
    const minted = await deps.mintToken(claims.organizationId);
    return html(
      200,
      `<p>Copy this API key now. It will not be shown again.</p>
       <p><code>${minted.token}</code></p>
       <p><code>dora config set identity.api_key ${minted.token} --yes</code></p>
       <p><a href="/account">Back</a> · <a href="/auth/logout">Log out</a></p>`,
    );
  }

  const probeId = path.match(/^\/probe\/([^/]+)$/)?.[1];
  const ackId = path.match(/^\/probe\/([^/]+)\/ack$/)?.[1];
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (path === "/probe" && req.method === "POST") {
    const who = (await deps.validateKey?.(bearer)) ?? null;
    if (!who || !deps.store) return json(401, { error: "bad-key" });
    const row = deps.store.create(who.organizationId);
    return json(200, row);
  }

  if (probeId && req.method === "GET") {
    const who = (await deps.validateKey?.(bearer)) ?? null;
    if (!who || !deps.store) return json(401, { error: "bad-key" });
    const row = deps.store.get(probeId);
    if (!row || row.organizationId !== who.organizationId) return json(404, { error: "missing" });
    return json(200, row);
  }

  if (ackId && req.method === "POST") {
    const access = readCookie(req, ACCESS);
    const who = access ? deps.readAccess(access) : null;
    if (!who) return redirect(req, "/auth/login");
    const row = deps.store?.ack(ackId, who.organizationId);
    if (!row) return html(404, `<p>No such hello.</p>`);
    return html(200, `<p>ack</p><p><a href="/account">Back</a></p>`);
  }

  return html(404, `<p>Not found.</p>`);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
