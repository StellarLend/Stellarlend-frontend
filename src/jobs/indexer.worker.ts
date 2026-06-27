import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import serverConfig from '@/lib/server-config';
import { indexAccountTransactions } from '@/lib/indexer';
import { logger } from '@/lib/logger';
import {
  IndexerJobPayload,
  indexerDeadLetterQueue,
  queueNames,
  registerQueueShutdownHooks,
} from '@/lib/queue';

const ROUTE = 'jobs/indexer.worker';
const redisUrl = serverConfig.redisUrl;

export const indexerWorkerConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const indexerWorker = new Worker(
  queueNames.indexer,
  async (job: Job<IndexerJobPayload>) => {
    const { accountId } = job.data;
    if (!accountId) {
      throw new Error('Missing accountId in job data');
    }
    
    logger.info(`Processing indexer job for account ${accountId}`, ROUTE);
    await indexAccountTransactions(accountId, {
      bypassCache: true,
      skipQueue: true,
    });
  },
  {
    connection: indexerWorkerConnection as any,
  }
);

// Dead-letter / Failed job handling
indexerWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await indexerDeadLetterQueue.add(
      'index_account_failed',
      {
        originalJobId: job.id,
        data: job.data,
        failedReason: err.message,
        failedAt: new Date().toISOString(),
      },
      { removeOnComplete: 1_000, removeOnFail: 10_000 },
    );
  }

  logger.error(`Indexer job ${job?.id} failed:`, ROUTE, {
    jobId: job?.id,
    data: job?.data,
    error: err.message,
  });
});

export async function gracefulShutdownIndexerWorker(): Promise<void> {
  await indexerWorker.close();
  await indexerWorkerConnection.quit();
}

registerQueueShutdownHooks();
