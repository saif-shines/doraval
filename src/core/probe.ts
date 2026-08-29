export type ProbeStatus = "acked" | "pending" | "timeout" | "bad-key" | "no-key" | "error";

export type ProbeResult = {
  status: ProbeStatus;
  id?: string;
};

export async function runProbe(opts: {
  key: string | undefined;
  site: string;
  fetch: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<ProbeResult> {
  if (!opts.key) return { status: "no-key" };
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const pollMs = opts.pollMs ?? 1_000;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const headers = { authorization: `Bearer ${opts.key}`, accept: "application/json" };
  const created = await opts.fetch(`${opts.site.replace(/\/$/, "")}/probe`, {
    method: "POST",
    headers,
  });
  if (created.status === 401) return { status: "bad-key" };
  if (!created.ok) return { status: "error" };
  const body = (await created.json()) as { id?: string };
  const id = body.id;
  if (!id) return { status: "error" };
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const got = await opts.fetch(`${opts.site.replace(/\/$/, "")}/probe/${id}`, { headers });
    if (got.status === 401) return { status: "bad-key", id };
    if (!got.ok) return { status: "error", id };
    const row = (await got.json()) as { status?: string };
    if (row.status === "acked") return { status: "acked", id };
    await sleep(pollMs);
  }
  return { status: "timeout", id };
}
