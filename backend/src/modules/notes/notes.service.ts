import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NoteTarget } from '../../generated/prisma/enums.js';
import { AccountsService } from '../accounts/accounts.service.js';
import type { ListNotesInput, SaveNoteInput } from './notes.controller.js';

// Sender addresses are stored lowercased, like Message.fromEmail.
const normalizeKey = (type: NoteTarget, key: string) => (type === NoteTarget.SENDER ? key.trim().toLowerCase() : key.trim());

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
  ) {}

  async list(userId: string, accountId: string, { type, keys }: ListNotesInput) {
    await this.accounts.getOwnedAccount(userId, accountId);
    return this.prisma.note.findMany({
      where: { accountId, targetType: type, targetKey: { in: keys.map((k) => normalizeKey(type, k)) } },
    });
  }

  async save(userId: string, accountId: string, input: SaveNoteInput) {
    await this.accounts.getOwnedAccount(userId, accountId);
    const where = {
      accountId_targetType_targetKey: {
        accountId,
        targetType: input.targetType,
        targetKey: normalizeKey(input.targetType, input.targetKey),
      },
    };
    const body = input.body.trim();
    if (!body) {
      await this.prisma.note.deleteMany({ where: where.accountId_targetType_targetKey });
      return null;
    }
    return this.prisma.note.upsert({ where, create: { ...where.accountId_targetType_targetKey, body }, update: { body } });
  }
}
