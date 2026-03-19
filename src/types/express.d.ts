import { z } from 'zod';

declare global {
  namespace Express {
    interface Request {
      nhiScopes?: string[];
    }
  }
}
