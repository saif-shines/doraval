export type Probe = {
  id: string;
  organizationId: string;
  payload: "hello";
  status: "pending" | "acked";
};

export type ProbeStore = {
  create(organizationId: string): Probe | Promise<Probe>;
  get(id: string): Probe | undefined | Promise<Probe | undefined>;
  ack(id: string, organizationId: string): Probe | undefined | Promise<Probe | undefined>;
  pending(organizationId: string): Probe[] | Promise<Probe[]>;
};

export class MemoryProbeStore implements ProbeStore {
  private rows = new Map<string, Probe>();
  private n = 0;

  create(organizationId: string): Probe {
    const row: Probe = {
      id: `prb_${++this.n}`,
      organizationId,
      payload: "hello",
      status: "pending",
    };
    this.rows.set(row.id, row);
    return row;
  }

  get(id: string): Probe | undefined {
    return this.rows.get(id);
  }

  ack(id: string, organizationId: string): Probe | undefined {
    const row = this.rows.get(id);
    if (!row || row.organizationId !== organizationId) return undefined;
    row.status = "acked";
    return row;
  }

  pending(organizationId: string): Probe[] {
    return [...this.rows.values()].filter(
      (r) => r.organizationId === organizationId && r.status === "pending",
    );
  }
}

export type ProbeSnapshot = { n: number; rows: Probe[] };

export type ProbeIo = {
  load(): Promise<ProbeSnapshot>;
  save(snap: ProbeSnapshot): Promise<void>;
};

export type BlobsContext = { edgeURL: string; token: string; siteID: string };

export function emptySnapshot(): ProbeSnapshot {
  return { n: 0, rows: [] };
}

export class JsonProbeStore implements ProbeStore {
  constructor(private readonly io: ProbeIo) {}

  async create(organizationId: string): Promise<Probe> {
    const snap = await this.io.load();
    const row: Probe = {
      id: `prb_${++snap.n}`,
      organizationId,
      payload: "hello",
      status: "pending",
    };
    snap.rows.push(row);
    await this.io.save(snap);
    return row;
  }

  async get(id: string): Promise<Probe | undefined> {
    return (await this.io.load()).rows.find((r) => r.id === id);
  }

  async ack(id: string, organizationId: string): Promise<Probe | undefined> {
    const snap = await this.io.load();
    const row = snap.rows.find((r) => r.id === id);
    if (!row || row.organizationId !== organizationId) return undefined;
    row.status = "acked";
    await this.io.save(snap);
    return row;
  }

  async pending(organizationId: string): Promise<Probe[]> {
    return (await this.io.load()).rows.filter(
      (r) => r.organizationId === organizationId && r.status === "pending",
    );
  }
}

export function memoryIo(start: ProbeSnapshot = emptySnapshot()): ProbeIo {
  let snap = start;
  return {
    load: async () => ({ n: snap.n, rows: snap.rows.map((r) => ({ ...r })) }),
    save: async (next) => {
      snap = { n: next.n, rows: next.rows.map((r) => ({ ...r })) };
    },
  };
}

export function remoteIo(ctx: BlobsContext, fetchFn: typeof fetch = fetch): ProbeIo {
  const url = `${ctx.edgeURL.replace(/\/$/, "")}/${ctx.siteID}/probes/state`;
  const headers = { authorization: `Bearer ${ctx.token}` };
  return {
    async load() {
      const res = await fetchFn(url, { headers });
      if (res.status === 404) return emptySnapshot();
      if (!res.ok) throw new Error(`probe store get ${res.status}`);
      const body = (await res.json()) as Partial<ProbeSnapshot>;
      return { n: Number(body.n) || 0, rows: Array.isArray(body.rows) ? body.rows : [] };
    },
    async save(snap) {
      const res = await fetchFn(url, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(snap),
      });
      if (!res.ok) throw new Error(`probe store put ${res.status}`);
    },
  };
}

export function blobsContext(
  event?: { blobs?: string; headers?: Record<string, string | undefined> },
  env: NodeJS.ProcessEnv = process.env,
): BlobsContext | null {
  if (event?.blobs) {
    try {
      const data = JSON.parse(Buffer.from(event.blobs, "base64").toString()) as {
        url?: string;
        token?: string;
      };
      const siteID = event.headers?.["x-nf-site-id"];
      if (data.url && data.token && siteID) {
        return { edgeURL: data.url, token: data.token, siteID };
      }
    } catch {
      /* fall through */
    }
  }
  const raw = env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return null;
  try {
    const ctx = JSON.parse(Buffer.from(raw, "base64").toString()) as {
      edgeURL?: string;
      url?: string;
      token?: string;
      siteID?: string;
    };
    const edgeURL = ctx.edgeURL ?? ctx.url;
    if (edgeURL && ctx.token && ctx.siteID) return { edgeURL, token: ctx.token, siteID: ctx.siteID };
  } catch {
    return null;
  }
  return null;
}
