import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils/pagination.util';

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    return flag?.enabled ?? false;
  }

  async findAll(query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);
    const [data, total] = await Promise.all([
      this.prisma.featureFlag.findMany({ skip, take, orderBy }),
      this.prisma.featureFlag.count(),
    ]);
    return buildPaginatedResult(data, query, total);
  }

  async findOne(id: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }

  async findByKey(key: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
    return flag;
  }

  async create(dto: CreateFeatureFlagDto) {
    this.logger.log(`Creating feature flag: ${dto.key}`);
    return this.prisma.featureFlag.create({ data: dto });
  }

  async update(id: string, dto: UpdateFeatureFlagDto) {
    await this.findOne(id);
    return this.prisma.featureFlag.update({ where: { id }, data: dto });
  }

  async toggle(id: string) {
    const flag = await this.findOne(id);
    this.logger.log(`Toggling feature flag '${flag.key}' to ${!flag.enabled}`);
    return this.prisma.featureFlag.update({
      where: { id },
      data: { enabled: !flag.enabled },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.featureFlag.delete({ where: { id } });
  }
}
