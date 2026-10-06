import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { isValidTimeZone } from '../insights/insights.utils.js';
import { AskService } from './ask.service.js';

const askSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  // The browser's zone, so "last week" and dates mean what the user expects.
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone').default('UTC'),
});
export type AskInput = z.infer<typeof askSchema>;

// "Ask your mailbox": answers a question with Claude, using read-only tools over the
// synced copy (and the live text of the emails it opens).
@Controller('accounts/:accountId/ask')
@UseGuards(SessionGuard)
export class AskController {
  constructor(private readonly askService: AskService) {}

  // Whether ANTHROPIC_API_KEY is set, so the page can explain how to enable it.
  @Get('status')
  status() {
    return this.askService.status();
  }

  @Post()
  @HttpCode(200)
  ask(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(askSchema)) body: AskInput,
  ) {
    return this.askService.ask(userId, accountId, body);
  }
}
