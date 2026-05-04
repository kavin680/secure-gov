import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import type { JwtPayload } from '../../common/interfaces';
import { Role } from '../../common/enums';
import { RagService } from './rag.service';
import { UploadDocumentDto, SearchQueryDto, RagChatDto } from './dto';

@ApiTags('RAG - Document Intelligence')
@ApiBearerAuth()
@Controller('api/v1/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  // ─── Document Management ────────────────────────────────────────────────────

  @Post('documents')
  @Roles(Role.TENANT_ADMIN, Role.DEVELOPER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document for RAG processing' })
  @ApiBody({
    description: 'Document file with metadata',
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded and processing started',
  })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException(
        'RAG requires a tenant context. Platform admins should use a tenant-scoped account.',
      );
    }

    if (!file) {
      throw new ForbiddenException('File is required');
    }

    return this.ragService.uploadDocument(
      {
        title: dto.title,
        description: dto.description,
        file: {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
      },
      user.sub,
      user.tenantId,
    );
  }

  @Get('documents')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({ summary: 'List all documents for tenant' })
  async listDocuments(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.getDocuments(user.tenantId);
  }

  @Get('documents/stats')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER)
  @ApiOperation({ summary: 'Get document statistics for tenant' })
  async getDocumentStats(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.getDocumentStats(user.tenantId);
  }

  @Get('documents/:id')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({ summary: 'Get document details with chunks' })
  async getDocument(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.getDocument(id, user.tenantId);
  }

  @Delete('documents/:id')
  @Roles(Role.TENANT_ADMIN, Role.DEVELOPER)
  @ApiOperation({ summary: 'Delete a document and its chunks' })
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.deleteDocument(id, user.tenantId);
  }

  @Post('documents/:id/reprocess')
  @Roles(Role.TENANT_ADMIN, Role.DEVELOPER)
  @ApiOperation({ summary: 'Reprocess a document (re-chunk and re-embed)' })
  async reprocessDocument(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.reprocessDocument(id, user.tenantId);
  }

  // ─── Search & Chat ──────────────────────────────────────────────────────────

  @Post('search')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({
    summary: 'Search documents using semantic similarity',
  })
  async search(@Body() dto: SearchQueryDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.searchDocuments(
      dto.query,
      user.tenantId,
      dto.topK,
      dto.documentId,
    );
  }

  @Post('chat')
  @Roles(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.DEVELOPER, Role.USER)
  @ApiOperation({
    summary:
      'Chat with AI using document context (RAG). Retrieves relevant chunks and generates a response.',
  })
  @ApiResponse({ status: 201, description: 'AI response with sources' })
  @ApiResponse({
    status: 403,
    description: 'Request blocked by policy or no tenant context',
  })
  async ragChat(@Body() dto: RagChatDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('RAG requires a tenant context.');
    }
    return this.ragService.ragChat(dto, user.sub, user.tenantId);
  }
}
