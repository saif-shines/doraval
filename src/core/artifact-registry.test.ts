import { describe, it, expect } from "bun:test";
import { getArtifactType, listArtifactTypes } from "./artifact-registry.js";
import type { SessionPrimitives } from "./session-parse.js";

describe("artifact-registry", () => {
  it("listArtifactTypes returns exactly ['skill']", () => {
    const types = listArtifactTypes();
    expect(types).toEqual(["skill"]);
  });

  it("getArtifactType('skill') returns a defined object", () => {
    const skillType = getArtifactType("skill");
    expect(skillType).toBeDefined();
    expect(skillType?.type).toBe("skill");
    expect(typeof skillType?.load).toBe("function");
    expect(typeof skillType?.detectUsageInSession).toBe("function");
    expect(typeof skillType?.defaultRubric).toBe("function");
  });

  it("getArtifactType('unknown-type') returns undefined", () => {
    const unknown = getArtifactType("unknown-type");
    expect(unknown).toBeUndefined();
  });

  describe("skill type detectUsageInSession", () => {
    const skillType = getArtifactType("skill");

    it("matches exact skill name", () => {
      const session: SessionPrimitives = {
        sessionId: "test",
        model: "test",
        agent: "test",
        cwd: "/test",
        toolCalls: [],
        toolCallCounts: {},
        skillsInvoked: ["my-skill"],
        userMessages: [],
        userTurnCount: 0,
        assistantText: [],
      };
      expect(skillType?.detectUsageInSession(session, "my-skill")).toBe(true);
    });

    it("matches skill name with colon suffix pattern", () => {
      const session: SessionPrimitives = {
        sessionId: "test",
        model: "test",
        agent: "test",
        cwd: "/test",
        toolCalls: [],
        toolCallCounts: {},
        skillsInvoked: ["namespace:my-skill"],
        userMessages: [],
        userTurnCount: 0,
        assistantText: [],
      };
      expect(skillType?.detectUsageInSession(session, "my-skill")).toBe(true);
    });

    it("matches skill name with slash suffix pattern", () => {
      const session: SessionPrimitives = {
        sessionId: "test",
        model: "test",
        agent: "test",
        cwd: "/test",
        toolCalls: [],
        toolCallCounts: {},
        skillsInvoked: ["path/to/my-skill"],
        userMessages: [],
        userTurnCount: 0,
        assistantText: [],
      };
      expect(skillType?.detectUsageInSession(session, "my-skill")).toBe(true);
    });

    it("returns false when skill is not invoked", () => {
      const session: SessionPrimitives = {
        sessionId: "test",
        model: "test",
        agent: "test",
        cwd: "/test",
        toolCalls: [],
        toolCallCounts: {},
        skillsInvoked: ["other-skill"],
        userMessages: [],
        userTurnCount: 0,
        assistantText: [],
      };
      expect(skillType?.detectUsageInSession(session, "my-skill")).toBe(false);
    });

    it("returns false when skillsInvoked is empty", () => {
      const session: SessionPrimitives = {
        sessionId: "test",
        model: "test",
        agent: "test",
        cwd: "/test",
        toolCalls: [],
        toolCallCounts: {},
        skillsInvoked: [],
        userMessages: [],
        userTurnCount: 0,
        assistantText: [],
      };
      expect(skillType?.detectUsageInSession(session, "my-skill")).toBe(false);
    });
  });

  describe("skill type defaultRubric", () => {
    const skillType = getArtifactType("skill");

    it("returns claude platform context by default", () => {
      const rubric = skillType?.defaultRubric();
      expect(rubric).toBeDefined();
      expect(typeof rubric).toBe("string");
      expect(rubric?.length).toBeGreaterThan(0);
      expect(rubric).toContain("Claude Code");
    });

    it("returns claude platform context when 'claude' is requested", () => {
      const rubric = skillType?.defaultRubric("claude");
      expect(rubric).toBeDefined();
      expect(typeof rubric).toBe("string");
      expect(rubric?.length).toBeGreaterThan(0);
      expect(rubric).toContain("Claude Code");
    });

    it("returns appropriate platform context for other platforms", () => {
      const rubric = skillType?.defaultRubric("codex");
      expect(rubric).toBeDefined();
      expect(typeof rubric).toBe("string");
      expect(rubric?.length).toBeGreaterThan(0);
    });
  });
});
