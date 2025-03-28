import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsArray, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EventType, Platform } from '../../../common/types';

export class CalendarQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(Platform, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  platforms?: Platform[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(EventType, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  event_types?: EventType[];
}
