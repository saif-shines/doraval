#!/usr/bin/env node
/**
 * doraval-wrapper.js
 *
 * Runs under Node (≥ 14.18, ESM). Resolves a Bun binary in order:
 *   1. Managed cache  — <XDG_CACHE_HOME|~/.cache>/doraval/bun/bin/bun
 *   2. PATH bun       — user's own global install
 *   3. Neither        — prompt for consent, install into cache, then exec.
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
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'

// Pinned managed-install version; bump this to update the cached Bun.
const BUN_VERSION = '1.2.0'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── helpers ────────────────────────────────────────────────────────────────

function getCacheDir() {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
  return join(base, 'doraval', 'bun')
}

/** Try the managed-cache bun binary; return its absolute path on success. */
function bunFromCache() {
  const bin = join(getCacheDir(), 'bin', 'bun')
  if (!existsSync(bin)) return null
  try {
    execSync(`"${bin}" --version`, { stdio: 'ignore' })
    return bin
  } catch {
    return null
  }
}

/** Try the PATH bun; return 'bun' on success. */
function bunFromPath() {
  try {
    execSync('bun --version', { stdio: 'ignore' })
    return 'bun'
  } catch {
    return null
  }
}

/** Resolution order: managed cache first, then PATH. */
function resolveBun() {
  return bunFromCache() || bunFromPath()
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

  console.log(`\nInstalling Bun v${BUN_VERSION} into ${cacheDir} …`)
  const ok = installBun(cacheDir)
  if (!ok) {
    console.error('\nBun installation failed. Please install it manually:')
    printGuidance()
    process.exit(1)
  }

  bunCmd = join(cacheDir, 'bin', 'bun')
  console.log('Bun installed. Running doraval…\n')
}

const cli = join(__dirname, 'doraval.js')

const result = spawnSync(bunCmd, [cli, ...process.argv.slice(2)], { stdio: 'inherit' })
if (result.error) {
  console.error('Failed to execute Bun:', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? (result.signal ? 128 : 1))
