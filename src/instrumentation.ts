// This file runs when the Next.js server starts.
// Keep it side-effect free on Vercel/serverless so idle instances do not
// spin background timers and consume Fluid Active CPU.

export async function register() {
  // Intentionally no-op.
  // RSS ingest scheduling is owned by external cron/VPS jobs.
  // Manual refreshes can still call explicit API routes on demand.
}
