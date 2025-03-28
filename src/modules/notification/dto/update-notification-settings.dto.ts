import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  new_booking_notifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  modified_booking_notifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  cancelled_booking_notifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  conflict_notifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  sync_failure_notifications?: boolean;
}
