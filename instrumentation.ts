export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentry } = await import('@/lib/telemetry/sentry');
    try {
      initSentry();
    } catch (error) {
      // Do not use Sentry to report an initialization failure: it may be the
      // failing dependency. The provider already handles a missing DSN.
      console.error('Failed to initialize Sentry', error);
    }
  }
}
