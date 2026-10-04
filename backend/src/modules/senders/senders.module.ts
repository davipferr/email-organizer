import { Module } from '@nestjs/common';
import { SendersController } from './senders.controller.js';
import { SendersService } from './senders.service.js';

@Module({
  controllers: [SendersController],
  providers: [SendersService],
})
export class SendersModule {}
