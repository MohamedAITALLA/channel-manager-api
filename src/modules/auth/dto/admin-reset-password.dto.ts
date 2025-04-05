// src/modules/auth/dto/admin-reset-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AdminResetPasswordDto {
  @ApiProperty({ description: 'New password for the user' })
  @IsString()
  @MinLength(6)
  password: string;
}
