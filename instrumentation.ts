// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { scheduleRetentionJob } = await import('./src/jobs/retention.worker');
      await scheduleRetentionJob();
    } catch (error) {
      console.error('[Instrumentation] Failed to initialize retention job scheduler:', error);
    }
  }
}
