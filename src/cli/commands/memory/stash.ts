import { defineCommand } from "citty";
import { resolve } from "path";
import { listStashCandidates, stashFile } from "../../../core/memory-artifacts.js";
import { getProjectSlug } from "../../../core/memory-config.js";
import { runJournalMigrationIfNeeded } from "../../../core/memory-migrate.js";
import { reportMigration } from "./migration-report.js";
import { canPromptInteractively } from "../fix.js";
import { ui, resolveOutputMode, outJson, emitError, summaryLine } from "../../out.js";
import { exit } from "../../render/exit.js";
import {
  STASH_PICKER_CAP,
  defaultWhichFzf,
  pickStashWithClack,
  pickStashWithFzf,
} from "./stash-picker.js";

export default defineCommand({
  meta: { name: "stash", description: "Stash a gitignored/untracked file into project memory" },
  args: {
    file: { type: "positional", description: "File to stash (relative to cwd)", required: false },
    format: { type: "string", description: "Output format: table | json", default: "table" },
    cwd: { type: "string", description: "Working directory override" },
    fzf: {
      type: "boolean",
      description:
        "Use fzf for fuzzy multi-select of the full candidate list (requires fzf on PATH)",
      default: false,
    },
  },
  async run({ args }) {
    const mode = resolveOutputMode({ format: args.format as string, ci: false });
    const migration = runJournalMigrationIfNeeded();
    if (mode.format !== "json") reportMigration(migration);
    const cwd = args.cwd ? resolve(args.cwd as string) : process.cwd();
    const slug = getProjectSlug(cwd);
    const useFzf = Boolean(args.fzf);

    try {
      let targets: string[];

      if (args.file) {
        targets = [String(args.file)];
      } else {
        const candidates = listStashCandidates(cwd);
        if (candidates.length === 0) {
          ui.blank();
          summaryLine("No gitignored or untracked files found to stash.");
          await exit(0);
          return;
        }

        const interactive = canPromptInteractively(false, false, mode.format);
        if (!interactive) {
          emitError(
            new Error(
              "Bare `memory stash` requires an interactive terminal — pass a file explicitly (e.g. `dora memory stash notes.md`) in CI.",
            ),
            mode,
          );
          await exit(2);
          return;
        }

        if (useFzf) {
          try {
            targets = pickStashWithFzf(candidates);
          } catch (e) {
            emitError(e, mode);
            await exit(2);
            return;
          }
          if (targets.length === 0) {
            ui.blank();
            summaryLine("No files selected — nothing stashed.");
            await exit(0);
            return;
          }
        } else {
          targets = await pickStashWithClack(candidates, {
            cap: STASH_PICKER_CAP,
            onTruncated: (shown, total) => {
              const fzfHint = defaultWhichFzf()
                ? " · or `dora memory stash --fzf` for full fuzzy list"
                : " · or pass a path; install fzf for `dora memory stash --fzf`";
              ui.dim(`  Showing ${shown} of ${total} candidates — pass a path to stash others${fzfHint}.`);
            },
          });
          if (targets.length === 0) {
            ui.blank();
            summaryLine("No files selected — nothing stashed.");
            await exit(0);
            return;
          }
        }
      }

      const stashed: string[] = [];
      const refused: string[] = [];
      const warnings: string[] = [];

      for (const rel of targets) {
        const absPath = resolve(cwd, rel);
        const result = stashFile(cwd, slug, absPath);
        if (result.ok) {
          stashed.push(result.relativePath);
          if (result.warn) warnings.push(result.warn);
        } else {
          refused.push(result.error);
        }
      }

      if (mode.format === "json") {
        outJson({ stashed, refused, warnings });
        await exit(refused.length > 0 ? 1 : 0);
        return;
      }

      ui.blank();
      for (const rel of stashed) ui.success(`Stashed: ${rel}`);
      for (const w of warnings) ui.write(`  ⚠ ${w}`);
      for (const err of refused) ui.fail(err);
      ui.blank();
      summaryLine(`${stashed.length} stashed, ${refused.length} refused`);

      await exit(refused.length > 0 ? 1 : 0);
    } catch (e) {
      emitError(e, mode);
      await exit(2);
    }
  },
});
