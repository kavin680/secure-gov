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
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all webhooks (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of webhooks' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.webhooksService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Webhook details' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  findOne(@Param('id') id: string) {
    return this.webhooksService.findOne(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get webhook delivery logs (Admin)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({
    status: 200,
    description: 'Paginated webhook delivery logs',
  })
  getLogs(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.webhooksService.getLogs(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create webhook (Admin)' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook (Admin)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete webhook (Super Admin)' })
  @ApiParam({ name: 'id', description: 'Webhook UUID' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  remove(@Param('id') id: string) {
    return this.webhooksService.remove(id);
  }
}
