import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { envSchema, type Env } from './env.js';

// Typed config: inject AppConfig and call config.get('KEY').
export class AppConfig extends ConfigService<Env, true> {}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      // Local dev reads the root .env; in Docker the variables come from compose.
      envFilePath: ['../.env', '.env'],
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
  providers: [{ provide: AppConfig, useExisting: ConfigService }],
  exports: [AppConfig],
})
export class ConfigModule {}
