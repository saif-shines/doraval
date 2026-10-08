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
@font-face{font-family:DoravalGrotesk;src:url(/fonts/space-grotesk.woff2) format("woff2");font-weight:400 700;font-display:swap}
@font-face{font-family:DoravalSans;src:url(/fonts/inter.woff2) format("woff2");font-weight:400 700;font-display:swap}
@font-face{font-family:DoravalMono;src:url(/fonts/jetbrains-mono.woff2) format("woff2");font-weight:400 700;font-display:swap}
:root{--bg:oklch(100% 0 0);--fg:oklch(14.5% 0 0);--muted:oklch(54% 0 0);--line:oklch(88% .006 260 / .72);--code:oklch(99% 0 0);--cobalt:oklch(58% .2 256);--on:oklch(100% 0 0);--rule:oklch(55% .16 255 / .55);--radius:.25rem;color-scheme:light}
:root[data-theme=dark]{--bg:oklch(8.5% 0 0);--fg:oklch(96% 0 0);--muted:oklch(68% 0 0);--line:oklch(24% 0 0 / .8);--code:oklch(12% 0 0);--on:oklch(100% 0 0);--rule:oklch(70% .14 255 / .6);color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 DoravalSans,Inter,ui-sans-serif,system-ui,sans-serif}
a{color:inherit}
.bar{position:sticky;top:0;z-index:2;background:color-mix(in oklab,var(--bg) 90%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.bar-in{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:4rem;width:min(40rem,100%);margin:0 auto;padding:0 1.5rem}
.mark{font-family:DoravalGrotesk,"Space Grotesk",ui-sans-serif,sans-serif;font-weight:600;letter-spacing:-.02em;text-decoration:none}
.docs{color:var(--muted);text-decoration:none;font-size:.95rem}
.docs:hover{color:var(--fg)}
main{width:min(40rem,100%);margin:0 auto;padding:2.75rem 1.5rem 4.5rem}
h1{margin:0 0 .75rem;font-family:DoravalGrotesk,"Space Grotesk",ui-sans-serif,sans-serif;font-weight:600;letter-spacing:-.03em;line-height:1.05;font-size:clamp(2rem,4vw,2.6rem)}
p{margin:0 0 1rem;color:var(--muted);max-width:42ch}
.lead{color:var(--fg);font-size:1.125rem;line-height:1.5}
.block{margin:0 0 1.25rem}
pre{margin:0 0 .6rem;padding:1rem 1.1rem;background:var(--code);border:1px solid var(--line);border-left:3px solid var(--rule);border-radius:var(--radius);overflow:auto}
pre.token{padding:1.15rem 1.2rem}
pre.token code{font-size:1.05rem}
code{font-family:DoravalMono,"JetBrains Mono",ui-monospace,monospace;font-size:.92rem;color:var(--fg);white-space:pre-wrap;overflow-wrap:anywhere}
button{appearance:none;background:var(--cobalt);color:var(--on);border:0;border-radius:var(--radius);padding:.7rem 1rem;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:color-mix(in oklab,var(--cobalt) 86%,black)}
button.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
button.ghost:hover{background:transparent;border-color:var(--fg)}
button:focus-visible,a:focus-visible{outline:2px solid var(--cobalt);outline-offset:3px}
form{margin:0}
.row{display:flex;align-items:center;gap:1.25rem;margin:0 0 1.5rem;flex-wrap:wrap}
.quiet{color:var(--muted);text-decoration:none}
.quiet:hover{color:var(--fg)}
.hello{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .75rem;padding:.85rem 1rem;border:1px solid var(--line);border-radius:var(--radius)}
.hello p{margin:0;color:var(--fg);font-family:DoravalMono,"JetBrains Mono",ui-monospace,monospace}
.links{display:flex;gap:1.25rem;margin-top:1.5rem}
.links a{color:var(--cobalt);text-decoration:none}
.links a:hover{text-decoration:underline}
@media (max-width:640px){.bar-in,main{padding-left:1rem;padding-right:1rem}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
`;

const THEME_BOOT = `(()=>{try{const s=localStorage.getItem("blume-theme");const sys=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=s==="light"||s==="dark"?s:sys;}catch(e){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}})();`;

const COPY_BOOT = `document.querySelectorAll("[data-copy]").forEach((btn)=>{btn.addEventListener("click",async()=>{const el=document.getElementById(btn.getAttribute("data-copy")||"");if(!el)return;try{await navigator.clipboard.writeText(el.textContent||"")}catch(e){return}const old=btn.textContent;btn.textContent="Copied";setTimeout(()=>{btn.textContent=old},1600);});});`;

function page(status: number, title: string, body: string, headers: HeadersInit = {}): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>${esc(title)} · doraval</title><script>${THEME_BOOT}</script><style>${PAGE_CSS}</style></head><body><header class="bar"><div class="bar-in"><a class="mark" href="/">doraval</a><a class="docs" href="/get-started/connect/">Connect the CLI</a></div></header><main><h1>${esc(title)}</h1>${body}</main><script>${COPY_BOOT}</script></body></html>`,
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
        `<p class="lead">Set SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_REDIRECT_URI.</p><nav class="links"><a href="/">Back to the docs</a></nav>`,
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
    // A 302 to /account loops. Netlify copies ?code= onto a Location that has no query.
    if (code && !who) return finishLogin(req, deps, code);
    if (!who) {
      return redirect(req, "/auth/login");
    }
    const pending = (await deps.store?.pending(who.organizationId)) ?? [];
    const probes = pending
      .map(
        (p) =>
          `<section class="hello"><p>Pending hello</p><form method="post" action="/probe/${esc(p.id)}/ack"><button type="submit">ack</button></form></section>`,
      )
      .join("");
    return page(
      200,
      "Mint an API key",
      `<script>if(location.search)history.replaceState(null,"",location.pathname)</script>${probes}<p class="lead">Mint a key. The site shows it once.</p><div class="row"><form method="post" action="/account/key"><button type="submit">Mint API key</button></form><a class="quiet" href="/auth/logout">Log out</a></div><p>Then run this command.</p><pre><code>dora config set identity.api_key &lt;token&gt; --yes</code></pre>`,
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
      `<p class="lead">It will not be shown again.</p><div class="block"><pre class="token"><code id="key">${token}</code></pre><button type="button" data-copy="key">Copy key</button></div><p>Then run this command.</p><div class="block"><pre><code id="cmd">dora config set identity.api_key ${token} --yes</code></pre><button type="button" class="ghost" data-copy="cmd">Copy command</button></div><nav class="links"><a href="/account">Back</a><a href="/auth/logout">Log out</a></nav>`,
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
    if (!row) return page(404, "No such hello", `<nav class="links"><a href="/account">Back</a></nav>`);
    return page(200, "Ack sent", `<nav class="links"><a href="/account">Back</a></nav>`);
  }

  return page(404, "Not found", `<nav class="links"><a href="/">Back to the docs</a></nav>`);
}

async function finishLogin(req: Request, deps: IdentityDeps, code: string): Promise<Response> {
  if (!envReady(deps.env)) {
    return page(
      503,
      "Sign-in is not configured",
      `<p class="lead">Set SCALEKIT_ENVIRONMENT_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, and SCALEKIT_REDIRECT_URI.</p><nav class="links"><a href="/">Back to the docs</a></nav>`,
    );
  }
  if (!code) {
    return page(400, "Sign-in did not finish", `<p class="lead">Missing authorization code.</p><nav class="links"><a href="/auth/login">Try again</a></nav>`);
  }
  const tokens = await deps.exchangeCode(code, deps.env.redirectUri);
  // ?ok=1 keeps Netlify from copying ?code= onto this Location.
  const next = new URL("/account", req.url);
  next.search = "ok=1";
  return withCookies(redirect(req, next.href), [
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
