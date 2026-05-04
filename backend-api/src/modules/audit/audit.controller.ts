import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums';
import type { JwtPayload } from '../../common/interfaces';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TENANT_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs (Admin/Tenant Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of audit logs',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - requires ADMIN, SUPER_ADMIN, or TENANT_ADMIN role',
  })
  findAll(@Query() query: AuditQueryDto, @CurrentUser() user: JwtPayload) {
    const tenantId = user.role === Role.SUPER_ADMIN ? undefined : user.tenantId;
    return this.auditService.findAll(query, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Audit log UUID' })
  @ApiResponse({ status: 200, description: 'Audit log details' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
