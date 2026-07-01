/**
 * @deprecated Use static-skill-checks.ts or the validate command.
 * This module re-exports everything from static-skill-checks.ts for backward compatibility.
 */
export {
  checkTrigger,
  checkStructure,
  checkVoice,
  checkExample,
  checkGuardrail,
  checkClarity,
  analyzeDrift,
} from "./static-skill-checks.js";

export type {
  DriftItem,
  SkillDriftInput,
  SkillDriftResult,
  DriftCheck,
} from "./static-skill-checks.js";
