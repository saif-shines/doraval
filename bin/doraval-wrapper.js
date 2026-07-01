#!/usr/bin/env node
/**
 * doraval-wrapper.js
 *
 * Runs under Node (≥ 14.18, ESM). Resolves a Bun binary in order:
 *   1. PATH bun       — if version ≥ MIN_BUN_VERSION (preferred; user-managed)
 *   2. Managed cache  — <XDG_CACHE_HOME|~/.cache>/doraval/bun/bin/bun (if ≥ min)
 *   3. Neither / too old — prompt for consent, install/upgrade cache, then exec.
 *
 * Bun.YAML (used for config.yml and frontmatter) requires Bun ≥ 1.3.0.
 * Older managed caches (e.g. 1.2.0) must not win over a newer PATH install.
 *
 * The Bun installer is scoped to the cache dir (BUN_INSTALL env var) so it
 * never touches ~/.bun or shell rc files.
 *
 * Environment knobs:
 *   DORAVAL_AUTO_INSTALL_BUN=1  — skip prompt, always install (CI / automation)
 *   DORAVAL_AUTO_INSTALL_BUN=0  — skip prompt, never install; print guidance + exit 1
 */

import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'

// Pinned managed-install version; bump this to update the cached Bun.
// Must be ≥ MIN_BUN_VERSION (Bun.YAML since 1.3.0).
const BUN_VERSION = '1.3.14'
/** Minimum Bun that exposes Bun.YAML — used by config / frontmatter / journal. */
const MIN_BUN_VERSION = '1.3.0'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── helpers ────────────────────────────────────────────────────────────────

function getCacheDir() {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
  return join(base, 'doraval', 'bun')
}

/** Parse "1.2.3" / "1.2.3+hash" → [major, minor, patch] or null. */
function parseSemver(raw) {
  const m = String(raw).trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** True if a ≥ b for semver triples (missing parts treated as 0). */
function versionGte(a, b) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return false
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true
    if (pa[i] < pb[i]) return false
  }
  return true
}

/** Run `bun --version` for a binary path or the name "bun". */
function bunVersion(bin) {
  try {
    const out = execSync(`"${bin}" --version`, { encoding: 'utf8' }).trim()
    return parseSemver(out) ? out.split(/\s+/)[0] : null
  } catch {
    return null
  }
}

/**
 * Prefer a PATH install that meets the minimum (user can upgrade freely).
 * Fall back to managed cache only when it also meets MIN_BUN_VERSION.
 * Stale caches (e.g. 1.2.0 without Bun.YAML) are ignored so we upgrade.
 */
function resolveBun() {
  const pathVer = bunVersion('bun')
  if (pathVer && versionGte(pathVer, MIN_BUN_VERSION)) return 'bun'

  const cacheBin = join(getCacheDir(), 'bin', 'bun')
  if (existsSync(cacheBin)) {
    const cacheVer = bunVersion(cacheBin)
    if (cacheVer && versionGte(cacheVer, MIN_BUN_VERSION)) return cacheBin
  }

  return null
}

function printGuidance() {
  if (process.platform === 'darwin') {
    console.error(
      'doraval works best via Homebrew on macOS (no runtime required).\n\n' +
      'Install with Homebrew:\n' +
      '  brew tap saif-shines/tap\n' +
      '  brew trust saif-shines/tap\n' +
      '  brew install doraval\n\n' +
      'The `brew trust` step is required on some systems for third-party taps.\n\n' +
      'Alternative — install Bun, then retry:\n' +
      '  curl -fsSL https://bun.sh/install | bash\n' +
      '  # restart your terminal, then re-run your npx command or: bunx doraval'
    )
  } else if (process.platform === 'win32') {
    console.error(
      'doraval requires the Bun runtime.\n\n' +
      'Install Bun for Windows:\n' +
      '  powershell -c "irm bun.sh/install.ps1 | iex"\n\n' +
      'After installation, restart your terminal and re-run your npx command.'
    )
  } else {
    console.error(
      'doraval requires the Bun runtime.\n\n' +
      'Install Bun (~10s):\n' +
      '  curl -fsSL https://bun.sh/install | bash\n\n' +
      'After installation completes, restart your terminal (or run:\n' +
      '  source ~/.zshrc     # or ~/.bashrc / ~/.bash_profile)\n\n' +
      'Then re-run your npx command, or run:\n' +
      '  bunx doraval'
    )
  }
}

/**
 * Prompt for consent on an interactive terminal.
 * Returns true if the user accepts (default on empty/Enter).
 */
async function promptConsent(cacheDir) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr })
    rl.question(
      '\nBun runtime not found.\n' +
      `doraval will download and run bun.sh/install (fetched over HTTPS from bun.sh / GitHub)\n` +
      `to install Bun v${BUN_VERSION} into: ${cacheDir}\n` +
      '\nInstall now? [Y/n] ',
      (answer) => {
        rl.close()
        resolve(answer.trim().toLowerCase() !== 'n')
      }
    )
  })
}

/**
 * Run the official Bun installer scoped to cacheDir.
 *
 * BUN_INSTALL tells the script where to put the binary.
 * Pre-seeding PATH with cacheDir/bin makes the installer believe the dir is
 * already on PATH → it skips adding lines to ~/.zshrc / ~/.bashrc.
 *
 * Returns true when bin/bun exists after the install.
 */
function installBun(cacheDir) {
  const env = {
    ...process.env,
    BUN_INSTALL: cacheDir,
    PATH: `${join(cacheDir, 'bin')}:${process.env.PATH ?? ''}`,
  }
  const result = spawnSync(
    'bash',
    ['-c', `curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"`],
    { env, stdio: 'inherit' }
  )
  if (result.error || result.status !== 0) return false
  return existsSync(join(cacheDir, 'bin', 'bun'))
}

// ── main ───────────────────────────────────────────────────────────────────

const cacheDir = getCacheDir()
let bunCmd = resolveBun()

if (!bunCmd) {
  // Windows: no bash installer available — print guidance and exit.
  if (process.platform === 'win32') {
    printGuidance()
    process.exit(1)
  }

  const autoEnv = process.env.DORAVAL_AUTO_INSTALL_BUN
  let doInstall = false

  if (autoEnv === '0') {
    doInstall = false                         // explicitly disabled
  } else if (autoEnv === '1') {
    doInstall = true                          // CI / automation opt-in
  } else if (process.stdin.isTTY) {
    doInstall = await promptConsent(cacheDir) // interactive: ask the user
  }
  // non-interactive + no env flag → doInstall stays false

  if (!doInstall) {
    printGuidance()
    process.exit(1)
  }

  // Drop a stale managed cache (e.g. 1.2.0 without Bun.YAML) before reinstall.
  try {
    rmSync(cacheDir, { recursive: true, force: true })
  } catch {
    // best-effort
  }

  console.log(`\nInstalling Bun v${BUN_VERSION} into ${cacheDir} …`)
  const ok = installBun(cacheDir)
  if (!ok) {
    console.error('\nBun installation failed. Please install it manually:')
    printGuidance()
    process.exit(1)
  }

  const installed = join(cacheDir, 'bin', 'bun')
  const installedVer = bunVersion(installed)
  if (!installedVer || !versionGte(installedVer, MIN_BUN_VERSION)) {
    console.error(
      `\nInstalled Bun ${installedVer ?? '(unknown)'} is older than required ${MIN_BUN_VERSION} (needs Bun.YAML).\n` +
        'Upgrade Bun manually, then re-run doraval.'
    )
    printGuidance()
    process.exit(1)
  }

  bunCmd = installed
  console.log('Bun installed. Running doraval…\n')
}

const cli = join(__dirname, 'doraval.js')

const result = spawnSync(bunCmd, [cli, ...process.argv.slice(2)], { stdio: 'inherit' })
if (result.error) {
  console.error('Failed to execute Bun:', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? (result.signal ? 128 : 1))
