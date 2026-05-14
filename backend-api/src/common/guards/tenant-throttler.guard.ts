import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { PrismaService } from '../../database/prisma.service';

const TIER_RATE_LIMITS: Record<string, { ttl: number; limit: number }> = {
  FREE: { ttl: 60000, limit: 30 },
  STARTER: { ttl: 60000, limit: 100 },
  PROFESSIONAL: { ttl: 60000, limit: 500 },
  ENTERPRISE: { ttl: 60000, limit: 2000 },
};

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(TenantThrottlerGuard.name);

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { tenantId?: string; sub?: string } | undefined;
    if (user?.tenantId) {
      return `tenant:${user.tenantId}`;
    }
    return (req['ip'] as string) || 'unknown';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as
      | { tenantId?: string; sub?: string; role?: string }
      | undefined;

    if (!user?.tenantId) {
      return super.canActivate(context);
    }

    try {
      const prisma = (this as any).prisma as PrismaService | undefined;
      if (!prisma) {
        return super.canActivate(context);
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { tier: true },
      });

      if (tenant) {
        const tierConfig =
          TIER_RATE_LIMITS[tenant.tier] || TIER_RATE_LIMITS.FREE;
        req._tierRateLimit = tierConfig;
      }
    } catch {
      // Fall through to default throttler
    }

    return super.canActivate(context);
  }
}

export { TIER_RATE_LIMITS };
