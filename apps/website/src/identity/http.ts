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
    return Response.redirect(location, 302);
  }

  if (path === "/auth/callback") {
    if (!envReady(deps.env)) {
      return html(503, `<p>Scalekit is not configured.</p>`);
    }
    const code = url.searchParams.get("code") ?? "";
    if (!code) return html(400, `<p>Missing authorization code.</p>`);
    const tokens = await deps.exchangeCode(code, deps.env.redirectUri);
    const res = Response.redirect("/account", 302);
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
    return withCookies(Response.redirect(dest, 302), [clearCookie(ACCESS), clearCookie(ID)]);
  }

  if (path === "/account" && req.method === "GET") {
    const access = readCookie(req, ACCESS);
    if (!access || !deps.readAccess(access)) {
      return Response.redirect("/auth/login", 302);
    }
    return html(
      200,
      `<p>Mint an API key for the CLI. Copy it once. Then: <code>dora config set identity.api_key &lt;token&gt; --yes</code></p>
       <form method="post" action="/account/key"><button type="submit">Mint API key</button></form>
       <p><a href="/auth/logout">Log out</a></p>`,
    );
  }

  if (path === "/account/key" && req.method === "POST") {
    const access = readCookie(req, ACCESS);
    const claims = access ? deps.readAccess(access) : null;
    if (!claims) return Response.redirect("/auth/login", 302);
    const minted = await deps.mintToken(claims.organizationId);
    return html(
      200,
      `<p>Copy this API key now. It will not be shown again.</p>
       <p><code>${minted.token}</code></p>
       <p><code>dora config set identity.api_key ${minted.token} --yes</code></p>
       <p><a href="/account">Back</a> · <a href="/auth/logout">Log out</a></p>`,
    );
  }

  return html(404, `<p>Not found.</p>`);
}
