// This file runs when the Next.js server starts
// Used for initializing background tasks like cron jobs

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run cron jobs in the Node.js runtime (not in Edge Runtime)
    const { startFeedCron } = await import('./lib/cron')
    startFeedCron()
  }
}
