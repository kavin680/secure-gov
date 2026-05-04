import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { InputJsonValue } from '@prisma/client/runtime/library';

export class CreateNotificationDto {
  @ApiProperty({ example: 'user-uuid', description: 'Target user ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'SYSTEM', description: 'Notification type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiProperty({ example: 'Welcome!', description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Welcome to the platform.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ example: { link: '/dashboard' } })
  @IsOptional()
  data?: InputJsonValue;
}
