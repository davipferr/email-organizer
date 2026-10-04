import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { AppConfig } from '../config/config.module.js';

export const QUEUES = {
  SYNC: 'mail-sync',
  BULK_ACTION: 'mail-bulk-action',
} as const;

// Background jobs on PostgreSQL. pg-boss manages its own tables in the "pgboss"
// schema, separate from Prisma's tables — no Redis needed.
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  readonly boss: PgBoss;

  constructor(config: AppConfig) {
    this.boss = new PgBoss(config.get('DATABASE_URL'));
    this.boss.on('error', (err) => this.logger.error(err));
  }

  async onModuleInit() {
    await this.boss.start();
    for (const queue of Object.values(QUEUES)) {
      await this.boss.createQueue(queue);
    }
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }
}
