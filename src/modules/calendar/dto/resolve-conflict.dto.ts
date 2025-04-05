// src/modules/calendar/dto/resolve-conflict.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsArray } from 'class-validator';

export enum ConflictResolutionStrategy {
  DELETE = 'delete',
  DEACTIVATE = 'deactivate'
}

export class ResolveConflictDto {
  @ApiProperty({ enum: ConflictResolutionStrategy })
  @IsEnum(ConflictResolutionStrategy)
  strategy: ConflictResolutionStrategy;

  @ApiProperty({ description: 'IDs of events to keep (others will be removed/deactivated)' })
  @IsArray()
  @IsMongoId({ each: true })
  eventsToKeep: string[];
}
