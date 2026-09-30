export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentry } = await import('@/lib/telemetry/sentry');
    try { initSentry(); } catch { /* Sentry DSN not configured */ }
  }
}