export interface ValidateResult {
  /** Hard failures — cause exit code 1 */
  errors: string[];
  /** Noted but don't fail the run */
  warnings: string[];
  /** Checks that passed */
  passes: string[];
}

export interface ValidateOptions {
  format: "json" | "table";
  verbose: boolean;
  ci: boolean;
}

export interface Validator {
  /** Unique id: "provider:type", e.g. "claude:skill", "claude:plugin" */
  id: string;
  /** Provider name for --for filtering: "claude", "cursor", "codex" */
  provider: string;
  /** Human-readable name for CLI output headers */
  name: string;
  /** One-line description */
  description: string;
  /** Return true if this validator applies to the given directory */
  detect(dir: string): boolean;
  /** Run all validation rules against the directory */
  validate(dir: string, opts: ValidateOptions): Promise<ValidateResult>;
}