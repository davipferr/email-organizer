import { Injectable, NotImplementedException } from '@nestjs/common';
import type { ListSendersInput } from './senders.controller.js';

@Injectable()
export class SendersService {
  // GROUP BY fromEmail / fromDomain with count, unread, latest date and total size.
  // The response includes lastSyncedAt so the UI can show how fresh the data is.
  list(_userId: string, _accountId: string, _query: ListSendersInput): Promise<unknown> {
    throw new NotImplementedException();
  }
}
