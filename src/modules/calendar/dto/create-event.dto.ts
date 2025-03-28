import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsDate, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, EventStatus, Platform } from '../../../common/types';

export class CreateEventDto {
  @ApiProperty({ enum: Platform, default: Platform.MANUAL })
  @IsEnum(Platform)
  platform: Platform = Platform.MANUAL;

  @ApiProperty()
  @IsString()
  summary: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  start_date: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  end_date: Date;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  event_type: EventType;

  @ApiProperty({ enum: EventStatus, default: EventStatus.CONFIRMED })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus = EventStatus.CONFIRMED;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
