// Create a new file: src/modules/calendar/dto/update-event.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType, EventStatus, Platform } from '../../../common/types';

export class UpdateEventDto {
  @ApiProperty({ enum: Platform, required: false })
  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start_date?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end_date?: Date;

  @ApiProperty({ enum: EventType, required: false })
  @IsOptional()
  @IsEnum(EventType)
  event_type?: EventType;

  @ApiProperty({ enum: EventStatus, required: false })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
