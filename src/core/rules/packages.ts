import { YAML } from "bun";

// Inline the YAML. `import … with { type: "text" }` embeds for `bun --compile`
// but JSR/Deno reject it (unstable-raw-import). Keep the .yaml files as the
// edit surface; packages.test.ts checks they still match.

const recommendedRaw = `name: recommended
description: Sensible defaults for most agent-context files
rules:
  - R001
  - R002
  - R003
  - R004
  - R005
  - R006
  - R007
  - R008
  - R010
  - R012
  - R013
  - R014
  - R015
  - R016
  - R017
  - R018
  - R019
  - R020
  - R021
  - R022
  - R023
  - R024
  - R025
  - R026
  - R027
  - R028
  - R029
  - R030
  - R031
  - R032
  - R033
  - R034
`;

const strictRaw = `name: strict
description: Every rule enabled at its default severity
rules:
  - R001
  - R002
  - R003
  - R004
  - R005
  - R006
  - R007
  - R008
  - R009
  - R010
  - R011
  - R012
  - R013
  - R014
  - R015
  - R016
  - R017
  - R018
  - R019
  - R020
  - R021
  - R022
  - R023
  - R024
  - R025
  - R026
  - R027
  - R028
  - R029
  - R030
  - R031
  - R032
  - R033
  - R034
`;

const minimalRaw = `name: minimal
description: Just don't let me ship broken context
rules:
  - R001
  - R002
  - R003
  - R006
  - R020
`;

export interface Package {
  name: string;
  description: string;
  rules: string[];
}

export const DEFAULT_PACKAGE = "recommended";

function parsePackage(raw: string): Package {
  const pkg = YAML.parse(raw) as Package;
  return { name: pkg.name, description: pkg.description, rules: pkg.rules };
}

export const BUILTIN_PACKAGES: Record<"recommended" | "strict" | "minimal", Package> = {
  recommended: parsePackage(recommendedRaw),
  strict: parsePackage(strictRaw),
  minimal: parsePackage(minimalRaw),
};

export function getPackage(name: string): Package | undefined {
  return BUILTIN_PACKAGES[name as keyof typeof BUILTIN_PACKAGES];
}
