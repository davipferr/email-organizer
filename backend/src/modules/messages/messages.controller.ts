import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { MessagesService } from './messages.service.js';
import { BulkActionsService } from './bulk-actions.service.js';
import {
  bulkSchema,
  labelsChangeSchema,
  listMessagesSchema,
  moveSchema,
  trashSchema,
  type BulkInput,
  type LabelsChangeInput,
  type ListMessagesInput,
  type MoveInput,
  type TrashInput,
} from './messages.schemas.js';

// Live from the provider (always fresh); actions also update the synced rows.
@Controller('accounts/:accountId/messages')
@UseGuards(SessionGuard)
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly bulk: BulkActionsService,
  ) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query(new ZodValidationPipe(listMessagesSchema)) query: ListMessagesInput,
  ) {
    return this.messages.list(userId, accountId, query);
  }

  // Every email from a sender / matching a search, as a background job. Returns the job to poll.
  @Post('bulk')
  @HttpCode(202)
  startBulk(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(bulkSchema)) body: BulkInput,
  ) {
    return this.bulk.start(userId, accountId, body);
  }

  @Get('bulk/:bulkActionId')
  bulkStatus(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('bulkActionId', ParseUUIDPipe) bulkActionId: string,
  ) {
    return this.bulk.status(userId, accountId, bulkActionId);
  }

  @Get(':messageId')
  get(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messages.get(userId, accountId, messageId);
  }

  // Moves to Trash only (the provider empties it after 30 days). No permanent delete.
  @Post('trash')
  trash(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(trashSchema)) body: TrashInput,
  ) {
    return this.messages.trash(userId, accountId, body);
  }

  // Restores from Trash — powers the "Undo" toast.
  @Post('untrash')
  untrash(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(trashSchema)) body: TrashInput,
  ) {
    return this.messages.untrash(userId, accountId, body);
  }

  @Post('labels')
  changeLabels(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(labelsChangeSchema)) body: LabelsChangeInput,
  ) {
    return this.messages.changeLabels(userId, accountId, body);
  }

  @Post('move')
  move(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(moveSchema)) body: MoveInput,
  ) {
    return this.messages.move(userId, accountId, body);
  }
}
