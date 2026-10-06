import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SavedSearchesService } from './saved-searches.service.js';

const createSavedSearchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  query: z.string().trim().min(1).max(1000),
});
const updateSavedSearchSchema = createSavedSearchSchema.partial();
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;

@Controller('accounts/:accountId/saved-searches')
@UseGuards(SessionGuard)
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.savedSearches.list(userId, accountId);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(createSavedSearchSchema)) body: CreateSavedSearchInput,
  ) {
    return this.savedSearches.create(userId, accountId, body);
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSavedSearchSchema)) body: UpdateSavedSearchInput,
  ) {
    return this.savedSearches.update(userId, accountId, id, body);
  }

  // Removes the saved search only; the emails it matches are untouched.
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savedSearches.remove(userId, accountId, id);
  }
}
