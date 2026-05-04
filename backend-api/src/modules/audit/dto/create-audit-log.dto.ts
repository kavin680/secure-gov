import { AuditAction } from '../../../common/enums';

export interface CreateAuditLogDto {
  action: AuditAction | string;
  resource: string;
  resourceId?: string;
  userId?: string;
  requestId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
