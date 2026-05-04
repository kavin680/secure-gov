import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';
import { PolicyType, PolicyAction } from '../../../common/enums';

export class UpdatePolicyDto {
  @ApiPropertyOptional({ example: 'Updated Policy Name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: PolicyType })
  @IsOptional()
  @IsEnum(PolicyType)
  type?: PolicyType;

  @ApiPropertyOptional({ description: 'Updated rule configuration' })
  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: PolicyAction })
  @IsOptional()
  @IsEnum(PolicyAction)
  action?: PolicyAction;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
