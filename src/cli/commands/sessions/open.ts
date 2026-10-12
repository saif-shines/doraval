import { defineCommand } from "citty";
import { openDetached } from "../../../core/platform-open.js";
import { startSessionPage } from "../../../core/session-page/server.js";
import { ui, emitError } from "../../out.js";
import { exit } from "../../render/exit.js";

export default defineCommand({
  meta: { name: "open", description: "Open the local page for Claude, Grok, Cursor, Codex, Copilot, and Gemini CLI" },
  async run() {
    try {
      const server = startSessionPage(0);
      const url = `http://127.0.0.1:${server.port}/`;
      ui.blank();
      ui.write(`  Session page: ${url}`);
      ui.write("  Reading your home folder. Leave this running. Ctrl+C stops it.");
      ui.blank();
      openDetached(url);
      await new Promise(() => {});
    } catch (e) {
      emitError(e, { format: "table", ci: false });
      await exit(1);
    }
  },
});
