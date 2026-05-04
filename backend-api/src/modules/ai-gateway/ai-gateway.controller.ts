import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AiGatewayService } from './ai-gateway.service';
import { ApiKeysService } from './api-keys.service';
import { ChatRequestDto, AiLogQueryDto, CreateApiKeyDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums';
import type { JwtPayload } from '../../common/interfaces';

@ApiTags('AI Gateway')
@ApiBearerAuth()
@Controller('ai')
export class AiGatewayController {
  constructor(
    private readonly aiGatewayService: AiGatewayService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  // ─── Chat / Completion ───────────────────────────────────────────────────────

  @Post('chat')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({
    summary: 'Send a chat request through the AI Gateway',
    description:
      'Evaluates policies, then forwards the request to the specified AI provider. ' +
      'Logs prompt, response, tokens, and latency. Returns 403 if any policy blocks the request.',
  })
  @ApiResponse({ status: 200, description: 'AI response' })
  @ApiResponse({ status: 403, description: 'Blocked by policy' })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or AI provider error',
  })
  async chat(@Body() dto: ChatRequestDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException(
        'AI Gateway requires a tenant context. Platform admins should use a tenant-scoped account.',
      );
    }
    return this.aiGatewayService.chat(dto, user.sub, user.tenantId);
  }

  // ─── Providers ───────────────────────────────────────────────────────────────

  @Get('providers')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({
    summary: 'List supported AI providers and their models',
  })
  @ApiResponse({ status: 200, description: 'List of providers with models' })
  getSupportedProviders() {
    return this.aiGatewayService.getSupportedProviders();
  }

  // ─── Usage Logs ──────────────────────────────────────────────────────────────

  @Get('logs')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get AI request logs (tenant-scoped)',
    description:
      'Returns paginated AI request logs. Super Admins see all, Tenant Admins see their own.',
  })
  @ApiResponse({ status: 200, description: 'Paginated AI logs' })
  getLogs(@Query() query: AiLogQueryDto, @CurrentUser() user: JwtPayload) {
    const tenantId = user.role === Role.SUPER_ADMIN ? undefined : user.tenantId;
    return this.aiGatewayService.getLogs(query, tenantId);
  }

  @Get('logs/:id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get a specific AI log entry by ID' })
  @ApiParam({ name: 'id', description: 'AI Log UUID' })
  @ApiResponse({ status: 200, description: 'AI log details' })
  getLogById(@Param('id') id: string) {
    return this.aiGatewayService.getLogById(id);
  }

  @Get('usage')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get AI usage statistics for tenant',
    description:
      'Returns aggregated statistics: total requests, token usage, provider breakdown, status breakdown.',
  })
  @ApiResponse({ status: 200, description: 'Usage statistics' })
  getUsageStats(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      return {
        totalRequests: 0,
        requestsLast24h: 0,
        totalTokensUsed: 0,
        byProvider: [],
        byStatus: [],
      };
    }
    return this.aiGatewayService.getUsageStats(user.tenantId);
  }

  // ─── API Key Management ──────────────────────────────────────────────────────

  @Post('api-keys')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Add an API key for an AI provider',
    description:
      'Stores an encrypted API key for a specific AI provider (OpenAI, Anthropic, Gemini). ' +
      'One key per provider per tenant.',
  })
  @ApiResponse({ status: 201, description: 'API key created' })
  @ApiResponse({ status: 409, description: 'Key already exists for provider' })
  createApiKey(@Body() dto: CreateApiKeyDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('API keys require a tenant context');
    }
    return this.apiKeysService.create(dto, user.tenantId, user.sub);
  }

  @Get('api-keys')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'List API keys for tenant (keys are masked)' })
  @ApiResponse({ status: 200, description: 'List of API keys' })
  listApiKeys(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      return [];
    }
    return this.apiKeysService.findAll(user.tenantId);
  }

  @Delete('api-keys/:id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiParam({ name: 'id', description: 'API Key UUID' })
  @ApiResponse({ status: 200, description: 'API key deleted' })
  deleteApiKey(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('API keys require a tenant context');
    }
    return this.apiKeysService.remove(id, user.tenantId);
  }

  @Post('api-keys/:id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Toggle API key active/inactive' })
  @ApiParam({ name: 'id', description: 'API Key UUID' })
  @ApiResponse({ status: 200, description: 'API key toggled' })
  toggleApiKey(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('API keys require a tenant context');
    }
    return this.apiKeysService.toggle(id, user.tenantId);
  }

  @Post('api-keys/:id/rotate')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Rotate an API key',
    description: 'Replace the existing key value with a new one',
  })
  @ApiParam({ name: 'id', description: 'API Key UUID' })
  @ApiResponse({ status: 200, description: 'API key rotated' })
  rotateApiKey(
    @Param('id') id: string,
    @Body() body: { apiKey: string },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException('API keys require a tenant context');
    }
    return this.apiKeysService.rotate(id, body.apiKey, user.tenantId);
  }
}
