import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileUploadService } from './file-upload.service';
import { FileQueryDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@ApiTags('File Upload')
@ApiBearerAuth()
@Controller('files')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Get()
  @ApiOperation({ summary: 'Get my uploaded files' })
  @ApiResponse({ status: 200, description: 'Paginated list of uploaded files' })
  findAll(@CurrentUser('sub') userId: string, @Query() query: FileQueryDto) {
    return this.fileUploadService.findByUser(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file by ID' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: 200, description: 'File details' })
  @ApiResponse({ status: 404, description: 'File not found' })
  findOne(@Param('id') id: string) {
    return this.fileUploadService.findOne(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 10MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  async upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.fileUploadService.upload(file, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete uploaded file' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  remove(@Param('id') id: string) {
    return this.fileUploadService.remove(id);
  }
}
