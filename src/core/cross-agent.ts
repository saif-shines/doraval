/**
 * B16 — Cross-agent contradiction detection.
 * Layer 1 structural + Layer 2 heuristic (free). Layer 3 (LLM) deferred to reconcile.
 * Convention extractors are also reused by `memory promote` (B13a step 7).
 */
import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, join, relative } from "path";
import { parseFrontmatter } from "./frontmatter.js";
import { findSkillDirs } from "./skill-discovery.js";
import type { AgentName } from "./agent-detect.js";

// ── Types ──────────────────────────────────────────────────────────

export type ContradictionKind =
  | "conflicting_convention"
  | "missing_coverage"
  | "duplicate_intent"
  | "stale_agents_md"
  | "agent_specific_in_shared";

export type ContradictionSeverity = "conflict" | "gap" | "info";

export type ConventionTopic =
  | "indent"
  | "quotes"
  | "semicolons"
  | "test"
  | "package_manager"
  | "export_style";

export interface ContradictionSource {
  agent: AgentName | "shared";
  file: string;
  line?: number;
  text: string;
}

/** Who acts if this resolution is chosen (B36). */
export type ResolutionActor = "dora" | "you" | "agent";

export interface ResolutionOption {
  action: "update_file" | "create_agents_md" | "skip";
  label: string;
  file?: string;
  recommended?: boolean;
  /** [dora writes] | [you choose] | [agent prompt] */
  actor?: ResolutionActor;
}

export interface Contradiction {
  id: string;
  kind: ContradictionKind;
  severity: ContradictionSeverity;
  message: string;
  sources: ContradictionSource[];
  resolution: ResolutionOption[];
}

/** Infer actor when not set: mechanical writes → dora; skip / vague update → you. */
export function withActors(opts: ResolutionOption[]): ResolutionOption[] {
  return opts.map((o) => {
    if (o.actor) return o;
    if (o.action === "skip") return { ...o, actor: "you" as const };
    if (o.action === "update_file" && !o.file) return { ...o, actor: "you" as const };
    return { ...o, actor: "dora" as const };
  });
}

export function actorTag(actor: ResolutionActor | undefined): string {
  switch (actor) {
    case "dora":
      return "[dora writes]";
    case "agent":
      return "[agent prompt]";
    case "you":
    default:
      return "[you choose]";
  }
}

/** Human primary line: kind + paths — not bare cx-NNN (B36). */
export function formatContradictionHeadline(cx: Contradiction): string {
  const files = [...new Set(cx.sources.map((s) => s.file))];
  if (cx.kind === "duplicate_intent") {
    const name = cx.message.match(/Skill "([^"]+)"/)?.[1] ?? "skill";
    return `duplicate_intent · ${name} (${files.length} copies)`;
  }
  const pathBit =
    files.length === 0
      ? "(no paths)"
      : files.length <= 2
        ? files.join(", ")
        : `${files[0]} +${files.length - 1} more`;
  return `${cx.kind} · ${pathBit}`;
}

export interface ExtractedConvention {
  topic: ConventionTopic;
  value: string;
  raw: string;
  line?: number;
  file: string;
  agent: AgentName | "shared";
}

export interface ConfigSurface {
  agent: AgentName | "shared";
  file: string;
  absPath: string;
  content: string;
}

// ── Convention extractors (exported for promote / reconcile) ───────

const CONVENTION_PATTERNS: {
  topic: ConventionTopic;
  value: string;
  re: RegExp;
}[] = [
  // indent
  { topic: "indent", value: "tabs", re: /\b(?:use\s+)?tabs?\b(?!\s+to\s)/i },
  { topic: "indent", value: "2-space", re: /\b(?:2[-\s]?space|two[-\s]?space|indent(?:ation)?\s*(?:of\s*)?2|2\s*spaces?)\b/i },
  { topic: "indent", value: "4-space", re: /\b(?:4[-\s]?space|four[-\s]?space|indent(?:ation)?\s*(?:of\s*)?4|4\s*spaces?)\b/i },
  // quotes
  { topic: "quotes", value: "single", re: /\b(?:single\s*quotes?|prefer single|use single quotes?)\b/i },
  { topic: "quotes", value: "double", re: /\b(?:double\s*quotes?|prefer double|use double quotes?)\b/i },
  // semicolons
  { topic: "semicolons", value: "always", re: /\b(?:always\s+use\s+semicolons?|semicolons?\s+required|require\s+semicolons?)\b/i },
  { topic: "semicolons", value: "never", re: /\b(?:no\s+semicolons?|never\s+use\s+semicolons?|omit\s+semicolons?|semicolons?\s+(?:are\s+)?optional)\b/i },
  // test runners
  { topic: "test", value: "bun test", re: /\bbun\s+test\b/i },
  { topic: "test", value: "vitest", re: /\bvitest\b/i },
  { topic: "test", value: "jest", re: /\bjest\b/i },
  { topic: "test", value: "pytest", re: /\bpytest\b/i },
  { topic: "test", value: "go test", re: /\bgo\s+test\b/i },
  // package managers
  { topic: "package_manager", value: "bun", re: /\b(?:use\s+)?bun\b(?!\s+test)/i },
  { topic: "package_manager", value: "pnpm", re: /\bpnpm\b/i },
  { topic: "package_manager", value: "yarn", re: /\byarn\b/i },
  { topic: "package_manager", value: "npm", re: /\bnpm\s+(?:i|install|run|ci)\b/i },
  // exports
  { topic: "export_style", value: "named", re: /\b(?:prefer|use|always)\s+named\s+exports?\b/i },
  { topic: "export_style", value: "default", re: /\b(?:prefer|use|always)\s+default\s+exports?\b|\bnever\s+use\s+named\s+exports?\b/i },
  { topic: "export_style", value: "named", re: /\bnever\s+use\s+default\s+exports?\b/i },
];

const CLAUDE_ONLY_MARKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\$ARGUMENTS/, label: "$ARGUMENTS" },
  { pattern: /\$\{CLAUDE_/, label: "${CLAUDE_*}" },
  { pattern: /^@[^\s]+\s*$/m, label: "@import" },
];

/** Extract normalized conventions from a single file's content. */
export function extractConventions(
  content: string,
  file: string,
  agent: AgentName | "shared",
): ExtractedConvention[] {
  const lines = content.split("\n");
  const found: ExtractedConvention[] = [];
  const seen = new Set<string>(); // topic:value

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim() || line.trim().startsWith("#") || line.trim().startsWith("```")) continue;
    for (const p of CONVENTION_PATTERNS) {
      if (!p.re.test(line)) continue;
      const key = `${p.topic}:${p.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        topic: p.topic,
        value: p.value,
        raw: line.trim().slice(0, 160),
        line: i + 1,
        file,
        agent,
      });
    }
  }
  return found;
}

// ── Surface collection ─────────────────────────────────────────────

function listRuleFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".mdc"))
      .map((f) => join(dir, f))
      .filter((p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function readSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/** Collect all agent instruction / rule files under cwd. */
export function collectConfigSurfaces(cwd: string): ConfigSurface[] {
  const out: ConfigSurface[] = [];
  const push = (agent: AgentName | "shared", rel: string) => {
    const abs = join(cwd, rel);
    if (!existsSync(abs)) return;
    const content = readSafe(abs);
    if (content === null) return;
    out.push({ agent, file: rel, absPath: abs, content });
  };

  push("shared", "AGENTS.md");
  push("claude", "CLAUDE.md");
  push("cursor", ".cursorrules");
  push("copilot", ".github/copilot-instructions.md");

  for (const abs of listRuleFiles(join(cwd, ".claude", "rules"))) {
    push("claude", relative(cwd, abs));
  }
  for (const abs of listRuleFiles(join(cwd, ".cursor", "rules"))) {
    push("cursor", relative(cwd, abs));
  }

  return out;
}

// ── Detection ──────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

function contentHash(s: string): string {
  return createHash("sha256").update(s.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 12);
}

function agentsConfigured(surfaces: ConfigSurface[]): Set<AgentName> {
  const s = new Set<AgentName>();
  for (const x of surfaces) {
    if (x.agent !== "shared") s.add(x.agent);
  }
  return s;
}

function resolveOptionsForConflict(sources: ContradictionSource[]): ResolutionOption[] {
  const files = [...new Set(sources.map((s) => s.file))];
  const opts: ResolutionOption[] = [
    {
      action: "create_agents_md",
      label: "Extract shared rule into AGENTS.md (source of truth)",
      file: "AGENTS.md",
      recommended: true,
    },
  ];
  for (const f of files) {
    opts.push({ action: "update_file", label: `Update ${f} to match the other side`, file: f });
  }
  opts.push({ action: "skip", label: "Mark intentional — leave as-is" });
  return withActors(opts);
}

/** Layer 1 + Layer 2 contradiction detection. Pure filesystem, free. */
export function detectContradictions(cwd: string): Contradiction[] {
  const surfaces = collectConfigSurfaces(cwd);
  const contradictions: Contradiction[] = [];
  let id = 1;

  const allConventions = surfaces.flatMap((s) =>
    extractConventions(s.content, s.file, s.agent),
  );

  // ── conflicting_convention: same topic, different values across agents ──
  const byTopic = new Map<ConventionTopic, ExtractedConvention[]>();
  for (const c of allConventions) {
    const list = byTopic.get(c.topic) ?? [];
    list.push(c);
    byTopic.set(c.topic, list);
  }

  for (const [topic, list] of byTopic) {
    const byValue = new Map<string, ExtractedConvention[]>();
    for (const c of list) {
      const arr = byValue.get(c.value) ?? [];
      arr.push(c);
      byValue.set(c.value, arr);
    }
    if (byValue.size < 2) continue;

    // Prefer conflicts that span different agents (or shared vs agent)
    const values = [...byValue.keys()];
    const sources: ContradictionSource[] = [];
    for (const v of values) {
      const first = byValue.get(v)![0]!;
      sources.push({
        agent: first.agent,
        file: first.file,
        line: first.line,
        text: first.raw,
      });
    }
    const agentSet = new Set(sources.map((s) => s.agent));
    if (agentSet.size < 2) {
      // Same agent file(s) disagreeing — still a conflict, lower severity gap if one file only
      // Keep as conflict when values truly differ
    }

    contradictions.push({
      id: `cx-${pad(id++)}`,
      kind: "conflicting_convention",
      severity: "conflict",
      message: `Conflicting ${topic} convention: ${values.map((v) => `"${v}"`).join(" vs ")}`,
      sources,
      resolution: resolveOptionsForConflict(sources),
    });
  }

  // Topics already reported as conflicts — don't also emit missing_coverage noise
  const conflictedTopics = new Set(
    contradictions.filter((c) => c.kind === "conflicting_convention").map((c) => {
      // message: Conflicting indent convention: ...
      const m = c.message.match(/^Conflicting (\S+) convention/);
      return m?.[1] as ConventionTopic | undefined;
    }).filter(Boolean) as ConventionTopic[],
  );

  // ── missing_coverage: multi-agent repo, convention only on one agent surface ──
  const configured = agentsConfigured(surfaces);
  if (configured.size >= 2) {
    const byTopicAgent = new Map<string, Set<AgentName | "shared">>();
    const topicSample = new Map<string, ExtractedConvention>();
    for (const c of allConventions) {
      if (conflictedTopics.has(c.topic)) continue;
      const key = `${c.topic}:${c.value}`;
      const set = byTopicAgent.get(key) ?? new Set();
      set.add(c.agent);
      byTopicAgent.set(key, set);
      if (!topicSample.has(key)) topicSample.set(key, c);
    }

    for (const [key, agents] of byTopicAgent) {
      // Only agent-local conventions (not already in shared AGENTS.md)
      if (agents.has("shared")) continue;
      if (agents.size >= configured.size) continue;
      // Only flag if present on exactly one agent while others exist
      const agentOnly = [...agents].filter((a) => a !== "shared") as AgentName[];
      if (agentOnly.length !== 1) continue;
      const sample = topicSample.get(key)!;
      const missing = [...configured].filter((a) => !agents.has(a));
      contradictions.push({
        id: `cx-${pad(id++)}`,
        kind: "missing_coverage",
        severity: "gap",
        message: `${sample.topic}="${sample.value}" only in ${agentOnly[0]} — missing from ${missing.join(", ")}`,
        sources: [
          {
            agent: sample.agent,
            file: sample.file,
            line: sample.line,
            text: sample.raw,
          },
        ],
        resolution: withActors([
          {
            action: "create_agents_md",
            label: "Promote to AGENTS.md so all agents share it",
            file: "AGENTS.md",
            recommended: true,
          },
          {
            action: "update_file",
            label: `Copy into the other agent config(s)`,
          },
          { action: "skip", label: "Intentional agent-specific rule" },
        ]),
      });
    }
  }

  // ── stale_agents_md: agent file has convention not reflected in AGENTS.md ──
  const agentsMd = surfaces.find((s) => s.file === "AGENTS.md");
  if (agentsMd) {
    const agentsMdNorm = agentsMd.content.toLowerCase();
    const agentOnly = allConventions.filter((c) => c.agent !== "shared");
    const seenTopic = new Set<string>();
    for (const c of agentOnly) {
      const key = `${c.topic}:${c.value}`;
      if (seenTopic.has(key)) continue;
      seenTopic.add(key);
      // crude reflection check: value or topic keyword appears in AGENTS.md
      const reflected =
        agentsMdNorm.includes(c.value.toLowerCase()) ||
        (c.topic === "indent" && /indent|space|tab/.test(agentsMdNorm) && agentsMdNorm.includes(c.value.split("-")[0]!)) ||
        (c.topic === "test" && agentsMdNorm.includes(c.value.toLowerCase())) ||
        (c.topic === "export_style" && agentsMdNorm.includes(c.value === "named" ? "named export" : "default export"));
      if (reflected) continue;
      contradictions.push({
        id: `cx-${pad(id++)}`,
        kind: "stale_agents_md",
        severity: "gap",
        message: `AGENTS.md may be stale: ${c.topic}="${c.value}" lives in ${c.file} but not in AGENTS.md`,
        sources: [
          { agent: c.agent, file: c.file, line: c.line, text: c.raw },
          { agent: "shared", file: "AGENTS.md", text: "(no matching convention found)" },
        ],
        resolution: withActors([
          {
            action: "update_file",
            label: "Add this convention to AGENTS.md",
            file: "AGENTS.md",
            recommended: true,
          },
          { action: "skip", label: "Keep agent-local only" },
        ]),
      });
    }
  }

  // ── agent_specific_in_shared ──
  if (agentsMd) {
    for (const marker of CLAUDE_ONLY_MARKERS) {
      if (!marker.pattern.test(agentsMd.content)) continue;
      const lines = agentsMd.content.split("\n");
      let lineNo: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        if (marker.pattern.test(lines[i]!)) {
          lineNo = i + 1;
          break;
        }
      }
      contradictions.push({
        id: `cx-${pad(id++)}`,
        kind: "agent_specific_in_shared",
        severity: "conflict",
        message: `Claude-only syntax (${marker.label}) in AGENTS.md — other agents won't process it`,
        sources: [
          {
            agent: "shared",
            file: "AGENTS.md",
            line: lineNo,
            text: lineNo ? lines[lineNo - 1]!.trim() : marker.label,
          },
        ],
        resolution: withActors([
          {
            action: "update_file",
            label: "Move Claude-only syntax into CLAUDE.md",
            file: "CLAUDE.md",
            recommended: true,
          },
          {
            action: "update_file",
            label: "Remove the Claude-only marker from AGENTS.md",
            file: "AGENTS.md",
          },
          { action: "skip", label: "Leave as-is" },
        ]),
      });
    }
  }

  // ── duplicate_intent: same skill name, different bodies ──
  const skillDirs = findSkillDirs(cwd);
  const byName = new Map<string, { dir: string; hash: string; snippet: string }[]>();
  for (const dir of skillDirs) {
    const skillPath = join(dir, "SKILL.md");
    const raw = readSafe(skillPath);
    if (raw === null) continue;
    const parsed = parseFrontmatter(raw);
    const name = String(parsed.data["name"] ?? basename(dir)).toLowerCase();
    const hash = contentHash(parsed.content || raw);
    const list = byName.get(name) ?? [];
    list.push({
      dir: relative(cwd, dir) || ".",
      hash,
      snippet: (parsed.content || raw).trim().slice(0, 80).replace(/\n/g, " "),
    });
    byName.set(name, list);
  }
  for (const [name, copies] of byName) {
    if (copies.length < 2) continue;
    const hashes = new Set(copies.map((c) => c.hash));
    if (hashes.size < 2) continue;
    contradictions.push({
      id: `cx-${pad(id++)}`,
      kind: "duplicate_intent",
      severity: "conflict",
      message: `Skill "${name}" has ${copies.length} copies with different bodies`,
      sources: copies.map((c) => ({
        agent: "shared" as const,
        file: join(c.dir, "SKILL.md"),
        text: c.snippet,
      })),
      resolution: withActors([
        {
          action: "update_file",
          label: "Pick one body and sync the others",
          recommended: true,
          actor: "you",
        },
        { action: "skip", label: "Intentional variants", actor: "you" },
      ]),
    });
  }

  // ── MCP asymmetry (structural gap) ──
  const rootMcp = existsSync(join(cwd, ".mcp.json"));
  const cursorMcp =
    existsSync(join(cwd, ".cursor", "mcp.json")) || existsSync(join(cwd, "mcp.json"));
  if (configured.size >= 2 && (rootMcp || cursorMcp)) {
    if (rootMcp && configured.has("cursor") && !cursorMcp) {
      // Cursor often wants .cursor/mcp.json — info only if root .mcp.json exists
      // Many setups share root .mcp.json; only flag when cursor is configured and no mcp surface at all for cursor
    }
    // Flag: one agent configured with MCP file, another agent configured without any MCP
    const hasAnyMcp = rootMcp || cursorMcp;
    if (hasAnyMcp && configured.has("claude") && configured.has("cursor") && rootMcp && !cursorMcp) {
      // soft info — cursor may read root; skip noisy default
    }
  }

  return contradictions;
}
