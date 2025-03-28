import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUrl, IsOptional, IsInt, Min } from 'class-validator';
import { Platform } from '../../../common/types';

export class CreateICalConnectionDto {
  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty()
  @IsUrl()
  ical_url: string;

  @ApiProperty({ required: false, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  sync_frequency?: number;
}
