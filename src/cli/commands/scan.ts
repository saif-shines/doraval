import { defineCommand } from "citty";
import pc from "picocolors";
import { runScan, type ScanResult } from "../../core/scan.js";
import { ui, renderCheck, resolveOutputMode, outJson, emitError, nextAction } from "../out.js";
import { exit } from "../render/exit.js";

function renderHuman(r: ScanResult): void {
  ui.blank();
  ui.heading(`doraval v${r.version}`);

  if (r.scope.isHomeDir) {
    ui.warn("You're in your home directory (~). doraval works best inside a project.");
    nextAction("cd into your project, then run `dora`");
    return;
  }
  if (r.scope.isMonorepoSubdir && r.scope.gitRoot) {
    ui.dim(`  Monorepo detected (root: ${r.scope.gitRoot}) — scanning this package only.`);
    if (r.scope.rootAgentFiles.length > 0) {
      ui.dim(`  Also at repo root (not scanned): ${r.scope.rootAgentFiles.join("  ")}`);
    }
  }

  if (r.empty) {
    ui.blank();
    ui.info("  No agent context found.");
    ui.info("  This project has no skills, plugins, rules, or agent config yet.");
    nextAction("dora new    Create your first skill or rule");
    return;
  }

  ui.blank();
  ui.heading("Agent surfaces");
  for (const a of r.agents) {
    const parts = [...a.surfaces.configFiles, ...a.surfaces.skillRoots];
    const label = a.configuredInRepo ? parts.join("  ") : pc.dim("not configured");
    renderCheck(a.configuredInRepo ? "ok" : "warn", `${a.name.padEnd(8)} ${label}`);
  }
  if (r.crossAgent.agentsMd) renderCheck("ok", "cross-agent AGENTS.md present");

  ui.blank();
  ui.heading("Agents installed");
  ui.info(
    "  " +
      r.agents.map((a) => `${a.installed ? pc.green("✓") : pc.dim("✗")} ${a.name}`).join("   ")
  );

  if (r.health.length > 0) {
    ui.blank();
    ui.heading("Health");
    for (const h of r.health) {
      const suffix = h.origin === "authored" ? "" : pc.dim(`  (${h.origin})`);
      renderCheck(
        h.status === "pass" ? "pass" : h.status,
        `${h.path}${suffix}${h.errors[0] ? " — " + h.errors[0].text : ""}`
      );
    }
    ui.blank();
    ui.dim(`  ${r.summary.passed} passed · ${r.summary.failed} failed · ${r.summary.warnings} warnings`);
  }

  if (r.contradictions.length > 0) {
    ui.blank();
    ui.heading("Contradictions");
    for (const c of r.contradictions) {
      const mark = c.severity === "conflict" ? "fail" : "warn";
      const where = c.sources.map((s) => s.file).join(", ");
      renderCheck(mark, `${c.message}${where ? pc.dim(`  (${where})`) : ""}`);
    }
    ui.blank();
    ui.dim(
      `  ${r.contradictions.filter((c) => c.severity === "conflict").length} conflicts · ${r.contradictions.filter((c) => c.severity === "gap").length} gaps`,
    );
  }

  ui.blank();
  ui.heading("Intelligence");
  renderCheck(r.intelligence.judge === "none" ? "warn" : "ok", r.intelligence.detail);

  if (r.suggestions.length > 0) {
    ui.blank();
    ui.heading("Next");
    r.suggestions.forEach((s, i) => {
      ui.info(`  ${i + 1}. ${pc.bold(s.command.padEnd(28))} ${pc.dim(s.title)}`);
    });
  }
  ui.blank();
}

export default defineCommand({
  meta: {
    name: "scan",
    description: "Scan the repo: agent surfaces, skill health, contradictions, next actions",
  },
  args: {
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
    cwd: { type: "string", description: "Directory to scan (for CI and coding agents)" },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    try {
      const result = await runScan((args.cwd as string) || process.cwd());
      if (mode.format === "json") outJson(result);
      else renderHuman(result);
      const hasConflicts = result.contradictions.some((c) => c.severity === "conflict");
      await exit(result.summary.failed > 0 || hasConflicts ? 1 : 0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
