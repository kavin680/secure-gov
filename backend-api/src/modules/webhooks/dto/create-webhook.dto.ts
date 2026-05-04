import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({ example: 'Order Events', description: 'Webhook name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    example: 'https://example.com/webhook',
    description: 'Endpoint URL',
  })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    example: ['user.created', 'user.updated'],
    description: 'Events to subscribe to',
  })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({
    example: 'whsec_...',
    description: 'Webhook signing secret (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  secret?: string;
}
