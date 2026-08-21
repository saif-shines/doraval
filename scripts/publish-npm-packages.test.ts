import { describe, expect, test } from "bun:test";
import { ensurePublished, publishAccepted, type NpmFn, type NpmResult } from "./publish-npm-packages.ts";

const STAGED_409 = `npm error code E409
npm error 409 Conflict - PUT https://registry.npmjs.org/@hacksmith%2fdoraval-darwin-arm64 - Cannot publish over previously staged version "0.6.20".
`;

function ok(stdout = ""): NpmResult {
  return { status: 0, stdout, stderr: "" };
}
function fail(status: number, stderr: string): NpmResult {
  return { status, stdout: "", stderr };
}

describe("publishAccepted", () => {
  test("status 0 is accepted", () => {
    expect(publishAccepted(ok("+\n"))).toBe(true);
  });
  test("E409 previously staged is accepted (v0.6.20 retry)", () => {
    expect(publishAccepted(fail(1, STAGED_409))).toBe(true);
  });
  test("E403 is not accepted", () => {
    expect(publishAccepted(fail(1, "npm error code E403\nnpm error 403 Forbidden"))).toBe(false);
  });
});

describe("ensurePublished", () => {
  const sleep = () => {};
  const base = { name: "@hacksmith/doraval-darwin-arm64", version: "0.6.20", dir: "/pkg", viewAttempts: 3, sleepMs: 0, sleep };

  test("skips publish when the version is already visible", () => {
    const calls: string[][] = [];
    const npm: NpmFn = (args) => {
      calls.push(args);
      return ok("0.6.20\n");
    };
    expect(ensurePublished({ ...base, npm })).toBe("skipped");
    expect(calls.some((a) => a[0] === "publish")).toBe(false);
  });

  test("publish ok, view lags, then appears", () => {
    let views = 0;
    const npm: NpmFn = (args) => {
      if (args[0] === "publish") return ok("+ published\n");
      views++;
      return views < 3 ? fail(1, "E404") : ok("0.6.20\n");
    };
    expect(ensurePublished({ ...base, npm })).toBe("published");
  });

  test("retry after staged 409 then view appears — the v0.6.20 fail", () => {
    let views = 0;
    const npm: NpmFn = (args) => {
      if (args[0] === "publish") return fail(1, STAGED_409);
      views++;
      return views < 2 ? fail(1, "E404") : ok("0.6.20\n");
    };
    expect(ensurePublished({ ...base, npm })).toBe("published");
  });

  test("real publish error fails immediately", () => {
    const npm: NpmFn = (args) =>
      args[0] === "publish" ? fail(1, "npm error code E403\nnpm error 403 Forbidden") : fail(1, "E404");
    expect(() => ensurePublished({ ...base, npm })).toThrow(/E403/);
  });

  test("409 then never visible still fails", () => {
    const npm: NpmFn = (args) =>
      args[0] === "publish" ? fail(1, STAGED_409) : fail(1, "E404");
    expect(() => ensurePublished({ ...base, npm })).toThrow(/not visible/);
  });
});
