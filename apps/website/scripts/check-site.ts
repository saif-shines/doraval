import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "..", "dist");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(html|txt|md)$/.test(name)) acc.push(p);
  }
  return acc;
}

if (!existsSync(dist)) {
  console.error("check-site: dist/ missing — run blume build first");
  process.exit(1);
}

for (const f of ["llms.txt", "llms-full.txt"] as const) {
  const p = join(dist, f);
  if (!existsSync(p)) {
    console.error(`check-site: missing ${f}`);
    process.exit(1);
  }
  const body = readFileSync(p, "utf8");
  if (!body.includes("https://doraval.thehacksmith.dev")) {
    console.error(`check-site: ${f} lacks absolute production URLs`);
    process.exit(1);
  }
}

// Ban list: retired instructional CLI strings (B27)
const ban = /\bdora (validate|check|eval|drift|init|journal)\b/;
const offenders: string[] = [];
for (const file of walk(dist)) {
  const text = readFileSync(file, "utf8");
  if (ban.test(text)) offenders.push(file);
}

if (offenders.length) {
  console.error("check-site: banned command strings in:");
  for (const o of offenders) console.error(" -", o);
  process.exit(1);
}

console.log("check-site: ok");
