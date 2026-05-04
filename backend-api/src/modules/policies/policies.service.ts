import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { buildSearchFilter } from '../../database/helpers';
import { CreatePolicyDto, UpdatePolicyDto, PolicyQueryDto } from './dto';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  private readonly policySelect = {
    id: true,
    tenantId: true,
    name: true,
    description: true,
    type: true,
    rules: true,
    action: true,
    priority: true,
    isActive: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PolicyQueryDto, tenantId?: string) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);
    const searchFilter = buildSearchFilter(query.search, ['name']);

    const where: Record<string, unknown> = { ...searchFilter };

    if (tenantId) {
      where.tenantId = tenantId;
    } else if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.type) where.type = query.type;
    if (query.action) where.action = query.action;

    const [policies, total] = await Promise.all([
      this.prisma.policy.findMany({
        where,
        select: {
          ...this.policySelect,
          _count: { select: { policyLogs: true } },
        },
        skip,
        take,
        orderBy,
      }),
      this.prisma.policy.count({ where }),
    ]);

    return buildPaginatedResult(policies, query, total);
  }

  async findOne(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      select: {
        ...this.policySelect,
        _count: { select: { policyLogs: true } },
      },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  async create(dto: CreatePolicyDto, createdBy?: string) {
    const policy = await this.prisma.policy.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        rules: dto.rules,
        action: dto.action,
        priority: dto.priority,
        isActive: dto.isActive ?? true,
        createdBy,
      },
      select: this.policySelect,
    });

    this.logger.log(`Policy created: ${policy.name} (${policy.type})`);
    return policy;
  }

  async update(id: string, dto: UpdatePolicyDto) {
    await this.findOne(id);

    const policy = await this.prisma.policy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        rules: dto.rules ? (dto.rules as object) : undefined,
        action: dto.action,
        priority: dto.priority,
        isActive: dto.isActive,
      },
      select: this.policySelect,
    });

    this.logger.log(`Policy updated: ${policy.name}`);
    return policy;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.policy.delete({ where: { id } });

    this.logger.log(`Policy deleted: ${id}`);
    return { message: 'Policy deleted successfully' };
  }

  async toggleActive(id: string) {
    const policy = await this.findOne(id);

    const updated = await this.prisma.policy.update({
      where: { id },
      data: { isActive: !policy.isActive },
      select: this.policySelect,
    });

    this.logger.log(
      `Policy ${updated.isActive ? 'activated' : 'deactivated'}: ${updated.name}`,
    );
    return updated;
  }

  async getPolicyLogs(policyId: string, query: PolicyQueryDto) {
    await this.findOne(policyId);

    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where = { policyId };

    const [logs, total] = await Promise.all([
      this.prisma.policyLog.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      this.prisma.policyLog.count({ where }),
    ]);

    return buildPaginatedResult(logs, query, total);
  }

  async getTenantPolicyStats(tenantId: string) {
    const [totalPolicies, activePolicies, totalLogs, recentDenials] =
      await Promise.all([
        this.prisma.policy.count({ where: { tenantId } }),
        this.prisma.policy.count({ where: { tenantId, isActive: true } }),
        this.prisma.policyLog.count({ where: { tenantId } }),
        this.prisma.policyLog.count({
          where: {
            tenantId,
            decision: 'DENIED',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

    return {
      totalPolicies,
      activePolicies,
      inactivePolicies: totalPolicies - activePolicies,
      totalPolicyLogs: totalLogs,
      recentDenials24h: recentDenials,
    };
  }
}
