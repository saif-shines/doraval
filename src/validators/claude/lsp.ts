import { existsSync } from "fs";
import { resolve } from "path";
import type { Validator, ValidateResult, ValidateOptions } from "../types.js";

export const claudeLspValidator: Validator = {
  id: "claude:lsp",
  provider: "claude",
  name: "Claude LSP Servers",
  description: "Validates .lsp.json (or plugin.json lspServers): language server configs with required command + extensionToLanguage; optional transport, env, settings, diagnostics etc. (binaries installed separately)",

  detect(dir: string): boolean {
    return (
      existsSync(resolve(dir, ".lsp.json")) ||
      // Also detect if declared inline in a plugin manifest (the plugin validator will have noted it)
      existsSync(resolve(dir, ".claude-plugin", "plugin.json"))
    );
  },

  async validate(dir: string, _opts: ValidateOptions): Promise<ValidateResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passes: string[] = [];

    // Prefer dedicated .lsp.json; also look for inline under manifest for plugins
    let cfg: Record<string, unknown> | null = null;
    const lspPath = resolve(dir, ".lsp.json");
    if (existsSync(lspPath)) {
      try {
        cfg = JSON.parse(await Bun.file(lspPath).text());
        passes.push(".lsp.json is valid JSON");
      } catch {
        errors.push(".lsp.json is invalid JSON");
        return { errors, warnings, passes };
      }
    } else {
      // Try inline from plugin manifest (best effort)
      const manifestPath = resolve(dir, ".claude-plugin", "plugin.json");
      if (existsSync(manifestPath)) {
        try {
          const m = JSON.parse(await Bun.file(manifestPath).text());
          if (m && m.lspServers && typeof m.lspServers === "object") {
            cfg = m.lspServers as Record<string, unknown>;
            passes.push("lspServers present inline in plugin.json");
          }
        } catch {
          // intentional: optional inline lspServers parse
        }
      }
    }

    if (!cfg) {
      // detect may have been optimistic via manifest; if no actual lsp config, just no-op
      if (!existsSync(lspPath)) {
        // nothing to validate
        return { errors, warnings, passes };
      }
    }

    if (cfg && typeof cfg === "object") {
      const langs = Object.keys(cfg);
      passes.push(`${langs.length} language server(s) configured`);
      for (const lang of langs) {
        const entry: any = (cfg as any)[lang];
        if (!entry || !entry.command) {
          errors.push(`lsp "${lang}": "command" (the LSP binary) is required`);
        }
        if (!entry.extensionToLanguage || typeof entry.extensionToLanguage !== "object") {
          errors.push(`lsp "${lang}": "extensionToLanguage" map is required (e.g. { ".ts": "typescript" })`);
        } else {
          passes.push(`lsp "${lang}": has extensionToLanguage mapping`);
        }
        if (entry.diagnostics === false) {
          passes.push(`lsp "${lang}": diagnostics disabled (navigation only)`);
        }
      }
    }

    warnings.push("Reminder: the actual language server binary (gopls, pyright, etc.) must be installed separately on PATH. See /plugin errors tab if \"Executable not found\".");

    return { errors, warnings, passes };
  },
};
