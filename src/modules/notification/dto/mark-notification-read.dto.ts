import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class MarkNotificationReadDto {
  @ApiProperty({ description: 'ID of the notification to mark as read' })
  @IsMongoId()
  id: string;
}