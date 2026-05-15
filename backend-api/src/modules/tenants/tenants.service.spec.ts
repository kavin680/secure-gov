import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../database/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('TenantsService', () => {
  let service: TenantsService;

  const mockTenant = {
    id: 'tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    description: 'A test tenant',
    isActive: true,
    maxUsers: 50,
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { users: 3 },
  };

  const mockPrisma = {
    tenant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  describe('findAll', () => {
    it('should return paginated tenants', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([mockTenant]);
      mockPrisma.tenant.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply search filter', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);
      mockPrisma.tenant.count.mockResolvedValue(0);

      await service.findAll({ search: 'acme' });

      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should exclude soft-deleted tenants', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);
      mockPrisma.tenant.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('should return empty result when no tenants', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);
      mockPrisma.tenant.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a tenant by ID', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      const result = await service.findOne('tenant-1');

      expect(result.name).toBe('Acme Corp');
      expect(result.slug).toBe('acme-corp');
    });

    it('should throw NotFoundException if tenant not found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('should return a tenant by slug', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);

      const result = await service.findBySlug('acme-corp');

      expect(result.name).toBe('Acme Corp');
    });

    it('should throw NotFoundException if slug not found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'New Company',
      slug: 'new-company',
      description: 'A new company',
      maxUsers: 25,
    };

    it('should create a new tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({
        ...mockTenant,
        name: 'New Company',
        slug: 'new-company',
      });

      const result = await service.create(createDto);

      expect(result.name).toBe('New Company');
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Company',
            slug: 'new-company',
          }),
        }),
      );
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('should update an existing tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        name: 'Updated Corp',
      });

      const result = await service.update('tenant-1', { name: 'Updated Corp' });

      expect(result.name).toBe('Updated Corp');
    });

    it('should throw NotFoundException for nonexistent tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        deletedAt: new Date(),
      });

      const result = await service.remove('tenant-1');

      expect(result.message).toBe('Tenant deleted successfully');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for nonexistent tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({
        ...mockTenant,
        deletedAt: new Date(),
      });
      mockPrisma.tenant.update.mockResolvedValue({
        ...mockTenant,
        deletedAt: null,
      });

      const result = await service.restore('tenant-1');

      expect(result.message).toBe('Tenant restored successfully');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { deletedAt: null },
      });
    });

    it('should throw NotFoundException if tenant is not deleted', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.restore('tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return tenant statistics', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      mockPrisma.auditLog.count.mockResolvedValue(50);

      const result = await service.getStats('tenant-1');

      expect(result.tenant.name).toBe('Acme Corp');
      expect(result.stats.totalUsers).toBe(10);
      expect(result.stats.activeUsers).toBe(8);
      expect(result.stats.auditLogCount).toBe(50);
      expect(result.stats.maxUsers).toBe(50);
    });

    it('should throw NotFoundException for nonexistent tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.getStats('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addUserToTenant', () => {
    it('should add user to tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.user.count.mockResolvedValue(3);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        deletedAt: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.addUserToTenant('tenant-1', 'user-1');

      expect(result.message).toBe('User added to tenant successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tenantId: 'tenant-1' },
      });
    });

    it('should throw BadRequestException when tenant is full', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({
        ...mockTenant,
        maxUsers: 3,
      });
      mockPrisma.user.count.mockResolvedValue(3);

      await expect(
        service.addUserToTenant('tenant-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.user.count.mockResolvedValue(3);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.addUserToTenant('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeUserFromTenant', () => {
    it('should remove user from tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.removeUserFromTenant('tenant-1', 'user-1');

      expect(result.message).toBe('User removed from tenant successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tenantId: null },
      });
    });

    it('should throw NotFoundException when user not in tenant', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.removeUserFromTenant('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTenantUsers', () => {
    it('should return paginated tenant users', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@acme.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getTenantUsers('tenant-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should throw NotFoundException for nonexistent tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(
        service.getTenantUsers('nonexistent', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
