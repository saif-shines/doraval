import { describe, expect, test } from "bun:test";
import { severityLabel } from "./review.js";

describe("severityLabel", () => {
  test("renders info as FYI without changing other severities", () => {
    expect(severityLabel("info")).toBe("FYI");
    expect(severityLabel("error")).toBe("error");
    expect(severityLabel("warning")).toBe("warning");
    expect(severityLabel("pass")).toBe("pass");
  });
});
