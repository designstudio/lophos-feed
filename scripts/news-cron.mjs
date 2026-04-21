/**
 * VPS cron orchestrator for the news pipeline.
 *
 * Order:
 * 1. news:ingest
 * 2. news:process
 * 3. news:process-mistral
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const LOG_DIR = path.resolve(process.cwd(), 'logs')
const STATE_FILE = path.join(LOG_DIR, 'news-cron-state.json')
const LOCK_FILE = path.join(LOG_DIR, 'news-cron.lock')

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx')
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2))
    return fd
  } catch (err) {
    if (err?.code === 'EEXIST') {
      console.log(`[news:cron] Another run is already active. Skipping.`)
      process.exit(0)
    }
    throw err
  }
}

function releaseLock(fd) {
  try {
    if (typeof fd === 'number') fs.closeSync(fd)
  } catch {}
  try {
    fs.unlinkSync(LOCK_FILE)
  } catch {}
}

function writeState(payload) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2))
  } catch (err) {
    console.warn('[news:cron] Could not write state file:', err?.message || err)
  }
}

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
  ensureLogDir()
  const lockFd = acquireLock()
  const startedAt = Date.now()

  process.on('exit', () => releaseLock(lockFd))

  runStep('news:ingest', ['npm', 'run', 'news:ingest'])
  runStep('news:process', ['npm', 'run', 'news:process'])
  runStep('news:process-mistral', ['npm', 'run', 'news:process-mistral'])

  const durationMs = Date.now() - startedAt
  writeState({
    lastSuccessAt: new Date().toISOString(),
    durationMs,
    pid: process.pid,
  })
  console.log(`\n[news:cron] Completed full 6h pipeline in ${Math.round(durationMs / 1000)}s.`)
}

main().catch((err) => {
  ensureLogDir()
  writeState({
    lastFailureAt: new Date().toISOString(),
    pid: process.pid,
    error: err?.message || String(err),
  })
  console.error('[news:cron] Fatal error:', err)
  process.exit(1)
})
