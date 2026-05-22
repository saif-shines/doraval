export interface SkillModel {
  data: Record<string, unknown>;
  content: string;
}

export interface SkillValidateContext {
  existingDirs: string[];
}

export interface SkillValidateResult {
  errors: string[];
  warnings: string[];
  passes: string[];
}

const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const OPTIONAL_DIRS = ["references", "scripts", "assets"] as const;

export function validateSkillModel(
  model: SkillModel,
  context: SkillValidateContext = { existingDirs: [] }
): SkillValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const passes: string[] = [];

  if (Object.keys(model.data).length === 0) {
    errors.push("YAML frontmatter is empty or missing");
  } else {
    passes.push("YAML frontmatter present and parseable");
  }

  if (!model.data.name) {
    errors.push('Missing required field: "name"');
  } else {
    const name = String(model.data.name);
    if (!NAME_REGEX.test(name)) {
      errors.push(
        `Invalid name format: "${name}" — must be kebab-case (a-z, 0-9, hyphens)`
      );
    } else if (name.length < 2 || name.length > 64) {
      errors.push(
        `Name length out of range: ${name.length} chars (must be 2-64)`
      );
    } else {
      passes.push(`name: "${name}"`);
    }
  }

  if (!model.data.description) {
    errors.push('Missing required field: "description"');
  } else {
    passes.push("description field present");
  }

  if (!model.content.trim()) {
    errors.push("Markdown body is empty");
  } else {
    passes.push("Markdown body is non-empty");
  }

  for (const dir of OPTIONAL_DIRS) {
    if (context.existingDirs.includes(dir)) {
      passes.push(`${dir}/ directory exists`);
    }
  }

  return { errors, warnings, passes };
}
