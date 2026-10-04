import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class SyncService {
  // Creates a SyncRun (FULL on first sync, INCREMENTAL afterwards) and queues a job.
  start(_userId: string, _accountId: string, _forceFull: boolean): Promise<unknown> {
    throw new NotImplementedException();
  }

  status(_userId: string, _accountId: string): Promise<unknown> {
    throw new NotImplementedException();
  }
}
