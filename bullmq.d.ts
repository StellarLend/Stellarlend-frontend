declare module "bullmq" {
  export class Queue {
    constructor(name: string, options?: Record<string, unknown>);
    getRepeatableJobs(): Promise<Array<{ name: string }>>;
    add(
      name: string,
      data: Record<string, unknown>,
      options: Record<string, unknown>,
    ): Promise<unknown>;
    close?(): Promise<void>;
  }

  export class Worker {
    constructor(
      name: string,
      processor: (job: Job) => Promise<void>,
      options?: Record<string, unknown>,
    );
  }

  export class Job {
    data: unknown;
  }
}
