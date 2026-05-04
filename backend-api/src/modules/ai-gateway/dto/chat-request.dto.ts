import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @ApiProperty({
    enum: ['system', 'user', 'assistant'],
    example: 'user',
    description: 'Message role',
  })
  @IsString()
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty({
    example: 'What is cloud computing?',
    description: 'Message content',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatRequestDto {
  @ApiProperty({
    example: 'gpt-4o-mini',
    description: 'Target AI model',
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({
    type: [ChatMessageDto],
    description: 'Array of messages forming the conversation',
    example: [{ role: 'user', content: 'What is cloud computing?' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({
    example: 0.7,
    description: 'Sampling temperature (0-2)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    example: 1024,
    description: 'Maximum tokens in the response',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128000)
  maxTokens?: number;

  @ApiPropertyOptional({
    example: 'openai',
    description:
      'AI provider to use. If omitted, auto-detected from model name. Options: openai, anthropic, gemini, mock',
  })
  @IsOptional()
  @IsString()
  provider?: string;
}
