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
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto, UpdateFeatureFlagDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all feature flags (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of feature flags' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.featureFlagsService.findAll(query);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if a feature flag is enabled' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag status',
    schema: {
      example: {
        success: true,
        data: { key: 'enable-dark-mode', enabled: true },
      },
    },
  })
  async check(@Query('key') key: string) {
    const enabled = await this.featureFlagsService.isEnabled(key);
    return { key, enabled };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get feature flag by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Feature flag UUID' })
  @ApiResponse({ status: 200, description: 'Feature flag details' })
  @ApiResponse({ status: 404, description: 'Feature flag not found' })
  findOne(@Param('id') id: string) {
    return this.featureFlagsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create feature flag (Super Admin)' })
  @ApiResponse({ status: 201, description: 'Feature flag created' })
  create(@Body() dto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update feature flag (Admin)' })
  @ApiParam({ name: 'id', description: 'Feature flag UUID' })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  update(@Param('id') id: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.featureFlagsService.update(id, dto);
  }

  @Post(':id/toggle')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle feature flag on/off (Admin)' })
  @ApiParam({ name: 'id', description: 'Feature flag UUID' })
  @ApiResponse({ status: 200, description: 'Feature flag toggled' })
  toggle(@Param('id') id: string) {
    return this.featureFlagsService.toggle(id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete feature flag (Super Admin)' })
  @ApiParam({ name: 'id', description: 'Feature flag UUID' })
  @ApiResponse({ status: 200, description: 'Feature flag deleted' })
  remove(@Param('id') id: string) {
    return this.featureFlagsService.remove(id);
  }
}
