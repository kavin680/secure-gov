import { Request } from 'express';
import { Role } from '../enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  sessionId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  requestId: string;
  correlationId?: string;
}
