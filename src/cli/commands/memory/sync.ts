import { defineCommand } from "citty";
import { syncMemory } from "../../../core/memory-sync.js";
import { runJournalMigrationIfNeeded } from "../../../core/memory-migrate.js";
import { reportMigration } from "./migration-report.js";
import { PrerequisiteError, MemoryError } from "../../../core/errors.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine } from "../../out.js";
import { preflight, stage, memorySyncPreflightMessage } from "../../preflight.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: {
    name: "sync",
    description:
      "Sync project memory to a private git repo (first run creates/clones; later runs commit + pull --rebase + push)",
  },
  args: {
    repo: {
      type: "string",
      description: "Remote: owner/name (GitHub) or any git URL/path. Default: {gh-user}/dora-memory",
    },
    message: {
      type: "string",
      alias: "m",
      description: "Commit message when there are local changes",
    },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    ci: { type: "boolean", description: "Machine mode (implies --format json)", default: false },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: args.ci as boolean });
    preflight(mode, memorySyncPreflightMessage());
    const migration = runJournalMigrationIfNeeded();
    if (mode.format !== "json") reportMigration(migration);

    try {
      const result = syncMemory({
        repo: args.repo ? String(args.repo) : undefined,
        message: args.message ? String(args.message) : undefined,
      });

      if (!result.ok) {
        if (result.code.startsWith("E-PRE-")) {
          throw new PrerequisiteError({
            code: result.code,
            message: result.error,
            suggestion:
              result.code === "E-PRE-001"
                ? "Install git and the GitHub CLI (gh), then: gh auth login"
                : "gh auth login",
            context: "dora memory sync backs up principles and stashed artifacts to a private git repo.",
          });
        }
        throw new MemoryError({
          code: result.code.startsWith("E-JRN-") ? result.code : "E-JRN-000",
          message: result.error,
          suggestion: "dora memory sync --repo owner/name",
          context: "dora memory sync",
        });
      }

      if (mode.format === "json") {
        outJson({
          repo: result.repo,
          gitUrl: result.gitUrl,
          committed: result.committed,
          pulled: result.pulled,
          pushed: result.pushed,
          bootstrapped: result.bootstrapped,
          message: result.message,
        });
        await exit(0);
        return;
      }

      stage(mode, "Sync finished.");
      ui.blank();
      ui.success(`Memory sync complete — ${result.message}`);
      ui.write(`  remote: ${result.repo}`);
      if (result.bootstrapped) {
        ui.write("  first sync: local memory repo is now a git clone");
      }
      ui.blank();
      summaryLine(
        [
          result.bootstrapped ? "bootstrapped" : null,
          result.committed ? "committed" : null,
          result.pulled ? "pulled" : null,
          result.pushed ? "pushed" : null,
          !result.bootstrapped && !result.committed && !result.pulled && !result.pushed
            ? "up to date"
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
      ui.blank();
      await exit(0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
