import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class EvaluatePolicyDto {
  @ApiProperty({
    example: 'What is the company password policy?',
    description: 'The prompt text to evaluate against policies',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    example: 'gpt-4o',
    description: 'Target AI model for model restriction checks',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
