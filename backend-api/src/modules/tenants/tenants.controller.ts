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
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all tenants (Super Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tenants',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires SUPER_ADMIN role',
  })
  findAll(@Query() query: PaginationQueryDto) {
    return this.tenantsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get('slug/:slug')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get tenant by slug' })
  @ApiParam({ name: 'slug', description: 'Tenant slug' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.tenantsService.findBySlug(slug);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new tenant (Super Admin)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires SUPER_ADMIN role',
  })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update tenant (Super Admin)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft delete tenant (Super Admin)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tenant deleted successfully (soft delete)',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires SUPER_ADMIN role',
  })
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  @Post(':id/restore')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Restore deleted tenant (Super Admin)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant restored successfully' })
  @ApiResponse({ status: 404, description: 'Deleted tenant not found' })
  restore(@Param('id') id: string) {
    return this.tenantsService.restore(id);
  }

  @Get(':id/stats')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get tenant statistics' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant statistics' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getStats(@Param('id') id: string) {
    return this.tenantsService.getStats(id);
  }

  @Get(':id/users')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Get users in a tenant' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of tenant users' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  getTenantUsers(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.tenantsService.getTenantUsers(id, query);
  }

  @Post(':id/users/:userId')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add user to tenant (Super Admin)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User added to tenant' })
  @ApiResponse({ status: 404, description: 'Tenant or user not found' })
  @ApiResponse({
    status: 400,
    description: 'Tenant has reached maximum user limit',
  })
  addUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.tenantsService.addUserToTenant(id, userId);
  }

  @Delete(':id/users/:userId')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN)
  @ApiOperation({ summary: 'Remove user from tenant' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User removed from tenant' })
  @ApiResponse({ status: 404, description: 'User not found in tenant' })
  removeUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.tenantsService.removeUserFromTenant(id, userId);
  }
}
