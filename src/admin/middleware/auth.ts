import type { IncomingMessage, ServerResponse } from "node:http";
import { UnauthorizedError } from "../../errors.js";

export function requireAuth(req: IncomingMessage, res: ServerResponse, expectedToken?: string): void {
  
  if (!expectedToken) return;

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError();
  }

  const token = authHeader.substring(7);

  if (token.length !== expectedToken.length) {
    throw new UnauthorizedError();
  }

  let diff = 0;
  for (let i = 0; i < expectedToken.length; i++) {
    diff |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }

  if (diff !== 0) {
    throw new UnauthorizedError();
  }
}
