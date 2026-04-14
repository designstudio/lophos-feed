/**
 * VPS cron orchestrator for the news pipeline.
 *
 * Order:
 * 1. news:ingest
 * 2. news:process
 * 3. news:process-gemini
 */

import { spawnSync } from 'child_process'

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
  runStep('news:process-gemini', ['npm', 'run', 'news:process-gemini'])

  console.log('\n[news:cron] Completed full 6h pipeline.')
}

main().catch((err) => {
  console.error('[news:cron] Fatal error:', err)
  process.exit(1)
})
