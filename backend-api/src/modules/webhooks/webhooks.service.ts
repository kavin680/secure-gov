import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { APP_CONSTANTS } from '../../common/constants';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { generateToken } from '../../common/utils/hash.util';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [webhooks, total] = await Promise.all([
      this.prisma.webhook.findMany({
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          isActive: true,
          lastTriggeredAt: true,
          failureCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.webhook.count(),
    ]);

    return buildPaginatedResult(webhooks, query, total);
  }

  async findOne(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async create(dto: CreateWebhookDto, userId: string) {
    const secret = dto.secret || `whsec_${generateToken(24)}`;
    return this.prisma.webhook.create({
      data: {
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secret,
        createdBy: userId,
      },
    });
  }

  async update(id: string, dto: UpdateWebhookDto) {
    await this.findOne(id);
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.webhook.delete({ where: { id } });
  }

  async trigger(event: string, payload: InputJsonValue) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    });

    for (const webhook of webhooks) {
      void this.deliverWebhook(
        webhook.id,
        webhook.url,
        webhook.secret,
        event,
        payload,
      );
    }
  }

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_BASE_DELAY_MS = 1000;

  private async deliverWebhook(
    webhookId: string,
    url: string,
    secret: string,
    event: string,
    payload: InputJsonValue,
  ) {
    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });
    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= WebhooksService.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay =
          WebhooksService.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        this.logger.log(
          `Retrying webhook ${webhookId} to ${url} (attempt ${attempt + 1}/${WebhooksService.MAX_RETRIES + 1})`,
        );
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'X-Webhook-Attempt': String(attempt + 1),
          },
          body,
          signal: AbortSignal.timeout(
            APP_CONSTANTS.WEBHOOKS.DELIVERY_TIMEOUT_MS,
          ),
        });

        await this.prisma.webhookLog.create({
          data: {
            webhookId,
            event,
            payload,
            statusCode: response.status,
            success: response.ok,
            response: await response.text().catch(() => null),
          },
        });

        if (response.ok) {
          await this.prisma.webhook.update({
            where: { id: webhookId },
            data: {
              lastTriggeredAt: new Date(),
              failureCount: 0,
            },
          });
          return;
        }

        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Webhook delivery attempt ${attempt + 1} failed for ${url}: ${lastError.message}`,
        );
      }
    }

    this.logger.error(
      `Webhook delivery failed after ${WebhooksService.MAX_RETRIES + 1} attempts for ${url}: ${lastError?.message}`,
    );

    await this.prisma.webhookLog.create({
      data: {
        webhookId,
        event,
        payload,
        success: false,
        error: `Failed after ${WebhooksService.MAX_RETRIES + 1} attempts: ${lastError?.message}`,
      },
    });

    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { failureCount: { increment: 1 } },
    });
  }

  async getLogs(webhookId: string, query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [logs, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where: { webhookId },
        skip,
        take,
        orderBy,
      }),
      this.prisma.webhookLog.count({ where: { webhookId } }),
    ]);

    return buildPaginatedResult(logs, query, total);
  }
}
