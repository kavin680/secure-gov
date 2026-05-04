import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PolicyEvaluationService } from '../policies/policy-evaluation.service';
import {
  AiProvider,
  AiCompletionResponse,
  OpenAiProvider,
  AnthropicProvider,
  GeminiProvider,
  MockAiProvider,
} from './providers';
import { ChatRequestDto } from './dto';
import { AiLogQueryDto } from './dto';
import * as crypto from 'crypto';

export interface AiGatewayResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  logId: string;
  policyCheck: {
    allowed: boolean;
    decision: string;
    policyName?: string;
  };
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly providers: Map<string, AiProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyEvaluation: PolicyEvaluationService,
    private readonly openaiProvider: OpenAiProvider,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly mockProvider: MockAiProvider,
  ) {
    this.providers = new Map<string, AiProvider>();
    this.providers.set('openai', this.openaiProvider);
    this.providers.set('anthropic', this.anthropicProvider);
    this.providers.set('gemini', this.geminiProvider);
    this.providers.set('mock', this.mockProvider);
  }

  async chat(
    dto: ChatRequestDto,
    userId: string,
    tenantId: string,
  ): Promise<AiGatewayResponse> {
    const startTime = Date.now();
    const userPrompt =
      dto.messages.filter((m) => m.role === 'user').pop()?.content ?? '';

    // 1. Evaluate policies
    const policyResult = await this.policyEvaluation.evaluate({
      tenantId,
      userId,
      prompt: userPrompt,
      model: dto.model,
    });

    if (!policyResult.allowed) {
      const logId = await this.createAiLog({
        tenantId,
        userId,
        provider: dto.provider ?? this.detectProvider(dto.model),
        model: dto.model,
        prompt: userPrompt,
        status: 'DENIED',
        policyDecision: policyResult.decision,
        policyId: policyResult.policyId,
        latencyMs: Date.now() - startTime,
        errorMessage: policyResult.reason,
      });

      throw new ForbiddenException({
        message: 'Request blocked by policy',
        policyName: policyResult.policyName,
        policyType: policyResult.policyType,
        reason: policyResult.reason,
        decision: policyResult.decision,
        logId,
      });
    }

    // 2. Resolve provider
    const providerName = dto.provider ?? this.detectProvider(dto.model);
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new BadRequestException(
        `Unknown AI provider: ${providerName}. Available: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }

    // 3. Get API key (mock doesn't need one)
    let apiKey = '';
    if (providerName !== 'mock') {
      apiKey = await this.getApiKeyForTenant(tenantId, providerName);
    }

    // 4. Forward request to AI provider
    let aiResponse: AiCompletionResponse;
    try {
      aiResponse = await provider.chat(
        {
          model: dto.model,
          messages: dto.messages,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
        apiKey,
      );
    } catch (error) {
      const logId = await this.createAiLog({
        tenantId,
        userId,
        provider: providerName,
        model: dto.model,
        prompt: userPrompt,
        status: 'FAILED',
        policyDecision: policyResult.decision,
        latencyMs: Date.now() - startTime,
        errorMessage: (error as Error).message,
      });

      throw new BadRequestException({
        message: `AI provider error: ${(error as Error).message}`,
        logId,
      });
    }

    // 5. Log successful request
    const latencyMs = Date.now() - startTime;
    const logId = await this.createAiLog({
      tenantId,
      userId,
      provider: providerName,
      model: aiResponse.model,
      prompt: userPrompt,
      response: aiResponse.content,
      promptTokens: aiResponse.promptTokens,
      completionTokens: aiResponse.completionTokens,
      totalTokens: aiResponse.totalTokens,
      status: 'SUCCESS',
      policyDecision: policyResult.decision,
      latencyMs,
    });

    return {
      content: aiResponse.content,
      model: aiResponse.model,
      provider: providerName,
      usage: {
        promptTokens: aiResponse.promptTokens,
        completionTokens: aiResponse.completionTokens,
        totalTokens: aiResponse.totalTokens,
      },
      latencyMs,
      logId,
      policyCheck: {
        allowed: true,
        decision: policyResult.decision,
      },
    };
  }

  async getLogs(query: AiLogQueryDto, tenantId?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (query.provider) where.provider = query.provider;
    if (query.status) where.status = query.status;
    if (query.model) where.model = query.model;

    const [data, total] = await Promise.all([
      this.prisma.aiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          userId: true,
          provider: true,
          model: true,
          prompt: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          latencyMs: true,
          status: true,
          policyDecision: true,
          cost: true,
          createdAt: true,
        },
      }),
      this.prisma.aiLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getLogById(id: string) {
    return this.prisma.aiLog.findUniqueOrThrow({ where: { id } });
  }

  async getUsageStats(tenantId: string) {
    const [totalRequests, last24h, byProvider, byStatus] = await Promise.all([
      this.prisma.aiLog.count({ where: { tenantId } }),
      this.prisma.aiLog.count({
        where: {
          tenantId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.aiLog.groupBy({
        by: ['provider'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.aiLog.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    const tokenStats = await this.prisma.aiLog.aggregate({
      where: { tenantId, status: 'SUCCESS' },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _avg: {
        latencyMs: true,
      },
    });

    return {
      totalRequests,
      requestsLast24h: last24h,
      totalTokensUsed: tokenStats._sum.totalTokens ?? 0,
      totalPromptTokens: tokenStats._sum.promptTokens ?? 0,
      totalCompletionTokens: tokenStats._sum.completionTokens ?? 0,
      avgLatencyMs: Math.round(tokenStats._avg.latencyMs ?? 0),
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    };
  }

  async getSupportedProviders() {
    const result: Array<{
      name: string;
      models: string[];
    }> = [];

    for (const [name, provider] of this.providers) {
      result.push({
        name,
        models: provider.supportedModels,
      });
    }

    return result;
  }

  private detectProvider(model: string): string {
    const lower = model.toLowerCase();

    if (
      lower.startsWith('gpt-') ||
      lower.startsWith('o1') ||
      lower.startsWith('o3')
    ) {
      return 'openai';
    }
    if (lower.startsWith('claude-')) {
      return 'anthropic';
    }
    if (lower.startsWith('gemini-')) {
      return 'gemini';
    }

    return 'mock';
  }

  private async getApiKeyForTenant(
    tenantId: string,
    provider: string,
  ): Promise<string> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { tenantId, provider, isActive: true },
    });

    if (!apiKey) {
      throw new BadRequestException(
        `No active API key configured for provider "${provider}" in this tenant. ` +
          'Please add an API key via POST /api/v1/ai/api-keys or use provider "mock" for testing.',
      );
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return this.decryptApiKey(apiKey.keyHash);
  }

  private async createAiLog(data: {
    tenantId: string;
    userId: string;
    provider: string;
    model: string;
    prompt: string;
    response?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    status: string;
    policyDecision?: string;
    policyId?: string;
    latencyMs: number;
    errorMessage?: string;
  }): Promise<string> {
    const log = await this.prisma.aiLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        provider: data.provider,
        model: data.model,
        prompt: data.prompt.substring(0, 5000),
        response: data.response?.substring(0, 10000),
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        status: data.status as
          | 'PENDING'
          | 'SUCCESS'
          | 'FAILED'
          | 'DENIED'
          | 'RATE_LIMITED',
        policyDecision: data.policyDecision,
        policyId: data.policyId,
        latencyMs: data.latencyMs,
        errorMessage: data.errorMessage,
      },
    });
    return log.id;
  }

  encryptApiKey(plainKey: string): string {
    const secret =
      process.env.API_KEY_ENCRYPTION_SECRET ||
      'default-dev-secret-change-in-production';
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secret, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptApiKey(encrypted: string): string {
    const secret =
      process.env.API_KEY_ENCRYPTION_SECRET ||
      'default-dev-secret-change-in-production';
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(secret, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
