import { Injectable, NotImplementedException } from '@nestjs/common';
import type { LabelsChangeInput, ListMessagesInput, MoveInput, TrashInput } from './messages.schemas.js';

// Small selections run immediately; large ones (a whole sender / search) are queued
// as a pg-boss BULK_ACTION job and report progress to the UI.
@Injectable()
export class MessagesService {
  list(_userId: string, _accountId: string, _query: ListMessagesInput): Promise<unknown> {
    throw new NotImplementedException();
  }

  get(_userId: string, _accountId: string, _messageId: string): Promise<unknown> {
    throw new NotImplementedException();
  }

  trash(_userId: string, _accountId: string, _input: TrashInput): Promise<unknown> {
    throw new NotImplementedException();
  }

  untrash(_userId: string, _accountId: string, _input: TrashInput): Promise<unknown> {
    throw new NotImplementedException();
  }

  changeLabels(_userId: string, _accountId: string, _input: LabelsChangeInput): Promise<unknown> {
    throw new NotImplementedException();
  }

  move(_userId: string, _accountId: string, _input: MoveInput): Promise<unknown> {
    throw new NotImplementedException();
  }
}
