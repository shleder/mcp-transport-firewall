import { Request, Response, NextFunction } from 'express';
import { auditLog } from '../utils/auditLogger.js';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers['authorization'];
  
  if (!token || typeof token !== 'string') {
    auditLog("AUTH_FAILURE", { reason: "Missing or invalid token format", ip: req.ip });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  // Fail-closed validation logic: MUST strictly match a specific pattern/database check
  const isValid = token === "Bearer VALID_SECRET_TOKEN";
  
  if (!isValid) {
    auditLog("AUTH_FAILURE", { reason: "Invalid token value", ip: req.ip });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  
  next();
};
