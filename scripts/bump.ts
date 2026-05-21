#!/usr/bin/env bun

/**
 * Bump version across all packages:
 *   bun run bump patch   →  0.0.6 → 0.0.7
 *   bun run bump minor   →  0.0.6 → 0.1.0
 *   bun run bump major   →  0.0.6 → 1.0.0
 *   bun run bump 1.2.3   →  sets exact version
 */

const files = [
  "package.json",
  "jsr.json",
  "apps/website/package.json",
];

function bumpVersion(current: string, type: string): string {
  if (/^\d+\.\d+\.\d+$/.test(type)) return type;

  const [major, minor, patch] = current.split(".").map(Number);
  switch (type) {
    case "patch": return `${major}.${minor}.${patch + 1}`;
    case "minor": return `${major}.${minor + 1}.0`;
    case "major": return `${major + 1}.0.0`;
    default:
      console.error(`Usage: bun run bump <patch|minor|major|x.y.z>`);
      process.exit(1);
  }
}

const type = process.argv[2];
if (!type) {
  console.error("Usage: bun run bump <patch|minor|major|x.y.z>");
  process.exit(1);
}

const rootPkg = await Bun.file("package.json").json();
const current = rootPkg.version;
const next = bumpVersion(current, type);

for (const path of files) {
  const file = Bun.file(path);
  const json = await file.json();
  json.version = next;
  await Bun.write(file, JSON.stringify(json, null, 2) + "\n");
}

console.log(`${current} → ${next}`);
console.log(files.map((f) => `  ✓ ${f}`).join("\n"));