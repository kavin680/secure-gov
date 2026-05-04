import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { CreateAuditLogDto, AuditQueryDto } from './dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: dto.action,
          resource: dto.resource,
          resourceId: dto.resourceId,
          userId: dto.userId,
          requestId: dto.requestId,
          description: dto.description,
          metadata: dto.metadata ? (dto.metadata as object) : undefined,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', (error as Error).stack);
    }
  }

  async findAll(query: AuditQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Record<string, unknown> = {};
    if (query.action) where.action = query.action;
    if (query.resource) where.resource = query.resource;
    if (query.userId) where.userId = query.userId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(logs, query, total);
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }
}
