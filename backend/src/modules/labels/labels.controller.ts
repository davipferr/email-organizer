import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { LabelsService } from './labels.service.js';

const createLabelSchema = z.object({
  name: z.string().min(1).max(225), // nested: "Parent/Child"
  colorBg: z.string().optional(),
  colorText: z.string().optional(),
});
const updateLabelSchema = createLabelSchema.partial();
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

@Controller('accounts/:accountId/labels')
@UseGuards(SessionGuard)
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  // ?counts=true adds email counts per tag (slower; used by the Manage tags page).
  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('counts') counts?: string,
  ) {
    return this.labels.list(userId, accountId, counts === 'true');
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(createLabelSchema)) body: CreateLabelInput,
  ) {
    return this.labels.create(userId, accountId, body);
  }

  @Patch(':labelId')
  update(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('labelId') labelId: string,
    @Body(new ZodValidationPipe(updateLabelSchema)) body: UpdateLabelInput,
  ) {
    return this.labels.update(userId, accountId, labelId, body);
  }

  // Deletes the tag only — emails are kept. ?children=true also deletes "Parent/..." tags.
  @Delete(':labelId')
  remove(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('labelId') labelId: string,
    @Query('children') children?: string,
  ) {
    return this.labels.remove(userId, accountId, labelId, children === 'true');
  }
}
