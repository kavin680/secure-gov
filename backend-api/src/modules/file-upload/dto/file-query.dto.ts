import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos';

export class FileQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'image/png',
    description: 'Filter by MIME type',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
