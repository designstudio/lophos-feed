/**
 * Isolated local Gemma editorial runner.
 *
 * It reuses the production persistence/dedup pipeline, but only consumes
 * manual_ready cluster runs. The cron continues to use Mistral + ready.
 */

process.env.NEWS_PROCESS_PROVIDER = 'gemma'
process.env.NEWS_CLUSTER_RUN_STATUS = process.env.NEWS_CLUSTER_RUN_STATUS || 'manual_ready'

await import('./process-news-mistral.mjs')
