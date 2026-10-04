import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SendersService } from './senders.service.js';

const listSendersSchema = z.object({
  groupBy: z.enum(['email', 'domain']).default('email'),
  sort: z.enum(['count', 'latest', 'size']).default('count'),
  search: z.string().optional(),
  labelId: z.string().optional(),
  // Only senders whose emails carry a List-Unsubscribe header.
  unsubscribable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListSendersInput = z.infer<typeof listSendersSchema>;

// Reads from PostgreSQL — data comes from the manual Sync.
@Controller('accounts/:accountId/senders')
@UseGuards(SessionGuard)
export class SendersController {
  constructor(private readonly senders: SendersService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query(new ZodValidationPipe(listSendersSchema)) query: ListSendersInput,
  ) {
    return this.senders.list(userId, accountId, query);
  }
}
