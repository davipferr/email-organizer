import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { SyncWorker } from './sync.worker.js';
import { MessageStoreService } from './message-store.service.js';

@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncWorker, MessageStoreService],
  exports: [MessageStoreService],
})
export class SyncModule {}
