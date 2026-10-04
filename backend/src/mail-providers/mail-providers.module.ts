import { Global, Module } from '@nestjs/common';
import { GmailProvider } from './gmail/gmail.provider.js';
import { MailProviderRegistry } from './mail-provider.registry.js';

@Global()
@Module({
  providers: [GmailProvider, MailProviderRegistry],
  exports: [GmailProvider, MailProviderRegistry],
})
export class MailProvidersModule {}
