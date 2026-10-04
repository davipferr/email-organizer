import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { BulkActionsService } from './bulk-actions.service.js';

@Module({
  imports: [SyncModule],
  controllers: [MessagesController],
  providers: [MessagesService, BulkActionsService],
})
export class MessagesModule {}
