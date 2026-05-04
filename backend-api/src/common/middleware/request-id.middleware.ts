import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const correlationId =
      (req.headers['x-correlation-id'] as string) || requestId;

    (req as unknown as Record<string, unknown>).requestId = requestId;
    (req as unknown as Record<string, unknown>).correlationId = correlationId;

    _res.setHeader('x-request-id', requestId);
    _res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
