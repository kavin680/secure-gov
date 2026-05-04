import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos';
import { PolicyType, PolicyAction } from '../../../common/enums';

export class PolicyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PolicyType })
  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @ApiPropertyOptional({ enum: PolicyAction })
  @IsOptional()
  @IsEnum(PolicyAction)
  action?: PolicyAction;

  @ApiPropertyOptional({ description: 'Filter by tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
