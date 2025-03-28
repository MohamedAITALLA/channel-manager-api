import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationType, NotificationSeverity } from '../../../common/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class NotificationQueryDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  property_id?: string;

  @ApiProperty({ required: false, enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({ required: false, enum: NotificationSeverity })
  @IsOptional()
  @IsEnum(NotificationSeverity)
  severity?: NotificationSeverity;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  read?: boolean;
}
