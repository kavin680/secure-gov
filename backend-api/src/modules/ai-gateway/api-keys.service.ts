import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiGatewayService } from './ai-gateway.service';
import { CreateApiKeyDto } from './dto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGatewayService: AiGatewayService,
  ) {}

  async create(dto: CreateApiKeyDto, tenantId: string, userId: string) {
    const existing = await this.prisma.apiKey.findUnique({
      where: { tenantId_provider: { tenantId, provider: dto.provider } },
    });

    if (existing) {
      throw new ConflictException(
        `An API key for provider "${dto.provider}" already exists for this tenant. Delete it first or update it.`,
      );
    }

    const keyHash = this.aiGatewayService.encryptApiKey(dto.apiKey);
    const keyPrefix = dto.apiKey.substring(0, 8) + '...';

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        provider: dto.provider,
        keyHash,
        keyPrefix,
        createdBy: userId,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      provider: apiKey.provider,
      keyPrefix: apiKey.keyPrefix,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    };
  }

  async findAll(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        provider: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return keys;
  }

  async remove(id: string, tenantId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id } });
    return { message: 'API key deleted successfully' };
  }

  async toggle(id: string, tenantId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: !apiKey.isActive },
      select: {
        id: true,
        name: true,
        provider: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
      },
    });

    return updated;
  }

  async rotate(id: string, newApiKey: string, tenantId: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const keyHash = this.aiGatewayService.encryptApiKey(newApiKey);
    const keyPrefix = newApiKey.substring(0, 8) + '...';

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { keyHash, keyPrefix },
      select: {
        id: true,
        name: true,
        provider: true,
        keyPrefix: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
