// Maps existing engine identities to frozen rule codes. Stable string keys make
// missing bindings fail explicitly instead of depending on function identity.
export const STRUCTURE_CHECK_CODES: Record<string, string> = {
  checkFrontmatterPresence: "R001",
  checkName: "R004",
  checkDescription: "R005",
  checkBody: "R006",
  checkBodySize: "R007",
  checkFrontmatterInjection: "R003",
  checkAllowedToolsPortability: "R008",
  checkAdvancedFields: "R009",
  checkUnknownFields: "R010",
  checkSupportingDirs: "R011",
  checkDynamicInjection: "R012",
};

export const DRIFT_CATEGORY_CODES: Record<string, string> = {
  Trigger: "R014",
  Structure: "R015",
  Voice: "R016",
  Example: "R017",
  Guardrail: "R018",
  Clarity: "R019",
};

export const LINT_CATEGORY_CODES: Record<string, string> = {
  clarity: "R022",
  actionability: "R023",
  contradiction: "R024",
  trigger: "R025",
  scope: "R026",
  coverage: "R027",
};

export const SESSION_CODES: Record<string, string> = {
  "sess-001": "R028",
  "sess-002": "R029",
  "sess-003": "R030",
  "sess-004": "R031",
  "sess-005": "R032",
  "sess-006": "R033",
};

export const PARSE_FAILURE_CODE = "R002";
export const SCENARIO_FILE_CODE = "R013";
export const SCRIPT_SECURITY_CODE = "R020";
export const PRINCIPLE_CODE = "R021";
