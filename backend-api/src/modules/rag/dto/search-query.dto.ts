import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search query text' })
  @IsString()
  @MaxLength(2000)
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;

  @ApiPropertyOptional({ description: 'Filter by specific document ID' })
  @IsOptional()
  @IsString()
  documentId?: string;
}

export class RagChatDto {
  @ApiProperty({ description: 'User message / question' })
  @IsString()
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({
    description: 'AI model to use',
    default: 'gpt-4o-mini',
  })
  @IsOptional()
  @IsString()
  model?: string = 'gpt-4o-mini';

  @ApiPropertyOptional({
    description: 'AI provider to use',
    default: 'mock',
  })
  @IsOptional()
  @IsString()
  provider?: string = 'mock';

  @ApiPropertyOptional({
    description: 'Maximum number of context chunks to retrieve',
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;

  @ApiPropertyOptional({ description: 'Filter context to specific document' })
  @IsOptional()
  @IsString()
  documentId?: string;
}
