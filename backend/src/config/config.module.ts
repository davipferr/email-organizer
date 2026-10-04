import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { envSchema, type Env } from './env.js';

// Typed config: inject AppConfig and call config.get('KEY').
export class AppConfig extends ConfigService<Env, true> {}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      // Local dev reads the root .env (ENV_FILE points a worktree at the main checkout's);
      // in Docker the variables come from compose.
      envFilePath: [process.env['ENV_FILE'], '../.env', '.env'].filter((p): p is string => !!p),
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
  providers: [{ provide: AppConfig, useExisting: ConfigService }],
  exports: [AppConfig],
})
export class ConfigModule {}
