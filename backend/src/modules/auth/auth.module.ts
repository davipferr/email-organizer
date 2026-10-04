import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DevLoginService } from './dev-login.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, DevLoginService],
})
export class AuthModule {}
