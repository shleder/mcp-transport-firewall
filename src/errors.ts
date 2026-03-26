export class EpistemicSecurityException extends Error {
  public code: string;

  constructor(message: string, code = 'EPISTEMIC_VIOLATION') {
    super(message);
    this.name = 'EpistemicSecurityException';
    this.code = code;
  }
}

export class TrustGateError extends Error {
  public code: string;
  public status: number;
  public details?: Record<string, unknown>;

  constructor(message: string, code: string, status = 403, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TrustGateError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
