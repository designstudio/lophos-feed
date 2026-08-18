/**
 * Compacts and removes processed raw RSS items outside their retention windows,
 * and removes old terminal pipeline runs.
 *
 * Safe by default: without --apply this script only reports eligible rows.
 */

import { createClient } from '@supabase/supabase-js'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const DEFAULT_RETENTION_DAYS = 60
const DEFAULT_COMPACT_AFTER_DAYS = 15
const DEFAULT_RUN_RETENTION_DAYS = 14
const DEFAULT_BATCH_SIZE = 50
const args = process.argv.slice(2)

function numericOption(name, fallback, { min, max }) {
  const prefix = `--${name}=`
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  if (raw === undefined) return fallback

  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function assertEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage() {
  console.log(`Usage:
  npm run news:cleanup-retention
  npm run news:cleanup-retention -- --apply

Options:
  --apply                 archives and deletes eligible rows
  --compact-after-days=15 clears content/summary after this many days
  --retention-days=60     processed-item retention window (minimum: 7)
  --run-retention-days=14 terminal pipeline-run retention window
  --batch-size=50         rows per operation in each transaction (maximum: 5000)
  --help`)
}

const apply = args.includes('--apply')
const help = args.includes('--help') || args.includes('-h')
const compactAfterDays = numericOption('compact-after-days', DEFAULT_COMPACT_AFTER_DAYS, { min: 1, max: 3649 })
const retentionDays = numericOption('retention-days', DEFAULT_RETENTION_DAYS, { min: 7, max: 3650 })
const runRetentionDays = numericOption('run-retention-days', DEFAULT_RUN_RETENTION_DAYS, { min: 1, max: 3650 })
const batchSize = numericOption('batch-size', DEFAULT_BATCH_SIZE, { min: 1, max: 5000 })

if (compactAfterDays >= retentionDays) {
  throw new Error('--compact-after-days must be lower than --retention-days')
}

async function plannedCount(query, label) {
  const { count, error } = await query
  if (error) throw new Error(`Could not estimate ${label}: ${error.message || JSON.stringify(error)}`)
  return count || 0
}

async function boundedPreviewCount(query, label, limit = 1000) {
  const { data, error } = await query.limit(limit)
  if (error) {
    console.warn(`[retention] Could not preview ${label}: ${error.message || JSON.stringify(error)}`)
    return 'unavailable'
  }

  const count = data?.length || 0
  return count === limit ? `${limit}+` : String(count)
}

async function main() {
  if (help) {
    printUsage()
    return
  }

  const db = createClient(
    assertEnv('NEXT_PUBLIC_SUPABASE_URL'),
    assertEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const now = Date.now()
  const compactCutoff = new Date(now - compactAfterDays * 24 * 60 * 60 * 1000).toISOString()
  const deleteCutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const runCutoff = new Date(now - runRetentionDays * 24 * 60 * 60 * 1000).toISOString()

  const compactable = await plannedCount(db
    .from('raw_items')
    .select('id', { count: 'planned', head: true })
    .eq('processed', true)
    .lt('fetched_at', compactCutoff)
    .gte('fetched_at', deleteCutoff)
    .or('content.not.is.null,summary.not.is.null'), 'compactable raw items')

  const deletable = await plannedCount(db
    .from('raw_items')
    .select('id', { count: 'planned', head: true })
    .eq('processed', true)
    .lt('fetched_at', deleteCutoff), 'deletable raw items')

  const oldPreflightRuns = await boundedPreviewCount(db
    .from('news_preflight_runs')
    .select('id')
    .lt('created_at', runCutoff), 'old preflight runs')
  const oldClusterRuns = await boundedPreviewCount(db
    .from('news_cluster_runs')
    .select('id')
    .lt('created_at', runCutoff), 'old cluster runs')

  console.log(`[retention] compact after=${compactAfterDays}d eligible≈${compactable}`)
  console.log(`[retention] delete after=${retentionDays}d eligible≈${deletable}`)
  console.log(`[retention] old runs after=${runRetentionDays}d preflight≈${oldPreflightRuns} clusters≈${oldClusterRuns}`)
  if (!apply) {
    console.log('[retention] Dry run only (planner estimates). Use --apply to apply retention.')
    return
  }

  let totalCompacted = 0
  let totalArchived = 0
  let totalDeleted = 0
  let totalPreflightRunsDeleted = 0
  let totalClusterRunsDeleted = 0
  let batchNumber = 0
  let currentBatchSize = batchSize

  while (true) {
    const { data, error } = await db.rpc('apply_news_retention_batch', {
      p_compact_cutoff: compactCutoff,
      p_delete_cutoff: deleteCutoff,
      p_run_cutoff: runCutoff,
      p_batch_size: currentBatchSize,
    })
    if (error) {
      const timedOut = error.code === '57014' || /statement timeout/i.test(error.message || '')
      if (timedOut && currentBatchSize > 1) {
        const previousBatchSize = currentBatchSize
        currentBatchSize = Math.max(1, Math.floor(currentBatchSize / 2))
        console.warn(
          `[retention] Batch ${batchNumber + 1} timed out at size=${previousBatchSize}; ` +
          `retrying the same batch with size=${currentBatchSize}.`,
        )
        continue
      }

      const migrationHint = ['PGRST202', '42883'].includes(error.code)
        ? ' Apply sql/20260818_add_raw_item_retention.sql before using --apply.'
        : ''
      throw new Error(`Retention batch ${batchNumber + 1} failed: ${error.message || JSON.stringify(error)}.${migrationHint}`)
    }

    batchNumber++
    const result = Array.isArray(data) ? data[0] : data
    const compacted = Number(result?.compacted_count || 0)
    const archived = Number(result?.archived_count || 0)
    const deleted = Number(result?.deleted_count || 0)
    const preflightRunsDeleted = Number(result?.preflight_runs_deleted || 0)
    const clusterRunsDeleted = Number(result?.cluster_runs_deleted || 0)
    totalCompacted += compacted
    totalArchived += archived
    totalDeleted += deleted
    totalPreflightRunsDeleted += preflightRunsDeleted
    totalClusterRunsDeleted += clusterRunsDeleted
    console.log(
      `[retention] batch=${batchNumber} size=${currentBatchSize} compacted=${compacted} archived=${archived} deleted=${deleted} ` +
      `preflight_runs=${preflightRunsDeleted} cluster_runs=${clusterRunsDeleted}`,
    )

    if (compacted + deleted + preflightRunsDeleted + clusterRunsDeleted === 0) break
  }

  console.log(
    `[retention] Completed. compacted=${totalCompacted} archived=${totalArchived} deleted=${totalDeleted} ` +
    `preflight_runs=${totalPreflightRunsDeleted} cluster_runs=${totalClusterRunsDeleted}`,
  )
  console.log('[retention] Next maintenance step: VACUUM (ANALYZE) public.raw_items;')
  console.log('[retention] VACUUM FULL reclaims physical disk but must be run separately in a maintenance window.')
}

main().catch((error) => {
  console.error('[retention] Fatal error:', error?.message || error)
  process.exitCode = 1
})
