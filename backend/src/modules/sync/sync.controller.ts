import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SyncService } from './sync.service.js';

const startSyncSchema = z.object({ force: z.literal('full').optional() }).default({});

// Manual sync only — nothing here runs on a schedule.
@Controller('accounts/:accountId/sync')
@UseGuards(SessionGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  // The Sync button. 409 if a sync is already running.
  @Post()
  start(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(startSyncSchema)) body: z.infer<typeof startSyncSchema>,
  ) {
    return this.sync.start(userId, accountId, body.force === 'full');
  }

  // The Stop button. 409 if no sync is running.
  @Post('cancel')
  cancel(@CurrentUserId() userId: string, @Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.sync.cancel(userId, accountId);
  }

  // Current/last run with progress; the UI polls this while a sync is running.
  @Get()
  status(@CurrentUserId() userId: string, @Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.sync.status(userId, accountId);
  }
}
