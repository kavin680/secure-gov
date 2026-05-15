import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PolicyType, PolicyAction, PolicyDecision } from '../../common/enums';

export interface PolicyEvaluationResult {
  allowed: boolean;
  decision: PolicyDecision;
  policyId?: string;
  policyName?: string;
  policyType?: PolicyType;
  reason?: string;
  matchedRule?: Record<string, unknown>;
}

export interface EvaluationContext {
  tenantId: string;
  userId?: string;
  prompt?: string;
  model?: string;
  requestPath?: string;
  requestMethod?: string;
}

interface KeywordBlockRules {
  keywords: string[];
  caseSensitive?: boolean;
}

interface ModelRestrictRules {
  allowedModels: string[];
}

interface TopicRestrictRules {
  blockedTopics: string[];
  caseSensitive?: boolean;
}

interface SensitiveDataRules {
  patterns: string[];
}

interface RateLimitRules {
  maxRequests: number;
  windowSeconds: number;
  scope?: 'user' | 'tenant';
}

interface UsageQuotaRules {
  maxTokens?: number;
  maxRequests?: number;
  period: 'daily' | 'weekly' | 'monthly';
}

@Injectable()
export class PolicyEvaluationService {
  private readonly logger = new Logger(PolicyEvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(context: EvaluationContext): Promise<PolicyEvaluationResult> {
    const policies = await this.prisma.policy.findMany({
      where: {
        tenantId: context.tenantId,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    if (policies.length === 0) {
      return {
        allowed: true,
        decision: PolicyDecision.ALLOWED,
        reason: 'No active policies configured',
      };
    }

    for (const policy of policies) {
      const result = await this.evaluatePolicy(policy, context);

      if (result) {
        await this.logPolicyDecision(policy, context, result);
        return result;
      }
    }

    return {
      allowed: true,
      decision: PolicyDecision.ALLOWED,
      reason: 'All policies passed',
    };
  }

  private async evaluatePolicy(
    policy: {
      id: string;
      name: string;
      type: string;
      rules: unknown;
      action: string;
    },
    context: EvaluationContext,
  ): Promise<PolicyEvaluationResult | null> {
    const rules = policy.rules as Record<string, unknown>;

    switch (policy.type as PolicyType) {
      case PolicyType.KEYWORD_BLOCK:
        return this.evaluateKeywordBlock(
          policy,
          rules as unknown as KeywordBlockRules,
          context,
        );
      case PolicyType.MODEL_RESTRICT:
        return this.evaluateModelRestrict(
          policy,
          rules as unknown as ModelRestrictRules,
          context,
        );
      case PolicyType.TOPIC_RESTRICT:
        return this.evaluateTopicRestrict(
          policy,
          rules as unknown as TopicRestrictRules,
          context,
        );
      case PolicyType.SENSITIVE_DATA:
        return this.evaluateSensitiveData(
          policy,
          rules as unknown as SensitiveDataRules,
          context,
        );
      case PolicyType.RATE_LIMIT:
        return this.evaluateRateLimit(
          policy,
          rules as unknown as RateLimitRules,
          context,
        );
      case PolicyType.USAGE_QUOTA:
        return this.evaluateUsageQuota(
          policy,
          rules as unknown as UsageQuotaRules,
          context,
        );
      case PolicyType.CUSTOM:
        return this.evaluateCustom(policy, rules, context);
      default:
        return null;
    }
  }

  private evaluateKeywordBlock(
    policy: { id: string; name: string; action: string },
    rules: KeywordBlockRules,
    context: EvaluationContext,
  ): PolicyEvaluationResult | null {
    if (!context.prompt || !rules.keywords?.length) return null;

    const prompt = rules.caseSensitive
      ? context.prompt
      : context.prompt.toLowerCase();

    for (const keyword of rules.keywords) {
      const kw = rules.caseSensitive ? keyword : keyword.toLowerCase();
      if (prompt.includes(kw)) {
        return this.buildResult(policy, PolicyType.KEYWORD_BLOCK, {
          reason: `Prompt contains blocked keyword: "${keyword}"`,
          matchedRule: { keyword, type: 'keyword_block' },
        });
      }
    }

    return null;
  }

  private evaluateModelRestrict(
    policy: { id: string; name: string; action: string },
    rules: ModelRestrictRules,
    context: EvaluationContext,
  ): PolicyEvaluationResult | null {
    if (!context.model || !rules.allowedModels?.length) return null;

    const isAllowed = rules.allowedModels.some(
      (m) => m.toLowerCase() === context.model!.toLowerCase(),
    );

    if (!isAllowed) {
      return this.buildResult(policy, PolicyType.MODEL_RESTRICT, {
        reason: `Model "${context.model}" is not in the allowed list: [${rules.allowedModels.join(', ')}]`,
        matchedRule: {
          requestedModel: context.model,
          allowedModels: rules.allowedModels,
          type: 'model_restrict',
        },
      });
    }

    return null;
  }

  private evaluateTopicRestrict(
    policy: { id: string; name: string; action: string },
    rules: TopicRestrictRules,
    context: EvaluationContext,
  ): PolicyEvaluationResult | null {
    if (!context.prompt || !rules.blockedTopics?.length) return null;

    const prompt = rules.caseSensitive
      ? context.prompt
      : context.prompt.toLowerCase();

    for (const topic of rules.blockedTopics) {
      const t = rules.caseSensitive ? topic : topic.toLowerCase();
      if (prompt.includes(t)) {
        return this.buildResult(policy, PolicyType.TOPIC_RESTRICT, {
          reason: `Prompt contains blocked topic: "${topic}"`,
          matchedRule: { topic, type: 'topic_restrict' },
        });
      }
    }

    return null;
  }

  private evaluateSensitiveData(
    policy: { id: string; name: string; action: string },
    rules: SensitiveDataRules,
    context: EvaluationContext,
  ): PolicyEvaluationResult | null {
    if (!context.prompt || !rules.patterns?.length) return null;

    for (const pattern of rules.patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(context.prompt)) {
          return this.buildResult(policy, PolicyType.SENSITIVE_DATA, {
            reason: `Prompt contains sensitive data matching pattern`,
            matchedRule: { pattern, type: 'sensitive_data' },
          });
        }
      } catch {
        this.logger.warn(`Invalid regex pattern in policy: ${pattern}`);
      }
    }

    return null;
  }

  private async evaluateRateLimit(
    policy: { id: string; name: string; action: string },
    rules: RateLimitRules,
    context: EvaluationContext,
  ): Promise<PolicyEvaluationResult | null> {
    if (!rules.maxRequests || !rules.windowSeconds) return null;

    const windowStart = new Date(Date.now() - rules.windowSeconds * 1000);

    const scope = rules.scope || 'user';
    const where: Record<string, unknown> = {
      tenantId: context.tenantId,
      createdAt: { gte: windowStart },
    };

    if (scope === 'user' && context.userId) {
      where.userId = context.userId;
    }

    const requestCount = await this.prisma.aiLog.count({ where });

    if (requestCount >= rules.maxRequests) {
      return this.buildResult(policy, PolicyType.RATE_LIMIT, {
        reason: `Rate limit exceeded: ${requestCount}/${rules.maxRequests} requests in ${rules.windowSeconds}s window`,
        matchedRule: {
          maxRequests: rules.maxRequests,
          windowSeconds: rules.windowSeconds,
          currentCount: requestCount,
          scope,
          type: 'rate_limit',
        },
      });
    }

    return null;
  }

  private async evaluateUsageQuota(
    policy: { id: string; name: string; action: string },
    rules: UsageQuotaRules,
    context: EvaluationContext,
  ): Promise<PolicyEvaluationResult | null> {
    if (!rules.period) return null;
    if (!rules.maxTokens && !rules.maxRequests) return null;

    const now = new Date();
    let periodStart: Date;

    switch (rules.period) {
      case 'daily':
        periodStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        break;
      case 'weekly': {
        const day = now.getDay();
        periodStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - day,
        );
        break;
      }
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return null;
    }

    const where = {
      tenantId: context.tenantId,
      createdAt: { gte: periodStart },
      status: 'SUCCESS' as const,
    };

    if (rules.maxRequests) {
      const requestCount = await this.prisma.aiLog.count({ where });
      if (requestCount >= rules.maxRequests) {
        return this.buildResult(policy, PolicyType.USAGE_QUOTA, {
          reason: `${rules.period} request quota exceeded: ${requestCount}/${rules.maxRequests}`,
          matchedRule: {
            maxRequests: rules.maxRequests,
            currentCount: requestCount,
            period: rules.period,
            type: 'usage_quota',
          },
        });
      }
    }

    if (rules.maxTokens) {
      const tokenUsage = await this.prisma.aiLog.aggregate({
        where,
        _sum: { totalTokens: true },
      });
      const totalTokens = tokenUsage._sum.totalTokens ?? 0;
      if (totalTokens >= rules.maxTokens) {
        return this.buildResult(policy, PolicyType.USAGE_QUOTA, {
          reason: `${rules.period} token quota exceeded: ${totalTokens}/${rules.maxTokens}`,
          matchedRule: {
            maxTokens: rules.maxTokens,
            currentTokens: totalTokens,
            period: rules.period,
            type: 'usage_quota',
          },
        });
      }
    }

    return null;
  }

  private evaluateCustom(
    policy: { id: string; name: string; action: string },
    rules: Record<string, unknown>,
    context: EvaluationContext,
  ): PolicyEvaluationResult | null {
    if (!context.prompt) return null;

    const maxLength = rules.maxPromptLength as number | undefined;
    if (maxLength && context.prompt.length > maxLength) {
      return this.buildResult(policy, PolicyType.CUSTOM, {
        reason: `Prompt exceeds maximum length of ${maxLength} characters`,
        matchedRule: {
          maxPromptLength: maxLength,
          actualLength: context.prompt.length,
          type: 'custom',
        },
      });
    }

    return null;
  }

  private buildResult(
    policy: { id: string; name: string; action: string },
    type: PolicyType,
    details: { reason: string; matchedRule: Record<string, unknown> },
  ): PolicyEvaluationResult {
    const action = policy.action as PolicyAction;
    let decision: PolicyDecision;
    let allowed: boolean;

    switch (action) {
      case PolicyAction.DENY:
        decision = PolicyDecision.DENIED;
        allowed = false;
        break;
      case PolicyAction.FLAG:
        decision = PolicyDecision.FLAGGED;
        allowed = true;
        break;
      case PolicyAction.LOG:
        decision = PolicyDecision.LOGGED;
        allowed = true;
        break;
      case PolicyAction.RATE_LIMIT:
        decision = PolicyDecision.RATE_LIMITED;
        allowed = false;
        break;
      default:
        decision = PolicyDecision.DENIED;
        allowed = false;
    }

    return {
      allowed,
      decision,
      policyId: policy.id,
      policyName: policy.name,
      policyType: type,
      reason: details.reason,
      matchedRule: details.matchedRule,
    };
  }

  private async logPolicyDecision(
    policy: { id: string; action: string },
    context: EvaluationContext,
    result: PolicyEvaluationResult,
  ): Promise<void> {
    try {
      await this.prisma.policyLog.create({
        data: {
          policyId: policy.id,
          tenantId: context.tenantId,
          userId: context.userId,
          action: policy.action,
          decision: result.decision,
          requestPath: context.requestPath,
          requestMethod: context.requestMethod,
          prompt: context.prompt
            ? context.prompt.substring(0, 1000)
            : undefined,
          matchedRule: result.matchedRule
            ? (result.matchedRule as object)
            : undefined,
          metadata: {
            model: context.model,
            reason: result.reason,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to log policy decision',
        (error as Error).stack,
      );
    }
  }
}
