import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'CREATE',
    description: 'Filter by action (CREATE, UPDATE, DELETE, LOGIN, etc.)',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    example: 'User',
    description: 'Filter by resource type (User, Session, etc.)',
  })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
