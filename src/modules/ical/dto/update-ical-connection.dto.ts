import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { CreateICalConnectionDto } from './create-ical-connection.dto';
import { ConnectionStatus } from '../../../common/types';

export class UpdateICalConnectionDto extends PartialType(CreateICalConnectionDto) {
  @ApiProperty({ enum: ConnectionStatus, required: false })
  @IsOptional()
  @IsEnum(ConnectionStatus)
  status?: ConnectionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  error_message?: string | null;
}
