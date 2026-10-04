import { Global, Module } from '@nestjs/common';
import { GmailProvider } from './gmail/gmail.provider.js';
import { FakeMailProvider } from './fake/fake.provider.js';
import { MailProviderRegistry } from './mail-provider.registry.js';

@Global()
@Module({
  providers: [GmailProvider, FakeMailProvider, MailProviderRegistry],
  exports: [FakeMailProvider, MailProviderRegistry],
})
export class MailProvidersModule {}
