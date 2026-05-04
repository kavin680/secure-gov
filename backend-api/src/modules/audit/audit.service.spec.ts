import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '../../common/enums';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: AuditAction.CREATE,
        resource: 'User',
        resourceId: 'user-1',
        userId: 'admin-1',
        requestId: 'req-1',
        description: 'Created user',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.CREATE,
          resource: 'User',
          resourceId: 'user-1',
        }),
      });
    });

    it('should not throw when audit log creation fails', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({
          action: AuditAction.CREATE,
          resource: 'User',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const logs = [{ id: 'log-1', action: 'CREATE' }];
      mockPrisma.auditLog.findMany.mockResolvedValue(logs);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(logs);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ action: 'CREATE' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'CREATE' }),
        }),
      );
    });

    it('should filter by resource and userId', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ resource: 'User', userId: 'user-1' });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resource: 'User',
            userId: 'user-1',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single audit log', async () => {
      const log = { id: 'log-1', action: 'CREATE', resource: 'User' };
      mockPrisma.auditLog.findUnique.mockResolvedValue(log);

      const result = await service.findOne('log-1');

      expect(result).toEqual(log);
    });
  });
});
