import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'OpenAI Production Key',
    description: 'Display name for the API key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: ['openai', 'anthropic', 'gemini'],
    example: 'openai',
    description: 'AI provider this key belongs to',
  })
  @IsString()
  @IsIn(['openai', 'anthropic', 'gemini'])
  provider: string;

  @ApiProperty({
    example: 'sk-proj-abc123...',
    description: 'The actual API key value (will be stored as a hash)',
  })
  @IsString()
  @IsNotEmpty()
  apiKey: string;
}
