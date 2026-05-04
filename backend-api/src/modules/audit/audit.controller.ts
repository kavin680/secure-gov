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
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of audit logs',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Success',
        data: [
          {
            id: 'clx...',
            action: 'CREATE',
            resource: 'User',
            resourceId: 'clx...',
            description: 'User created',
            userId: 'clx...',
            requestId: 'a1b2c3d4-...',
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0...',
            createdAt: '2024-01-01T00:00:00.000Z',
            user: {
              id: 'clx...',
              email: 'admin@enterprise.com',
              firstName: 'Admin',
              lastName: 'User',
            },
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        requestId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires ADMIN or SUPER_ADMIN role',
  })
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
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
