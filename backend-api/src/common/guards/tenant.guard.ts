import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums';

export const TENANT_AWARE_KEY = 'tenantAware';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isTenantAware = this.reflector.getAllAndOverride<boolean>(
      TENANT_AWARE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isTenantAware) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('User is not associated with any tenant');
    }

    return true;
  }
}
