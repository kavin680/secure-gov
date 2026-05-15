import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { PrismaService } from '../../database/prisma.service';
import { PolicyEvaluationService } from '../policies/policy-evaluation.service';
import {
  OpenAiProvider,
  AnthropicProvider,
  GeminiProvider,
  MockAiProvider,
} from './providers';
import { PolicyDecision } from '../../common/enums';

describe('AiGatewayService', () => {
  let service: AiGatewayService;

  const mockPrisma = {
    aiLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    apiKey: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPolicyEvaluation = {
    evaluate: jest.fn(),
  };

  const mockOpenai = {
    name: 'openai',
    supportedModels: ['gpt-4o', 'gpt-4o-mini'],
    chat: jest.fn(),
    isModelSupported: jest.fn(),
  };

  const mockAnthropic = {
    name: 'anthropic',
    supportedModels: ['claude-3-opus'],
    chat: jest.fn(),
    isModelSupported: jest.fn(),
  };

  const mockGemini = {
    name: 'gemini',
    supportedModels: ['gemini-1.5-pro'],
    chat: jest.fn(),
    isModelSupported: jest.fn(),
  };

  const mockMockProvider = {
    name: 'mock',
    supportedModels: ['mock-model'],
    chat: jest.fn(),
    isModelSupported: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.aiLog.create.mockResolvedValue({ id: 'log-1' });
    mockPolicyEvaluation.evaluate.mockResolvedValue({
      allowed: true,
      decision: PolicyDecision.ALLOWED,
      reason: 'All policies passed',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiGatewayService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PolicyEvaluationService, useValue: mockPolicyEvaluation },
        { provide: OpenAiProvider, useValue: mockOpenai },
        { provide: AnthropicProvider, useValue: mockAnthropic },
        { provide: GeminiProvider, useValue: mockGemini },
        { provide: MockAiProvider, useValue: mockMockProvider },
      ],
    }).compile();

    service = module.get<AiGatewayService>(AiGatewayService);
  });

  describe('chat', () => {
    const chatDto = {
      model: 'mock-model',
      provider: 'mock',
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    it('should process a chat request successfully', async () => {
      mockMockProvider.chat.mockResolvedValue({
        content: 'Hello back!',
        model: 'mock-model',
        promptTokens: 2,
        completionTokens: 3,
        totalTokens: 5,
        finishReason: 'stop',
      });

      const result = await service.chat(chatDto, 'user-1', 'tenant-1');

      expect(result.content).toBe('Hello back!');
      expect(result.provider).toBe('mock');
      expect(result.policyCheck.allowed).toBe(true);
      expect(result.logId).toBe('log-1');
    });

    it('should evaluate policies before forwarding to provider', async () => {
      mockMockProvider.chat.mockResolvedValue({
        content: 'Response',
        model: 'mock-model',
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        finishReason: 'stop',
      });

      await service.chat(chatDto, 'user-1', 'tenant-1');

      expect(mockPolicyEvaluation.evaluate).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        prompt: 'Hello',
        model: 'mock-model',
      });
    });

    it('should throw ForbiddenException when policy denies request', async () => {
      mockPolicyEvaluation.evaluate.mockResolvedValue({
        allowed: false,
        decision: PolicyDecision.DENIED,
        policyName: 'Block Keywords',
        policyType: 'KEYWORD_BLOCK',
        reason: 'Blocked keyword detected',
      });

      await expect(service.chat(chatDto, 'user-1', 'tenant-1')).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockMockProvider.chat).not.toHaveBeenCalled();
    });

    it('should log denied requests', async () => {
      mockPolicyEvaluation.evaluate.mockResolvedValue({
        allowed: false,
        decision: PolicyDecision.DENIED,
        policyId: 'policy-1',
        reason: 'Blocked',
      });

      try {
        await service.chat(chatDto, 'user-1', 'tenant-1');
      } catch {
        // expected
      }

      expect(mockPrisma.aiLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'DENIED',
          policyDecision: PolicyDecision.DENIED,
        }),
      });
    });

    it('should throw BadRequestException for unknown provider', async () => {
      const dto = {
        ...chatDto,
        provider: 'unknown-provider',
      };

      await expect(service.chat(dto, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect OpenAI provider from model name', async () => {
      const dto = {
        model: 'gpt-4o',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      mockOpenai.chat.mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        finishReason: 'stop',
      });

      mockPrisma.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        keyHash: service.encryptApiKey('sk-test-key'),
        isActive: true,
      });

      const result = await service.chat(dto, 'user-1', 'tenant-1');

      expect(result.provider).toBe('openai');
      expect(mockOpenai.chat).toHaveBeenCalled();
    });

    it('should require API key for non-mock providers', async () => {
      const dto = {
        model: 'gpt-4o',
        provider: 'openai',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.chat(dto, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not require API key for mock provider', async () => {
      mockMockProvider.chat.mockResolvedValue({
        content: 'Mock response',
        model: 'mock-model',
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
        finishReason: 'stop',
      });

      const result = await service.chat(chatDto, 'user-1', 'tenant-1');

      expect(mockPrisma.apiKey.findFirst).not.toHaveBeenCalled();
      expect(result.content).toBe('Mock response');
    });

    it('should handle AI provider errors', async () => {
      mockMockProvider.chat.mockRejectedValue(new Error('Provider timeout'));

      await expect(service.chat(chatDto, 'user-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPrisma.aiLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Provider timeout',
        }),
      });
    });

    it('should log successful requests with token usage', async () => {
      mockMockProvider.chat.mockResolvedValue({
        content: 'Response text',
        model: 'mock-model',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        finishReason: 'stop',
      });

      await service.chat(chatDto, 'user-1', 'tenant-1');

      expect(mockPrisma.aiLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'SUCCESS',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        }),
      });
    });
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      const logs = [{ id: 'log-1', provider: 'mock' }];
      mockPrisma.aiLog.findMany.mockResolvedValue(logs);
      mockPrisma.aiLog.count.mockResolvedValue(1);

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result.data).toEqual(logs);
      expect(result.meta.total).toBe(1);
    });

    it('should filter logs by provider', async () => {
      mockPrisma.aiLog.findMany.mockResolvedValue([]);
      mockPrisma.aiLog.count.mockResolvedValue(0);

      await service.getLogs({ provider: 'openai' });

      expect(mockPrisma.aiLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ provider: 'openai' }),
        }),
      );
    });

    it('should filter logs by status', async () => {
      mockPrisma.aiLog.findMany.mockResolvedValue([]);
      mockPrisma.aiLog.count.mockResolvedValue(0);

      await service.getLogs({ status: 'DENIED' });

      expect(mockPrisma.aiLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DENIED' }),
        }),
      );
    });

    it('should scope logs by tenantId', async () => {
      mockPrisma.aiLog.findMany.mockResolvedValue([]);
      mockPrisma.aiLog.count.mockResolvedValue(0);

      await service.getLogs({}, 'tenant-1');

      expect(mockPrisma.aiLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics', async () => {
      mockPrisma.aiLog.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(25);
      mockPrisma.aiLog.groupBy
        .mockResolvedValueOnce([
          { provider: 'openai', _count: 60 },
          { provider: 'mock', _count: 40 },
        ])
        .mockResolvedValueOnce([
          { status: 'SUCCESS', _count: 90 },
          { status: 'DENIED', _count: 10 },
        ]);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _sum: {
          promptTokens: 5000,
          completionTokens: 3000,
          totalTokens: 8000,
        },
        _avg: { latencyMs: 250 },
      });

      const result = await service.getUsageStats('tenant-1');

      expect(result.totalRequests).toBe(100);
      expect(result.requestsLast24h).toBe(25);
      expect(result.totalTokensUsed).toBe(8000);
      expect(result.avgLatencyMs).toBe(250);
      expect(result.byProvider).toHaveLength(2);
      expect(result.byStatus).toHaveLength(2);
    });
  });

  describe('getSupportedProviders', () => {
    it('should return all registered providers with models', async () => {
      const result = await service.getSupportedProviders();

      expect(result).toHaveLength(4);
      const names = result.map((p) => p.name);
      expect(names).toContain('openai');
      expect(names).toContain('anthropic');
      expect(names).toContain('gemini');
      expect(names).toContain('mock');
    });
  });

  describe('encryptApiKey / decryptApiKey', () => {
    it('should encrypt and decrypt API keys correctly', () => {
      const plainKey = 'sk-test-1234567890';
      const encrypted = service.encryptApiKey(plainKey);
      const decrypted = service.decryptApiKey(encrypted);

      expect(decrypted).toBe(plainKey);
      expect(encrypted).not.toBe(plainKey);
    });

    it('should produce different ciphertexts for the same key', () => {
      const plainKey = 'sk-test-key';
      const encrypted1 = service.encryptApiKey(plainKey);
      const encrypted2 = service.encryptApiKey(plainKey);

      expect(encrypted1).not.toBe(encrypted2);
      expect(service.decryptApiKey(encrypted1)).toBe(plainKey);
      expect(service.decryptApiKey(encrypted2)).toBe(plainKey);
    });
  });
});
