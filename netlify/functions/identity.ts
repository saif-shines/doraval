import { handleIdentity } from "../../apps/website/src/identity/http.ts";
import { liveDeps } from "../../apps/website/src/identity/live.ts";
import { blobsContext, JsonProbeStore, remoteIo } from "../../apps/website/src/identity/store.ts";

type NetlifyEvent = {
  rawUrl?: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
  blobs?: string;
};

export async function handler(event: NetlifyEvent) {
  const host = event.headers.host ?? "doraval.dev";
  const proto = event.headers["x-forwarded-proto"] ?? "https";
  const forwarded = event.headers["x-forwarded-uri"] ?? event.headers["x-original-uri"];
  const url = forwarded
    ? `${proto}://${host}${forwarded}`
    : event.rawUrl && !event.rawUrl.includes("/.netlify/functions/")
      ? event.rawUrl
      : `${proto}://${host}${event.path}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(event.headers)) {
    if (v) headers.set(k, v);
  }
  const req = new Request(url, {
    method: event.httpMethod,
    headers,
    body: event.httpMethod === "GET" || event.httpMethod === "HEAD" ? undefined : event.body,
  });
  const blobs = blobsContext(event);
  const store = blobs ? new JsonProbeStore(remoteIo(blobs)) : undefined;
  const res = await handleIdentity(req, liveDeps(undefined, store));
  const outHeaders: Record<string, string> = {};
  const setCookie: string[] = [];
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") setCookie.push(value);
    else outHeaders[key] = value;
  });
  return {
    statusCode: res.status,
    headers: outHeaders,
    multiValueHeaders: setCookie.length ? { "Set-Cookie": setCookie } : undefined,
    body: await res.text(),
  };
}
