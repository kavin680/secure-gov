import {
  Controller,
  Get,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/interfaces';
import { Role } from '../../common/enums';
import { MonitoringService } from './monitoring.service';

@ApiTags('Monitoring & Analytics')
@ApiBearerAuth()
@Controller('api/v1/monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary:
      'Get dashboard overview (Super Admin sees all tenants, Tenant Admin sees own)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data with overview and recent activity',
  })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.monitoringService.getDashboard(user.tenantId || undefined);
  }

  @Get('usage')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get AI usage report (requests, tokens, providers)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to include (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage report with token stats and breakdowns',
  })
  async getUsageReport(
    @CurrentUser() user: JwtPayload,
    @Query('days') days?: string,
  ) {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.monitoringService.getUsageReport(
      user.tenantId || undefined,
      numDays,
    );
  }

  @Get('compliance')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get compliance report (policy violations, denied requests)',
  })
  @ApiResponse({
    status: 200,
    description: 'Compliance report with policy enforcement stats',
  })
  async getComplianceReport(@CurrentUser() user: JwtPayload) {
    return this.monitoringService.getComplianceReport(
      user.tenantId || undefined,
    );
  }

  @Get('security')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({
    summary: 'Get security report (failed logins, locked accounts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Security report with alerts and events',
  })
  async getSecurityReport(@CurrentUser() user: JwtPayload) {
    return this.monitoringService.getSecurityReport(user.tenantId || undefined);
  }

  @Get('tenants/:id/report')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get detailed report for a specific tenant (Super Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Per-tenant detailed report' })
  async getTenantReport(
    @Param('id') tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.tenantId) {
      throw new ForbiddenException(
        'Only platform administrators can access per-tenant reports.',
      );
    }
    return this.monitoringService.getTenantReport(tenantId);
  }
}
