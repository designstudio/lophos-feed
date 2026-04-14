/**
 * News process orchestrator
 *
 * Runs the deterministic pipeline in order:
 * - news-preflight
 * - news-cluster
 *
 * Gemini processing stays separate in news:process-gemini.
 */

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

function runStep(label, scriptPath) {
  console.log(`\n[news:process] Running ${label}...`)

  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

async function main() {
  const preflightPath = fileURLToPath(new URL('./news-preflight.mjs', import.meta.url))
  const clusterPath = fileURLToPath(new URL('./news-cluster.mjs', import.meta.url))

  runStep('news-preflight', preflightPath)
  runStep('news-cluster', clusterPath)

  console.log('\n[news:process] Completed preflight + cluster pipeline.')
}

main().catch((err) => {
  console.error('[news:process] Fatal error:', err)
  process.exit(1)
})
