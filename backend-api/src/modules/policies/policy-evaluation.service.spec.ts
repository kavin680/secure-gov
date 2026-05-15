import { Test, TestingModule } from '@nestjs/testing';
import { PolicyEvaluationService } from './policy-evaluation.service';
import { PrismaService } from '../../database/prisma.service';
import { PolicyType, PolicyDecision } from '../../common/enums';

describe('PolicyEvaluationService', () => {
  let service: PolicyEvaluationService;

  const mockPrisma = {
    policy: {
      findMany: jest.fn(),
    },
    policyLog: {
      create: jest.fn(),
    },
    aiLog: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const baseContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    prompt: 'Hello world',
    model: 'gpt-4o',
  };

  const makePolicy = (
    type: string,
    rules: Record<string, unknown>,
    action = 'DENY',
  ) => ({
    id: `policy-${type}`,
    name: `Test ${type}`,
    type,
    rules,
    action,
    isActive: true,
    priority: 1,
    tenantId: 'tenant-1',
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.policyLog.create.mockResolvedValue({ id: 'log-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEvaluationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PolicyEvaluationService>(PolicyEvaluationService);
  });

  describe('evaluate', () => {
    it('should return ALLOWED when no active policies exist', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([]);

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe(PolicyDecision.ALLOWED);
      expect(result.reason).toBe('No active policies configured');
    });

    it('should return ALLOWED when all policies pass', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['forbidden'] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is a safe prompt',
      });

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe(PolicyDecision.ALLOWED);
      expect(result.reason).toBe('All policies passed');
    });
  });

  describe('KEYWORD_BLOCK', () => {
    it('should block prompts containing a blocked keyword', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['dangerous'] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is dangerous content',
      });

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe(PolicyDecision.DENIED);
      expect(result.policyType).toBe(PolicyType.KEYWORD_BLOCK);
      expect(result.reason).toContain('dangerous');
    });

    it('should be case-insensitive by default', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['SECRET'] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'this has a secret word',
      });

      expect(result.allowed).toBe(false);
    });

    it('should support case-sensitive mode', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', {
          keywords: ['SECRET'],
          caseSensitive: true,
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'this has a secret word',
      });

      expect(result.allowed).toBe(true);
    });

    it('should pass when no keywords match', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['forbidden', 'banned'] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is a normal prompt',
      });

      expect(result.allowed).toBe(true);
    });

    it('should skip evaluation when prompt is missing', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['test'] }),
      ]);

      const result = await service.evaluate({
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('MODEL_RESTRICT', () => {
    it('should deny restricted models', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('MODEL_RESTRICT', {
          allowedModels: ['gpt-3.5-turbo', 'gpt-4o-mini'],
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        model: 'gpt-4o',
      });

      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe(PolicyType.MODEL_RESTRICT);
    });

    it('should allow models in the allowed list', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('MODEL_RESTRICT', {
          allowedModels: ['gpt-4o', 'gpt-4o-mini'],
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        model: 'gpt-4o',
      });

      expect(result.allowed).toBe(true);
    });

    it('should be case-insensitive for model names', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('MODEL_RESTRICT', { allowedModels: ['GPT-4O'] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        model: 'gpt-4o',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('TOPIC_RESTRICT', () => {
    it('should block prompts with restricted topics', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('TOPIC_RESTRICT', {
          blockedTopics: ['weapons', 'hacking'],
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'Tell me about hacking systems',
      });

      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe(PolicyType.TOPIC_RESTRICT);
    });

    it('should allow prompts without restricted topics', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('TOPIC_RESTRICT', { blockedTopics: ['weapons'] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'Tell me about gardening',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('SENSITIVE_DATA', () => {
    it('should detect SSN patterns', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('SENSITIVE_DATA', {
          patterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'],
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'My SSN is 123-45-6789',
      });

      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe(PolicyType.SENSITIVE_DATA);
    });

    it('should detect email patterns', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('SENSITIVE_DATA', {
          patterns: ['[\\w.-]+@[\\w.-]+\\.[a-z]{2,}'],
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'Contact me at user@example.com',
      });

      expect(result.allowed).toBe(false);
    });

    it('should pass clean prompts', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('SENSITIVE_DATA', {
          patterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'],
        }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'Just a normal question',
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle invalid regex patterns gracefully', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('SENSITIVE_DATA', { patterns: ['[invalid('] }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'Some text',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('RATE_LIMIT', () => {
    it('should deny when rate limit is exceeded', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('RATE_LIMIT', {
          maxRequests: 10,
          windowSeconds: 60,
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(10);

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe(PolicyType.RATE_LIMIT);
      expect(result.reason).toContain('Rate limit exceeded');
    });

    it('should allow when under the rate limit', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('RATE_LIMIT', {
          maxRequests: 10,
          windowSeconds: 60,
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(5);

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(true);
    });

    it('should scope by user when scope is user', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('RATE_LIMIT', {
          maxRequests: 10,
          windowSeconds: 60,
          scope: 'user',
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(3);

      await service.evaluate(baseContext);

      expect(mockPrisma.aiLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        }),
      );
    });

    it('should not scope by user when scope is tenant', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('RATE_LIMIT', {
          maxRequests: 100,
          windowSeconds: 60,
          scope: 'tenant',
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(3);

      await service.evaluate(baseContext);

      const callArg = mockPrisma.aiLog.count.mock.calls[0][0];
      expect(callArg.where.userId).toBeUndefined();
    });
  });

  describe('USAGE_QUOTA', () => {
    it('should deny when daily request quota is exceeded', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('USAGE_QUOTA', {
          maxRequests: 100,
          period: 'daily',
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(100);

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe(PolicyType.USAGE_QUOTA);
      expect(result.reason).toContain('daily');
      expect(result.reason).toContain('request quota exceeded');
    });

    it('should deny when token quota is exceeded', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('USAGE_QUOTA', {
          maxTokens: 50000,
          period: 'monthly',
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(0);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _sum: { totalTokens: 60000 },
      });

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('token quota exceeded');
    });

    it('should allow when under quota', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('USAGE_QUOTA', {
          maxRequests: 100,
          maxTokens: 50000,
          period: 'daily',
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(50);
      mockPrisma.aiLog.aggregate.mockResolvedValue({
        _sum: { totalTokens: 20000 },
      });

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(true);
    });

    it('should handle weekly period', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('USAGE_QUOTA', {
          maxRequests: 500,
          period: 'weekly',
        }),
      ]);
      mockPrisma.aiLog.count.mockResolvedValue(501);

      const result = await service.evaluate(baseContext);

      expect(result.allowed).toBe(false);
    });
  });

  describe('CUSTOM', () => {
    it('should deny prompts exceeding max length', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('CUSTOM', { maxPromptLength: 10 }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This prompt is much longer than ten characters',
      });

      expect(result.allowed).toBe(false);
      expect(result.policyType).toBe(PolicyType.CUSTOM);
      expect(result.reason).toContain('maximum length');
    });

    it('should allow prompts within max length', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('CUSTOM', { maxPromptLength: 1000 }),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'Short prompt',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('policy actions', () => {
    it('should return FLAGGED decision for FLAG action', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['test'] }, 'FLAG'),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is a test',
      });

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe(PolicyDecision.FLAGGED);
    });

    it('should return LOGGED decision for LOG action', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['test'] }, 'LOG'),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is a test',
      });

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe(PolicyDecision.LOGGED);
    });

    it('should return RATE_LIMITED decision for RATE_LIMIT action', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['test'] }, 'RATE_LIMIT'),
      ]);

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is a test',
      });

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe(PolicyDecision.RATE_LIMITED);
    });
  });

  describe('logging', () => {
    it('should log policy decisions when a policy triggers', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['blocked'] }),
      ]);

      await service.evaluate({
        ...baseContext,
        prompt: 'This is blocked content',
      });

      expect(mockPrisma.policyLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          policyId: 'policy-KEYWORD_BLOCK',
          tenantId: 'tenant-1',
          decision: PolicyDecision.DENIED,
        }),
      });
    });

    it('should not log when all policies pass', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['forbidden'] }),
      ]);

      await service.evaluate({
        ...baseContext,
        prompt: 'Clean prompt',
      });

      expect(mockPrisma.policyLog.create).not.toHaveBeenCalled();
    });

    it('should handle logging errors gracefully', async () => {
      mockPrisma.policy.findMany.mockResolvedValue([
        makePolicy('KEYWORD_BLOCK', { keywords: ['test'] }),
      ]);
      mockPrisma.policyLog.create.mockRejectedValue(new Error('DB error'));

      const result = await service.evaluate({
        ...baseContext,
        prompt: 'This is a test',
      });

      expect(result.allowed).toBe(false);
    });
  });
});
