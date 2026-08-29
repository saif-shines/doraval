import { describe, expect, test } from "bun:test";
import { runProbe } from "./probe.ts";

describe("runProbe", () => {
  test("no key", async () => {
    const r = await runProbe({
      key: undefined,
      site: "https://example.test",
      fetch: async () => new Response("no"),
    });
    expect(r.status).toBe("no-key");
  });

  test("bad key", async () => {
    const r = await runProbe({
      key: "x",
      site: "https://example.test",
      fetch: async () => new Response("{}", { status: 401 }),
    });
    expect(r.status).toBe("bad-key");
  });

  test("hello then ack", async () => {
    let n = 0;
    const r = await runProbe({
      key: "good",
      site: "https://example.test",
      timeoutMs: 1_000,
      pollMs: 1,
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/probe") && n === 0) {
          n++;
          return Response.json({ id: "prb_1", payload: "hello", status: "pending" });
        }
        return Response.json({ id: "prb_1", payload: "hello", status: "acked" });
      },
    });
    expect(r).toEqual({ status: "acked", id: "prb_1" });
  });

  test("timeout stays pending", async () => {
    const r = await runProbe({
      key: "good",
      site: "https://example.test",
      timeoutMs: 5,
      pollMs: 1,
      now: (() => {
        let t = 0;
        return () => (t += 3);
      })(),
      sleep: async () => {},
      fetch: async (input) => {
        if (String(input).endsWith("/probe")) {
          return Response.json({ id: "prb_1", status: "pending" });
        }
        return Response.json({ id: "prb_1", status: "pending" });
      },
    });
    expect(r.status).toBe("timeout");
    expect(r.id).toBe("prb_1");
  });
});
