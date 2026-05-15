import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../../database/prisma.service';

describe('MonitoringService', () => {
  let service: MonitoringService;

  const mockPrisma = {
    user: {
      count: jest.fn(),
    },
    tenant: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    policy: {
      count: jest.fn(),
    },
    aiLog: {
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    policyLog: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    document: {
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  describe('getDashboard', () => {
    it('should return platform-wide dashboard for super admin (no tenantId)', async () => {
      mockPrisma.user.count.mockResolvedValueOnce(20).mockResolvedValueOnce(18);
      mockPrisma.tenant.count.mockResolvedValue(3);
      mockPrisma.policy.count.mockResolvedValue(10);
      mockPrisma.aiLog.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(15);
      mockPrisma.document.count.mockResolvedValue(5);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'LOGIN',
          resource: 'auth',
          userId: 'user-1',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getDashboard();

      expect(result.overview.totalUsers).toBe(20);
      expect(result.overview.activeUsers).toBe(18);
      expect(result.overview.totalTenants).toBe(3);
      expect(result.overview.totalPolicies).toBe(10);
      expect(result.overview.totalAiRequests).toBe(100);
      expect(result.overview.aiRequestsLast24h).toBe(15);
      expect(result.overview.totalDocuments).toBe(5);
      expect(result.recentActivity).toHaveLength(1);
    });

    it('should return tenant-scoped dashboard when tenantId is provided', async () => {
      mockPrisma.user.count.mockResolvedValueOnce(5).mockResolvedValueOnce(4);
      mockPrisma.policy.count.mockResolvedValue(3);
      mockPrisma.aiLog.count.mockResolvedValueOnce(30).mockResolvedValueOnce(5);
      mockPrisma.document.count.mockResolvedValue(2);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('tenant-1');

      expect(result.overview.totalUsers).toBe(5);
      expect(result.overview.totalTenants).toBe(1);
      expect(result.overview.totalPolicies).toBe(3);
    });
  });

  describe('getUsageReport', () => {
    it('should return usage report with default 30 days', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { date: '2026-05-01', count: BigInt(10) },
      ]);
      mockPrisma.aiLog.groupBy
        .mockResolvedValueOnce([
          { provider: 'mock', _count: 10, _sum: { totalTokens: 500 } },
        ])
        .mockResolvedValueOnce([
          { status: 'SUCCESS', _count: 8 },
          { status: 'DENIED', _count: 2 },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', _count: 5, _sum: { totalTokens: 200 } },
        ]);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _sum: { totalTokens: 500, promptTokens: 200, completionTokens: 300 },
        _avg: { latencyMs: 150 },
        _count: 10,
      });

      const result = await service.getUsageReport();

      expect(result.period.days).toBe(30);
      expect(result.requestsByDay).toHaveLength(1);
      expect(result.requestsByDay[0].count).toBe(10);
      expect(result.byProvider).toHaveLength(1);
      expect(result.byProvider[0].provider).toBe('mock');
      expect(result.byStatus).toHaveLength(2);
      expect(result.tokenUsage.totalTokens).toBe(500);
      expect(result.tokenUsage.totalRequests).toBe(10);
      expect(result.topUsers).toHaveLength(1);
    });

    it('should accept custom days parameter', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      mockPrisma.aiLog.groupBy.mockResolvedValue([]);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _sum: { totalTokens: null, promptTokens: null, completionTokens: null },
        _avg: { latencyMs: null },
        _count: 0,
      });

      const result = await service.getUsageReport(undefined, 7);

      expect(result.period.days).toBe(7);
      expect(result.tokenUsage.totalTokens).toBe(0);
      expect(result.tokenUsage.avgLatencyMs).toBe(0);
    });

    it('should scope report to tenant when tenantId is provided', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      mockPrisma.aiLog.groupBy.mockResolvedValue([]);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _sum: { totalTokens: null, promptTokens: null, completionTokens: null },
        _avg: { latencyMs: null },
        _count: 0,
      });

      await service.getUsageReport('tenant-1', 30);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        'tenant-1',
        expect.any(Date),
      );
    });
  });

  describe('getComplianceReport', () => {
    it('should return compliance report', async () => {
      mockPrisma.policyLog.count.mockResolvedValue(5);
      mockPrisma.policyLog.groupBy.mockResolvedValue([
        { decision: 'DENIED', _count: 5 },
        { decision: 'ALLOWED', _count: 50 },
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(3);
      mockPrisma.policy.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);

      const result = await service.getComplianceReport();

      expect(result.period).toBe('last_30_days');
      expect(result.policyEnforcement.totalViolations).toBe(5);
      expect(result.policyEnforcement.deniedAiRequests).toBe(3);
      expect(result.policyEnforcement.totalPolicies).toBe(10);
      expect(result.policyEnforcement.activePolicies).toBe(8);
      expect(result.policyEnforcement.byDecision).toHaveLength(2);
    });

    it('should scope compliance report to tenant', async () => {
      mockPrisma.policyLog.count.mockResolvedValue(2);
      mockPrisma.policyLog.groupBy.mockResolvedValue([]);
      mockPrisma.aiLog.count.mockResolvedValue(1);
      mockPrisma.policy.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);

      const result = await service.getComplianceReport('tenant-1');

      expect(result.policyEnforcement.totalViolations).toBe(2);
      expect(result.policyEnforcement.totalPolicies).toBe(4);
    });
  });

  describe('getSecurityReport', () => {
    it('should return security report', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(10);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'LOGIN_FAILED',
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getSecurityReport();

      expect(result.failedLogins.last24h).toBe(3);
      expect(result.failedLogins.last7d).toBe(10);
      expect(result.lockedAccounts).toBe(1);
      expect(result.recentSecurityEvents).toHaveLength(1);
    });

    it('should scope security report to tenant', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getSecurityReport('tenant-1');

      expect(result.failedLogins.last24h).toBe(1);
      expect(result.lockedAccounts).toBe(0);
    });
  });

  describe('getTenantReport', () => {
    it('should return per-tenant report', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Acme Corp',
        slug: 'acme-corp',
        isActive: true,
        maxUsers: 50,
        createdAt: new Date(),
      });
      mockPrisma.user.count.mockResolvedValue(5);
      mockPrisma.policy.count.mockResolvedValue(3);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _count: 20,
        _sum: { totalTokens: 1000 },
        _avg: { latencyMs: 200 },
      });
      mockPrisma.document.count.mockResolvedValue(2);

      const result = await service.getTenantReport('tenant-1');

      expect(result.tenant!.name).toBe('Acme Corp');
      expect(result.stats.users).toBe(5);
      expect(result.stats.policies).toBe(3);
      expect(result.stats.documents).toBe(2);
      expect(result.stats.aiRequests).toBe(20);
      expect(result.stats.totalTokens).toBe(1000);
      expect(result.stats.avgLatencyMs).toBe(200);
    });

    it('should handle null aggregate values', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-2',
        name: 'New Tenant',
        slug: 'new-tenant',
        isActive: true,
        maxUsers: 10,
        createdAt: new Date(),
      });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.policy.count.mockResolvedValue(0);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { totalTokens: null },
        _avg: { latencyMs: null },
      });
      mockPrisma.document.count.mockResolvedValue(0);

      const result = await service.getTenantReport('tenant-2');

      expect(result.stats.totalTokens).toBe(0);
      expect(result.stats.avgLatencyMs).toBe(0);
    });
  });
});
