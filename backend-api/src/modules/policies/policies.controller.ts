import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { PolicyEvaluationService } from './policy-evaluation.service';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  EvaluatePolicyDto,
  PolicyQueryDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums';
import type { JwtPayload } from '../../common/interfaces';

@ApiTags('Policies')
@ApiBearerAuth()
@Controller('policies')
export class PoliciesController {
  constructor(
    private readonly policiesService: PoliciesService,
    private readonly policyEvaluationService: PolicyEvaluationService,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get all policies (tenant-scoped)' })
  @ApiResponse({ status: 200, description: 'Paginated list of policies' })
  findAll(@Query() query: PolicyQueryDto, @CurrentUser() user: JwtPayload) {
    const tenantId = user.role === Role.SUPER_ADMIN ? undefined : user.tenantId;
    return this.policiesService.findAll(query, tenantId);
  }

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get policy statistics for a tenant' })
  @ApiResponse({ status: 200, description: 'Policy statistics' })
  getStats(@CurrentUser() user: JwtPayload) {
    const tenantId = user.tenantId;
    if (!tenantId) {
      return {
        totalPolicies: 0,
        activePolicies: 0,
        inactivePolicies: 0,
        totalPolicyLogs: 0,
        recentDenials24h: 0,
      };
    }
    return this.policiesService.getTenantPolicyStats(tenantId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get policy by ID' })
  @ApiParam({ name: 'id', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  findOne(@Param('id') id: string) {
    return this.policiesService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Create a new policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  create(@Body() dto: CreatePolicyDto, @CurrentUser() user: JwtPayload) {
    return this.policiesService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Update policy' })
  @ApiParam({ name: 'id', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  update(@Param('id') id: string, @Body() dto: UpdatePolicyDto) {
    return this.policiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Delete policy' })
  @ApiParam({ name: 'id', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy deleted successfully' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  remove(@Param('id') id: string) {
    return this.policiesService.remove(id);
  }

  @Post(':id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Toggle policy active/inactive' })
  @ApiParam({ name: 'id', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Policy toggled' })
  toggle(@Param('id') id: string) {
    return this.policiesService.toggleActive(id);
  }

  @Get(':id/logs')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get evaluation logs for a policy' })
  @ApiParam({ name: 'id', description: 'Policy UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of policy logs' })
  getLogs(@Param('id') id: string, @Query() query: PolicyQueryDto) {
    return this.policiesService.getPolicyLogs(id, query);
  }

  @Post('evaluate')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({
    summary: 'Evaluate a prompt against tenant policies',
    description:
      'Tests a prompt against all active policies for the current tenant. Returns the evaluation result without sending the prompt to any AI provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Evaluation result',
  })
  evaluate(@Body() dto: EvaluatePolicyDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      return {
        allowed: true,
        decision: 'ALLOWED',
        reason: 'User has no tenant — no policies apply',
      };
    }

    return this.policyEvaluationService.evaluate({
      tenantId: user.tenantId,
      userId: user.sub,
      prompt: dto.prompt,
      model: dto.model,
    });
  }
}
