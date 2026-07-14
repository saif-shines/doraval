/**
 * Thin wrapper — prefer `dora new --for codex`.
 * Kept for existing `dora codex new` invocations (B38).
 */
import { createProviderNewCommand } from "../provider-new.js";
import { decidePath } from "../../../core/scaffold-wizard.js";
import { writeScaffold } from "../../../core/scaffold.js";
import { ui } from "../../out.js";
import { exit } from "../../render/exit.js";

export type { Intent } from "../../../core/scaffold-wizard.js";
export { decidePath } from "../../../core/scaffold-wizard.js";

/** @deprecated Use writeScaffold from core/scaffold.js */
export async function scaffold(
  decision: ReturnType<typeof decidePath>,
  _ctx?: unknown,
  migrateContent?: string,
) {
  const result = writeScaffold(decision, migrateContent);
  if (!result.ok) {
    ui.fail(result.error);
    return await exit(1);
  }
}

export default createProviderNewCommand("codex");
