import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsUUID,
  MaxLength,
  Min,
  IsObject,
} from 'class-validator';
import { PolicyType, PolicyAction } from '../../../common/enums';

export class CreatePolicyDto {
  @ApiProperty({ example: 'Block Sensitive Keywords' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    example: 'Blocks prompts containing sensitive keywords like SSN, password',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 'acme-tenant-uuid',
    description: 'Tenant UUID this policy belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ enum: PolicyType, example: PolicyType.KEYWORD_BLOCK })
  @IsEnum(PolicyType)
  type: PolicyType;

  @ApiProperty({
    description: 'Rule configuration as JSON',
    example: {
      keywords: ['password', 'ssn', 'credit card'],
      caseSensitive: false,
    },
  })
  @IsObject()
  @IsNotEmpty()
  rules: Record<string, unknown>;

  @ApiPropertyOptional({ enum: PolicyAction, default: PolicyAction.DENY })
  @IsOptional()
  @IsEnum(PolicyAction)
  action?: PolicyAction;

  @ApiPropertyOptional({
    example: 0,
    description: 'Higher priority policies are evaluated first',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
