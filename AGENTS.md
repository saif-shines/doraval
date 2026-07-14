# Doraval — agent conditions

## Before you write code (ponytail ladder)

Stop at the first rung that holds:

1. **YAGNI** — Does this need to exist? Speculative = skip, say so in one line.
2. **Reuse** — Already in this repo? Use it.
3. **Stdlib / Bun / platform** — Prefer built-ins over new helpers.
4. **Installed deps** — Use what is already in `package.json`. Never add a dep for a few lines.
5. **One line** — Prefer the shortest correct form.
6. **Only then** — Minimum code that works. Fewest files. Deletion > addition.

Never lazy about: trust-boundary validation, data-loss error paths, security, or understanding the full call path before editing.

Non-trivial logic leaves **one** small test. No version bumps unless the user asks for a release (see `WIP.md`).

## Skills

Look up project/system skills when deciding. Mention 1–2 options to the user when useful.

- CLI surfaces: `cli-developer`, `devrel-tooling`, `nodejs-cli-best-practices`
- Lean code: `ponytail`, `karpathy-guidelines`, `pragmatic-fp`
- Audits: `improve` (plans only — does not implement)

## Release / npm platform packages (learned the hard way)

**Incident source:** Claude session `bdd5e085` (2026-07-08/09, B1 first ship) + commits `9389365`, recovery for v0.5.0–0.5.2. Same failure pattern on **v0.6.0**.

### Symptom

CI `publish-npm` logs:

```
npm notice publish Signed provenance statement…   # only when --provenance is on
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@hacksmith%2fdoraval-darwin-arm64
```

Main `@hacksmith/doraval` may still publish. Platform packages stay on an older version → **broken install**: optionalDeps point at missing binaries; stub says "platform package is not installed."

### Wrong diagnosis (do not repeat)

"Granular access token can't create new package names under the scope" — **disproven**. Same token published the packages successfully from a local shell.

### Confirmed diagnosis

- Failure is **auth/permissions on the five platform packages**, not a missing package-ACL list in the general sense.
- **`npm publish --access public` without `--provenance` from a local shell works** when the token can publish (or you pass `--otp=<code>` for 2FA).
- CI historically failed with `--provenance` on platforms (provenance signed, then PUT 404). CI was patched to drop provenance for platforms only (`9389365`); main still uses `--provenance`.
- **v0.6.0 recovery (2026-07-14):** whoami worked but publish returned **EOTP** until `npm publish --otp=…`. All five platforms published locally from GH release binaries. npm may return **E404** when the token lacks write/Bypass-2FA — do not misread that as "package missing."
- If platforms still 404/EOTP in CI, **do not ship main alone** and do not invent new version bumps — recover with the local procedure below. CI `NPM_TOKEN` should be a granular token with **write + Bypass 2FA** on all five platform packages (and main).

### Recovery procedure (when CI platform publish fails)

Do **not** bump the version. Reuse the release tag's binaries.

```bash
# 1) Download GitHub Release artifacts for the tag (e.g. v0.6.0)
TAG=v0.6.0
VERSION=${TAG#v}
SCRATCH=$(mktemp -d)
mkdir -p "$SCRATCH/artifacts"
for f in doraval-darwin-arm64 doraval-darwin-x64 doraval-linux-x64 \
         doraval-linux-arm64 doraval-win32-x64.exe; do
  curl -fsSL "https://github.com/saif-shines/doraval/releases/download/${TAG}/${f}" \
    -o "$SCRATCH/artifacts/${f}"
done

# 2) Assemble platform packages (same as CI)
bun run scripts/platform-packages.ts "$VERSION" "$SCRATCH/artifacts" "$SCRATCH/platform-packages"

# 3) Publish EACH platform package LOCALLY — no --provenance
#    If EOTP: npm publish --access public --otp=XXXXXX  (or use a Bypass-2FA GAT)
for dir in "$SCRATCH/platform-packages"/*/; do
  (cd "$dir" && npm publish --access public ${OTP:+--otp="$OTP"})
done

# 4) Verify all five exist at $VERSION
for p in darwin-arm64 darwin-x64 linux-x64 linux-arm64 win32-x64; do
  npm view "@hacksmith/doraval-$p@$VERSION" version
done

# 5) Main package: only if missing for this version
#    bun run scripts/prepare-npm-publish.ts && npm publish --access public --provenance
#    then: git checkout -- package.json   # NEVER commit injected optionalDependencies
```

**Rules:**

- Never commit publish-time `optionalDependencies` injection (`prepare-npm-publish.ts` is CI-only).
- Never publish main until all five platform packages are on the registry (workflow is fail-fast; keep it that way).
- Prefer binaries from the **GitHub Release for that tag**, not a stale local smoke binary (session bug: mismatched darwin-arm64 content vs other arches).
- After recovery: verify with real install (`npm install @hacksmith/doraval@$VERSION` in a clean dir, then run `doraval --version`) — `npx` can hide optionalDep failures.

### Workflow file

`.github/workflows/release.yml` — platforms: `npm publish --access public` (no provenance); main: with provenance; fail-fast + registry check after each platform.

## Product / agent docs (context only — do not derail the task)

- https://code.claude.com/llms.txt
- https://developers.openai.com/llms.txt
- https://docs.github.com/llms.txt
- https://cursor.com/docs/plugins
- https://github.com/openai/skills/tree/main/skills/.curated/openai-docs
- https://www.termcn.dev/llms.txt

## Resume

**Tracker:** `WIP.md` (only progress pin). See release status there for v0.6.0 npm platform gap.
