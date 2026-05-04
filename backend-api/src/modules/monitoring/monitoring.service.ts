import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId?: string) {
    const tenantFilter = tenantId ? { tenantId } : {};

    const [
      totalUsers,
      activeUsers,
      totalTenants,
      totalPolicies,
      totalAiRequests,
      aiRequestsLast24h,
      totalDocuments,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { ...tenantFilter, deletedAt: null },
      }),
      this.prisma.user.count({
        where: {
          ...tenantFilter,
          deletedAt: null,
          isActive: true,
        },
      }),
      tenantId
        ? Promise.resolve(1)
        : this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.policy.count({ where: tenantFilter }),
      this.prisma.aiLog.count({ where: tenantFilter }),
      this.prisma.aiLog.count({
        where: {
          ...tenantFilter,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.document.count({ where: tenantFilter }),
      this.prisma.auditLog.findMany({
        where: tenantFilter,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          resource: true,
          userId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      overview: {
        totalUsers,
        activeUsers,
        totalTenants,
        totalPolicies,
        totalAiRequests,
        aiRequestsLast24h,
        totalDocuments,
      },
      recentActivity,
    };
  }

  async getUsageReport(tenantId?: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const tenantFilter = tenantId ? { tenantId } : {};

    const [
      aiRequestsByDay,
      aiRequestsByProvider,
      aiRequestsByStatus,
      tokenUsage,
      topUsers,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM ai_logs
         ${tenantId ? 'WHERE tenant_id = $1' : ''}
         ${tenantId ? 'AND' : 'WHERE'} created_at >= ${tenantId ? '$2' : '$1'}
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        ...(tenantId ? [tenantId, since] : [since]),
      ),
      this.prisma.aiLog.groupBy({
        by: ['provider'],
        where: { ...tenantFilter, createdAt: { gte: since } },
        _count: true,
        _sum: { totalTokens: true },
      }),
      this.prisma.aiLog.groupBy({
        by: ['status'],
        where: { ...tenantFilter, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.aiLog.aggregate({
        where: { ...tenantFilter, createdAt: { gte: since } },
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
        },
        _avg: { latencyMs: true },
        _count: true,
      }),
      this.prisma.aiLog.groupBy({
        by: ['userId'],
        where: {
          ...tenantFilter,
          createdAt: { gte: since },
          userId: { not: null },
        },
        _count: true,
        _sum: { totalTokens: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      period: { days, since: since.toISOString() },
      requestsByDay: aiRequestsByDay.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      byProvider: aiRequestsByProvider.map((p) => ({
        provider: p.provider,
        count: p._count,
        totalTokens: p._sum.totalTokens ?? 0,
      })),
      byStatus: aiRequestsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      tokenUsage: {
        totalTokens: tokenUsage._sum.totalTokens ?? 0,
        promptTokens: tokenUsage._sum.promptTokens ?? 0,
        completionTokens: tokenUsage._sum.completionTokens ?? 0,
        avgLatencyMs: Math.round(tokenUsage._avg.latencyMs ?? 0),
        totalRequests: tokenUsage._count,
      },
      topUsers: topUsers.map((u) => ({
        userId: u.userId,
        requestCount: u._count,
        totalTokens: u._sum.totalTokens ?? 0,
      })),
    };
  }

  async getComplianceReport(tenantId?: string) {
    const tenantFilter = tenantId ? { tenantId } : {};
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      policyViolations,
      policyViolationsByType,
      deniedRequests,
      totalPolicies,
      activePolicies,
    ] = await Promise.all([
      this.prisma.policyLog.count({
        where: {
          ...tenantFilter,
          decision: 'DENIED',
          createdAt: { gte: last30Days },
        },
      }),
      this.prisma.policyLog.groupBy({
        by: ['decision'],
        where: { ...tenantFilter, createdAt: { gte: last30Days } },
        _count: true,
      }),
      this.prisma.aiLog.count({
        where: {
          ...tenantFilter,
          status: 'DENIED',
          createdAt: { gte: last30Days },
        },
      }),
      this.prisma.policy.count({ where: tenantFilter }),
      this.prisma.policy.count({
        where: { ...tenantFilter, isActive: true },
      }),
    ]);

    return {
      period: 'last_30_days',
      policyEnforcement: {
        totalViolations: policyViolations,
        deniedAiRequests: deniedRequests,
        totalPolicies,
        activePolicies,
        byDecision: policyViolationsByType.map((v) => ({
          decision: v.decision,
          count: v._count,
        })),
      },
    };
  }

  async getSecurityReport(tenantId?: string) {
    const tenantFilter = tenantId ? { tenantId } : {};
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      failedLogins24h,
      failedLogins7d,
      lockedAccounts,
      recentSecurityEvents,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          ...tenantFilter,
          action: 'LOGIN_FAILED',
          createdAt: { gte: last24h },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...tenantFilter,
          action: 'LOGIN_FAILED',
          createdAt: { gte: last7d },
        },
      }),
      this.prisma.user.count({
        where: {
          ...tenantFilter,
          lockedUntil: { gte: new Date() },
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          ...tenantFilter,
          action: {
            in: [
              'LOGIN_FAILED',
              'ACCOUNT_LOCKED',
              'PASSWORD_CHANGED',
              'PASSWORD_RESET',
            ],
          },
          createdAt: { gte: last7d },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          userId: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      failedLogins: {
        last24h: failedLogins24h,
        last7d: failedLogins7d,
      },
      lockedAccounts,
      recentSecurityEvents,
    };
  }

  async getTenantReport(tenantId: string) {
    const [tenant, userCount, policyCount, aiStats, documentCount] =
      await Promise.all([
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            maxUsers: true,
            createdAt: true,
          },
        }),
        this.prisma.user.count({
          where: { tenantId, deletedAt: null },
        }),
        this.prisma.policy.count({ where: { tenantId } }),
        this.prisma.aiLog.aggregate({
          where: { tenantId },
          _count: true,
          _sum: { totalTokens: true },
          _avg: { latencyMs: true },
        }),
        this.prisma.document.count({ where: { tenantId } }),
      ]);

    return {
      tenant,
      stats: {
        users: userCount,
        policies: policyCount,
        documents: documentCount,
        aiRequests: aiStats._count,
        totalTokens: aiStats._sum.totalTokens ?? 0,
        avgLatencyMs: Math.round(aiStats._avg.latencyMs ?? 0),
      },
    };
  }
}
