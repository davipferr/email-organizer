import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MailProvidersModule } from './mail-providers/mail-providers.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { SyncModule } from './modules/sync/sync.module.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { LabelsModule } from './modules/labels/labels.module.js';
import { SendersModule } from './modules/senders/senders.module.js';
import { InsightsModule } from './modules/insights/insights.module.js';
import { NotesModule } from './modules/notes/notes.module.js';
import { SavedSearchesModule } from './modules/saved-searches/saved-searches.module.js';
import { AskModule } from './modules/ask/ask.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CryptoModule,
    JobsModule,
    MailProvidersModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    SyncModule,
    MessagesModule,
    LabelsModule,
    SendersModule,
    InsightsModule,
    NotesModule,
    SavedSearchesModule,
    AskModule,
  ],
})
export class AppModule {}
