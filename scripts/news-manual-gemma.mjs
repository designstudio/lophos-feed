/**
 * End-to-end manual local Gemma pipeline.
 *
 * Validates Ollama before any write, optionally ingests RSS, creates an
 * isolated manual_ready cluster run, and processes only the requested slice.
 */

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { loadScriptEnvironment } from './script-env.mjs'

loadScriptEnvironment()

const args = process.argv.slice(2)
const skipIngest = args.includes('--skip-ingest')
const forceIngest = args.includes('--force-ingest')
const skipPrepare = args.includes('--skip-prepare')
const dryRun = args.includes('--dry-run')
const help = args.includes('--help') || args.includes('-h')
const source = args.find((arg) => arg.startsWith('--source='))?.slice('--source='.length).trim() || ''
const lookbackArg = args.find((arg) => arg.startsWith('--lookback-hours='))?.slice('--lookback-hours='.length)
const lookbackHours = lookbackArg === undefined ? (source ? 72 : null) : Number(lookbackArg)
const forwardedArgs = args.filter((arg) => (
  !['--skip-ingest', '--force-ingest', '--skip-prepare'].includes(arg)
  && !arg.startsWith('--lookback-hours=')
))

function printUsage() {
  console.log(`Uso:
  npm run news:manual-gemma -- --topics=horror,movies,tecnologia --max-clusters-per-topic=3

Opcoes:
  --topics=topico1,topico2
  --exclude-topics=topico1,topico2  nao envia estes topicos ao Gemma
  --source=Destructoid
  --lookback-hours=72  janela de raw_items (padrão: 72 com --source; 12 sem filtro)
  --max-clusters-per-topic=3
  --skip-ingest     reutiliza os raw_items ja coletados
  --force-ingest    ignora ETag/cache dos feeds e busca os itens novamente
  --skip-prepare    reutiliza o ultimo cluster manual_ready
  --dry-run         mostra o recorte sem chamar IA nem escrever artigos
  --help`)
}

function runStep(label, scriptPath, scriptArgs = []) {
  console.log(`\n[news:manual-gemma] Running ${label}...`)
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEWS_PROCESS_PROVIDER: 'gemma',
      NEWS_CLUSTER_RUN_STATUS: 'manual_ready',
      NEWS_CLUSTER_ALGORITHM: process.env.NEWS_CLUSTER_ALGORITHM || 'semantic-v2',
      NEWS_SOURCE_FILTER: source,
      ...(lookbackHours ? { NEWS_PROCESS_LOOKBACK_HOURS: String(lookbackHours) } : {}),
    },
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

async function validateOllamaAccess() {
  const apiUrl = (process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '')
  const model = process.env.OLLAMA_MODEL || 'gemma4:12b'
  const response = await fetch(`${apiUrl}/api/tags`)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(`Ollama validation failed (${response.status}): ${data?.error || 'unknown error'}`)
  }

  const available = (data?.models || []).some((entry) => entry.name === model || entry.model === model)
  if (!available) {
    throw new Error(`Ollama model is not installed: ${model}. Run: ollama pull ${model}`)
  }

  console.log(`[news:manual-gemma] Ollama and model validated (${model}).`)
}

async function main() {
  if (help) {
    printUsage()
    return
  }

  if (skipIngest && forceIngest) {
    throw new Error('--skip-ingest and --force-ingest cannot be used together')
  }
  if (args.some((arg) => arg.startsWith('--source=')) && !source) {
    throw new Error('--source must not be empty')
  }
  if (lookbackHours !== null && (!Number.isInteger(lookbackHours) || lookbackHours < 1 || lookbackHours > 720)) {
    throw new Error('--lookback-hours must be an integer between 1 and 720')
  }

  if (!dryRun) await validateOllamaAccess()

  if (!skipPrepare && !dryRun) {
    if (!skipIngest) {
      runStep(
        'news:ingest',
        fileURLToPath(new URL('./news-ingest.mjs', import.meta.url)),
        forceIngest ? ['--force'] : [],
      )
    }
    runStep('news:process (manual_ready)', fileURLToPath(new URL('./news-process.mjs', import.meta.url)))
  }

  runStep('news:process-gemma', fileURLToPath(new URL('./process-news-gemma.mjs', import.meta.url)), forwardedArgs)
}

main().catch((error) => {
  console.error('[news:manual-gemma] Fatal error:', error?.message || error)
  process.exitCode = 1
})
