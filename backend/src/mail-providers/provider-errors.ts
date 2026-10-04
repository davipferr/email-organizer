// Thrown when the provider rejects the stored credentials (revoked access, expired
// refresh token). The user has to log in again to grant access.
export class ProviderAuthError extends Error {
  constructor(message = 'Mail provider access was revoked or expired') {
    super(message);
  }
}

export class ProviderNotFoundError extends Error {}

// The user unticked a required permission on the consent screen.
export class MissingScopesError extends Error {}
