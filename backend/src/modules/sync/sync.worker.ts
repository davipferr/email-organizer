import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService, QUEUES } from '../../jobs/jobs.service.js';

export interface SyncJobData {
  syncRunId: string;
}

// Runs the sync jobs queued by SyncService: fetches metadata from the provider
// in batches, upserts Message/Label rows and updates SyncRun progress.
@Injectable()
export class SyncWorker implements OnModuleInit {
  constructor(private readonly jobs: JobsService) {}

  async onModuleInit() {
    await this.jobs.boss.work<SyncJobData>(QUEUES.SYNC, async ([job]) => {
      await this.run(job.data);
    });
  }

  private async run(_data: SyncJobData): Promise<void> {
    // TODO: implement full/incremental sync
  }
}
