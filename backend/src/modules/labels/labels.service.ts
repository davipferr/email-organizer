import { Injectable, NotImplementedException } from '@nestjs/common';
import type { CreateLabelInput, UpdateLabelInput } from './labels.controller.js';

@Injectable()
export class LabelsService {
  list(_userId: string, _accountId: string): Promise<unknown> {
    throw new NotImplementedException();
  }

  create(_userId: string, _accountId: string, _input: CreateLabelInput): Promise<unknown> {
    throw new NotImplementedException();
  }

  update(_userId: string, _accountId: string, _labelId: string, _input: UpdateLabelInput): Promise<unknown> {
    throw new NotImplementedException();
  }

  remove(_userId: string, _accountId: string, _labelId: string, _withChildren: boolean): Promise<unknown> {
    throw new NotImplementedException();
  }
}
