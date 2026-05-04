import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import {
  buildSearchFilter,
  buildSoftDeleteFilter,
} from '../../database/helpers';
import { CreateTenantDto, UpdateTenantDto } from './dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  private readonly tenantSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    isActive: true,
    maxUsers: true,
    settings: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);
    const searchFilter = buildSearchFilter(query.search, ['name', 'slug']);
    const softDeleteFilter = buildSoftDeleteFilter();

    const where = { ...softDeleteFilter, ...searchFilter };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        select: {
          ...this.tenantSelect,
          _count: { select: { users: true } },
        },
        skip,
        take,
        orderBy,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return buildPaginatedResult(tenants, query, total);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...this.tenantSelect,
        _count: { select: { users: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
      select: {
        ...this.tenantSelect,
        _count: { select: { users: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Tenant with this slug already exists');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        maxUsers: dto.maxUsers,
        settings: dto.settings ? (dto.settings as object) : undefined,
      },
      select: this.tenantSelect,
    });

    this.logger.log(`Tenant created: ${tenant.name} (${tenant.slug})`);
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        maxUsers: dto.maxUsers,
        settings: dto.settings ? (dto.settings as object) : undefined,
      },
      select: this.tenantSelect,
    });

    this.logger.log(`Tenant updated: ${tenant.name}`);
    return tenant;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Tenant soft-deleted: ${id}`);
    return { message: 'Tenant deleted successfully' };
  }

  async restore(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!tenant) {
      throw new NotFoundException('Deleted tenant not found');
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: null },
    });

    this.logger.log(`Tenant restored: ${id}`);
    return { message: 'Tenant restored successfully' };
  }

  async getStats(id: string) {
    const tenant = await this.findOne(id);

    const [userCount, activeUsers, auditLogCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.user.count({
        where: { tenantId: id, isActive: true, deletedAt: null },
      }),
      this.prisma.auditLog.count({ where: { tenantId: id } }),
    ]);

    return {
      tenant,
      stats: {
        totalUsers: userCount,
        activeUsers,
        maxUsers: tenant.maxUsers,
        auditLogCount,
      },
    };
  }

  async addUserToTenant(tenantId: string, userId: string) {
    const tenant = await this.findOne(tenantId);

    const userCount = await this.prisma.user.count({
      where: { tenantId, deletedAt: null },
    });

    if (userCount >= tenant.maxUsers) {
      throw new BadRequestException(
        `Tenant has reached the maximum number of users (${tenant.maxUsers})`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { tenantId },
    });

    this.logger.log(`User ${userId} added to tenant ${tenantId}`);
    return { message: 'User added to tenant successfully' };
  }

  async removeUserFromTenant(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found in this tenant');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { tenantId: null },
    });

    this.logger.log(`User ${userId} removed from tenant ${tenantId}`);
    return { message: 'User removed from tenant successfully' };
  }

  async getTenantUsers(tenantId: string, query: PaginationQueryDto) {
    await this.findOne(tenantId);

    const { skip, take, orderBy } = buildPrismaQueryOptions(query);
    const searchFilter = buildSearchFilter(query.search, [
      'email',
      'firstName',
      'lastName',
    ]);
    const softDeleteFilter = buildSoftDeleteFilter();

    const where = { tenantId, ...softDeleteFilter, ...searchFilter };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        skip,
        take,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(users, query, total);
  }
}
