/**
 * VPS cron orchestrator for the news pipeline.
 *
 * Order:
 * 1. news:ingest
 * 2. news:process
 * 3. news:process-mistral
 */

import { spawnSync } from 'child_process'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

function runStep(label, commandArgs) {
  console.log(`\n[news:cron] Running ${label}...`)

  const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

async function main() {
  runStep('news:ingest', ['npm', 'run', 'news:ingest'])
  runStep('news:process', ['npm', 'run', 'news:process'])
  runStep('news:process-mistral', ['npm', 'run', 'news:process-mistral'])

  console.log('\n[news:cron] Completed full 6h pipeline.')
}

main().catch((err) => {
  console.error('[news:cron] Fatal error:', err)
  process.exit(1)
})
