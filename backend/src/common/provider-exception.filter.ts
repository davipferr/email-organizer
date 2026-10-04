import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ProviderAuthError, ProviderNotFoundError, ProviderRequestError } from '../mail-providers/provider-errors.js';

// Maps provider errors to HTTP responses. A revoked/expired Google access returns 401,
// which sends the user back to the login page to grant access again.
@Catch(ProviderAuthError, ProviderNotFoundError, ProviderRequestError)
export class ProviderExceptionFilter implements ExceptionFilter {
  catch(err: ProviderAuthError | ProviderNotFoundError | ProviderRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof ProviderAuthError) {
      res.status(401).json({ statusCode: 401, code: 'RECONNECT_REQUIRED', message: err.message });
    } else if (err instanceof ProviderRequestError) {
      res.status(err.status).json({ statusCode: err.status, message: err.message });
    } else {
      res.status(404).json({ statusCode: 404, message: 'Not found' });
    }
  }
}
