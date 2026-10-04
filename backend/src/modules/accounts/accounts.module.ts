import { Global, Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';

@Global()
@Module({
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
