import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SessionGuard } from '../../common/auth/session.guard.js';
import { CurrentUserId } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { NoteTarget } from '../../generated/prisma/enums.js';
import { NotesService } from './notes.service.js';

const targetType = z.enum([NoteTarget.EMAIL, NoteTarget.SENDER]);

const listNotesSchema = z.object({
  type: targetType,
  // Comma-separated email ids or sender addresses (the rows on screen).
  keys: z
    .string()
    .transform((v) => v.split(',').map((k) => k.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(320)).max(200)),
});
export type ListNotesInput = z.infer<typeof listNotesSchema>;

const saveNoteSchema = z.object({
  targetType,
  targetKey: z.string().min(1).max(320),
  body: z.string().max(10_000), // empty = delete the note
});
export type SaveNoteInput = z.infer<typeof saveNoteSchema>;

// Personal notes on emails and senders, stored only in this app.
@Controller('accounts/:accountId/notes')
@UseGuards(SessionGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query(new ZodValidationPipe(listNotesSchema)) query: ListNotesInput,
  ) {
    return this.notes.list(userId, accountId, query);
  }

  // Creates, replaces or (with an empty body) deletes the note. Returns the note or null.
  @Put()
  save(
    @CurrentUserId() userId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(saveNoteSchema)) body: SaveNoteInput,
  ) {
    return this.notes.save(userId, accountId, body);
  }
}
