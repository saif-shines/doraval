/**
 * CI-only, runs right before `npm publish` of the main package (plan B1).
 * Injects the five platform packages as EXACT-version optionalDependencies.
 * Never committed: local installs must not try to fetch these.
 */
import { TARGETS } from "./platform-packages.ts";

export function injectPlatformDeps(
  pkg: Record<string, unknown>,
  version: string
): Record<string, unknown> {
  pkg.optionalDependencies = Object.fromEntries(
    TARGETS.map((t) => [`@hacksmith/doraval-${t.suffix}`, version])
  );
  return pkg;
}

if (import.meta.main) {
  const pkg = await Bun.file("package.json").json();
  injectPlatformDeps(pkg, pkg.version as string);
  await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Injected ${TARGETS.length} platform optionalDependencies @ ${pkg.version}`);
}
