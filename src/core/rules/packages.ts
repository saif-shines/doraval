import { YAML } from "bun";
import recommendedRaw from "./packages/recommended.yaml" with { type: "text" };
import strictRaw from "./packages/strict.yaml" with { type: "text" };
import minimalRaw from "./packages/minimal.yaml" with { type: "text" };

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

export const BUILTIN_PACKAGES: Record<string, Package> = {
  recommended: parsePackage(recommendedRaw),
  strict: parsePackage(strictRaw),
  minimal: parsePackage(minimalRaw),
};

export function getPackage(name: string): Package | undefined {
  return BUILTIN_PACKAGES[name];
}
