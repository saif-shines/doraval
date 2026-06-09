#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  execSync('bun --version', { stdio: 'ignore' })
} catch {
  console.error(
    'doraval requires the Bun runtime.\n\n' +
    'Install Bun (~10s):\n' +
    '  curl -fsSL https://bun.sh/install | bash\n\n' +
    'Then run:\n' +
    '  bunx doraval'
  )
  process.exit(1)
}

const cli = join(__dirname, 'doraval.js')

let result
try {
  result = spawnSync('bun', [cli, ...process.argv.slice(2)], { stdio: 'inherit' })
} catch (err) {
  console.error('Failed to execute Bun:', err.message)
  process.exit(1)
}

process.exit(result.status ?? (result.signal ? 128 : 1))
