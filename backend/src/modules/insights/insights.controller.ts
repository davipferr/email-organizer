import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { InsightsService } from './insights.service.js';
import { isValidTimeZone } from './insights.utils.js';

const statsSchema = z.object({
  // The browser's zone, so "busiest hour" and months match the user's clock.
  tz: z.string().refine(isValidTimeZone, 'Unknown time zone').default('UTC'),
});
export type StatsInput = z.infer<typeof statsSchema>;

const storageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type StorageInput = z.infer<typeof storageSchema>;

const ignoredSchema = z.object({
  // How many of a sender's newest emails in a row must be unread.
  minStreak: z.coerce.number().int().min(2).max(100).default(5),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type IgnoredInput = z.infer<typeof ignoredSchema>;

// Reads from PostgreSQL — data comes from the manual Sync.
@Controller('accounts/:accountId')
@UseGuards(SessionGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('stats')
  stats(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query(new ZodValidationPipe(statsSchema)) query: StatsInput,
  ) {
    return this.insights.stats(userId, accountId, query);
  }

  // "Who did I stop reading?"
  @Get('ignored-senders')
  ignored(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query(new ZodValidationPipe(ignoredSchema)) query: IgnoredInput,
  ) {
    return this.insights.ignored(userId, accountId, query);
  }

  @Get('storage')
  storage(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query(new ZodValidationPipe(storageSchema)) query: StorageInput,
  ) {
    return this.insights.storage(userId, accountId, query);
  }
}
