import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { InputJsonValue } from '@prisma/client/runtime/library';

export class CreateFeatureFlagDto {
  @ApiProperty({
    example: 'enable-dark-mode',
    description: 'Unique key (kebab-case)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Key must be kebab-case (lowercase letters, numbers, hyphens)',
  })
  key: string;

  @ApiProperty({ example: 'Dark Mode', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Enable dark mode for all users' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: { rolloutPercentage: 50 } })
  @IsOptional()
  metadata?: InputJsonValue;
}
