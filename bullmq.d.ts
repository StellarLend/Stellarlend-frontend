import { Redis, Cluster } from 'ioredis';

declare module "bullmq" {
  export type ConnectionOptions = Redis | Cluster | string;

  export interface JobsOptions {
    attempts?: number;
    backoff?: { type: string; delay: number };
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
    delay?: number;
    priority?: number;
    [key: string]: unknown;
  }

  export class Queue<T = unknown> {
    constructor(name: string, options?: { connection?: ConnectionOptions; defaultJobOptions?: JobsOptions } & Record<string, unknown>);
    getRepeatableJobs(): Promise<Array<{ name: string }>>;
    add(
      name: string,
      data: T,
      options?: JobsOptions,
    ): Promise<unknown>;
    close(): Promise<void>;
  }

  export class Worker<T = unknown> {
    constructor(
      name: string,
      processor: (job: Job<T>) => Promise<void>,
      options?: { connection?: ConnectionOptions } & Record<string, unknown>,
    );
    close(): Promise<void>;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  export class Job<T = unknown> {
    data: T;
    id: string;
    attemptsMade: number;
    opts: { attempts?: number };
  }
}