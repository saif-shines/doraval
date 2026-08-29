import type { IdentityDeps, ScalekitEnv } from "./http.ts";

export function envFromProcess(env: NodeJS.ProcessEnv = process.env): ScalekitEnv {
  return {
    environmentUrl: env.SCALEKIT_ENVIRONMENT_URL,
    clientId: env.SCALEKIT_CLIENT_ID,
    clientSecret: env.SCALEKIT_CLIENT_SECRET,
    redirectUri: env.SCALEKIT_REDIRECT_URI ?? "https://doraval.dev/auth/callback",
  };
}

function decodeJwt(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function liveDeps(env: ScalekitEnv = envFromProcess()): IdentityDeps {
  return {
    env,
    authorize({ prompt, redirectUri }) {
      const base = env.environmentUrl ?? "";
      const u = new URL("oauth/authorize", base.endsWith("/") ? base : `${base}/`);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("client_id", env.clientId ?? "");
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("scope", "openid profile email offline_access");
      if (prompt) u.searchParams.set("prompt", prompt);
      return u.toString();
    },
    async exchangeCode(code, redirectUri) {
      const { ScalekitClient } = await import("@scalekit-sdk/node");
      const sk = new ScalekitClient(env.environmentUrl!, env.clientId!, env.clientSecret!);
      const result = await sk.authenticateWithCode(code, redirectUri);
      return { idToken: result.idToken, accessToken: result.accessToken };
    },
    logoutUrl({ idTokenHint, postLogoutRedirectUri }) {
      const base = env.environmentUrl ?? "";
      const u = new URL("oidc/logout", base.endsWith("/") ? base : `${base}/`);
      if (idTokenHint) u.searchParams.set("id_token_hint", idTokenHint);
      u.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
      return u.toString();
    },
    async mintToken(organizationId) {
      const { ScalekitClient } = await import("@scalekit-sdk/node");
      const sk = new ScalekitClient(env.environmentUrl!, env.clientId!, env.clientSecret!);
      const result = await sk.token.createToken(organizationId, {
        description: "doraval CLI",
      });
      return { token: result.token, tokenId: result.tokenId };
    },
    readAccess(accessToken) {
      const c = decodeJwt(accessToken);
      const oid = c?.oid;
      if (typeof oid !== "string" || !oid) return null;
      return { organizationId: oid, userId: typeof c.sub === "string" ? c.sub : undefined };
    },
  };
}
