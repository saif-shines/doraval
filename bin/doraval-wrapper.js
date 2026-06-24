#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  execSync('bun --version', { stdio: 'ignore' })
} catch {
  if (process.platform === 'darwin') {
    console.error(
      'doraval works best via Homebrew on macOS (no runtime required).\n\n' +
      'Install with Homebrew:\n' +
      '  brew tap saif-shines/tap\n' +
      '  brew trust saif-shines/tap\n' +
      '  brew install doraval\n\n' +
      'The `brew trust` step is required on some systems for third-party taps.\n\n' +
      'Alternative (uses Bun runtime):\n' +
      '  curl -fsSL https://bun.sh/install | bash\n' +
      '  # restart your terminal, then re-run your npx command or: bunx doraval'
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
  process.exit(1)
}

const cli = join(__dirname, 'doraval.js')

const result = spawnSync('bun', [cli, ...process.argv.slice(2)], { stdio: 'inherit' })
if (result.error) {
  console.error('Failed to execute Bun:', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? (result.signal ? 128 : 1))
