export class EpistemicSecurityException extends Error {
  public code: string;

  constructor(message: string, code = 'EPISTEMIC_VIOLATION') {
    super(message);
    this.name = 'EpistemicSecurityException';
    this.code = code;
  }
}
