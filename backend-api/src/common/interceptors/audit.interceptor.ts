import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';
import { AuditService } from '../../modules/audit/audit.service';
import { APP_CONSTANTS } from '../constants';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;
    const requestId = request.requestId;

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.auditService
            .log({
              action: auditMetadata.action,
              resource: auditMetadata.resource,
              resourceId: request.params?.id,
              userId,
              requestId,
              description: auditMetadata.description,
              metadata: {
                method: request.method,
                path: request.url,
                body: this.sanitizeBody(request.body),
                response: data,
              },
              ipAddress: request.ip,
              userAgent: request.get('user-agent'),
            })
            .catch((err: Error) =>
              this.logger.error('Failed to create audit log', err.stack),
            );
        },
      }),
    );
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body) return body;
    const sanitized = { ...body };
    for (const field of APP_CONSTANTS.SECURITY.SENSITIVE_FIELDS) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
