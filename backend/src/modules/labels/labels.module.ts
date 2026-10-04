import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module.js';
import { LabelsController } from './labels.controller.js';
import { LabelsService } from './labels.service.js';

@Module({
  imports: [SyncModule],
  controllers: [LabelsController],
  providers: [LabelsService],
})
export class LabelsModule {}
