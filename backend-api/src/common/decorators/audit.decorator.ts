import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../enums';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: AuditAction;
  resource: string;
  description?: string;
}

export const Audit = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_KEY, metadata);
