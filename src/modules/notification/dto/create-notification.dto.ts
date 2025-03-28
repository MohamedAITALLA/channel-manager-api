import { IsEnum, IsString, IsMongoId, IsOptional } from 'class-validator';
import { NotificationType, NotificationSeverity } from '../../../common/types';

export class CreateNotificationDto {
  @IsOptional()
  @IsMongoId()
  property_id?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationSeverity)
  severity: NotificationSeverity;
}
