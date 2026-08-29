import { describe, expect, test } from "bun:test";
import { blobsContext, JsonProbeStore, memoryIo, remoteIo } from "./store.ts";

describe("probe store", () => {
  test("hello survives a new store instance", async () => {
    const io = memoryIo();
    const a = new JsonProbeStore(io);
    const row = await a.create("org_1");
    const b = new JsonProbeStore(io);
    expect((await b.get(row.id))?.status).toBe("pending");
    expect((await b.ack(row.id, "org_1"))?.status).toBe("acked");
    const c = new JsonProbeStore(io);
    expect((await c.get(row.id))?.status).toBe("acked");
  });

  test("blobsContext reads the Lambda event", () => {
    const blobs = Buffer.from(JSON.stringify({ url: "https://blob.example", token: "t" })).toString(
      "base64",
    );
    expect(
      blobsContext({ blobs, headers: { "x-nf-site-id": "site_1" } }),
    ).toEqual({ edgeURL: "https://blob.example", token: "t", siteID: "site_1" });
    expect(blobsContext({ blobs })).toBeNull();
  });

  test("remoteIo loads empty on 404 and writes JSON", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
      if (method === "GET") return new Response(null, { status: 404 });
      return new Response(null, { status: 200 });
    };
    const io = remoteIo(
      { edgeURL: "https://blob.example", token: "t", siteID: "site_1" },
      fetchFn,
    );
    const store = new JsonProbeStore(io);
    const row = await store.create("org_1");
    expect(row.id).toBe("prb_1");
    expect(calls[0]?.url).toBe("https://blob.example/site_1/probes/state");
    expect(calls[1]?.method).toBe("PUT");
    expect(calls[1]?.body).toContain("prb_1");
  });
});
