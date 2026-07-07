/**
 * Doraval error catalog (plan item B5).
 * Code families: E-VAL (validation), E-CFG (config), E-NET (network/LLM),
 * E-JRN (journal/memory), E-SCF (scaffold), E-UPD (update), E-PRE (prerequisite).
 * Every user-facing error should be (or wrap into) a DoravalError so the CLI
 * can render context → problem → solution → next command, plus JSON on stderr.
 */

export interface DoravalErrorOptions {
  code: string;
  message: string;
  suggestion?: string;
  docUrl?: string;
  context?: string;
}

export class DoravalError extends Error {
  readonly code: string;
  readonly suggestion?: string;
  readonly docUrl?: string;
  readonly context?: string;

  constructor(opts: DoravalErrorOptions) {
    super(opts.message);
    this.name = new.target.name;
    this.code = opts.code;
    this.suggestion = opts.suggestion;
    this.docUrl = opts.docUrl;
    this.context = opts.context;
  }
}

function familySubclass(name: string, prefix: string) {
  return class extends DoravalError {
    constructor(opts: DoravalErrorOptions) {
      if (!opts.code.startsWith(prefix)) {
        throw new Error(`${name} requires an ${prefix.slice(0, -1)} code, got ${opts.code}`);
      }
      super(opts);
      this.name = name;
    }
  };
}

export const ValidationError = familySubclass("ValidationError", "E-VAL-");
export const ConfigError = familySubclass("ConfigError", "E-CFG-");
export const NetworkError = familySubclass("NetworkError", "E-NET-");
export const MemoryError = familySubclass("MemoryError", "E-JRN-");
export const ScaffoldError = familySubclass("ScaffoldError", "E-SCF-");
export const UpdateError = familySubclass("UpdateError", "E-UPD-");
export const PrerequisiteError = familySubclass("PrerequisiteError", "E-PRE-");

export function isDoravalError(e: unknown): e is DoravalError {
  return e instanceof DoravalError;
}

export function errorToJson(e: DoravalError): {
  error: { code: string; message: string; suggestion?: string; docUrl?: string; context?: string };
} {
  return {
    error: {
      code: e.code,
      message: e.message,
      ...(e.suggestion ? { suggestion: e.suggestion } : {}),
      ...(e.docUrl ? { docUrl: e.docUrl } : {}),
      ...(e.context ? { context: e.context } : {}),
    },
  };
}
