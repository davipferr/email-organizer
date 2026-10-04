import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class AuthService {
  redirectToGoogle(_res: Response): void {
    throw new NotImplementedException();
  }

  handleGoogleCallback(_code: string, _state: string, _req: Request, _res: Response): Promise<void> {
    throw new NotImplementedException();
  }

  me(_userId: string): Promise<unknown> {
    throw new NotImplementedException();
  }

  logout(_req: Request, _res: Response): Promise<void> {
    throw new NotImplementedException();
  }
}
