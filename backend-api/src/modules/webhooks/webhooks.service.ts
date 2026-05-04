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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body,
        signal: AbortSignal.timeout(APP_CONSTANTS.WEBHOOKS.DELIVERY_TIMEOUT_MS),
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

      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: response.ok ? 0 : { increment: 1 },
        },
      });
    } catch (error) {
      this.logger.error(
        `Webhook delivery failed for ${url}: ${(error as Error).message}`,
      );

      await this.prisma.webhookLog.create({
        data: {
          webhookId,
          event,
          payload,
          success: false,
          error: (error as Error).message,
        },
      });

      await this.prisma.webhook.update({
        where: { id: webhookId },
        data: { failureCount: { increment: 1 } },
      });
    }
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
