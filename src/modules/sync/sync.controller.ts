import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncResult, PropertySyncResult } from './types';

@ApiTags('Synchronization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @ApiOperation({ summary: 'Trigger manual synchronization of all properties' })
  @ApiResponse({ status: 200, description: 'Synchronization successful' })
  async syncAll(): Promise<{ success: boolean; message: string; results: SyncResult[] }> {
    return this.syncService.syncAllProperties();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get overall synchronization health status' })
  async getSyncStatus() {
    return this.syncService.getSyncHealthStatus();
  }
}

@ApiTags('Property Synchronization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/sync')
export class PropertySyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @ApiOperation({ summary: 'Trigger synchronization for a specific property' })
  async syncProperty(@Param('propertyId') propertyId: string): Promise<{ success: boolean; message: string; results: PropertySyncResult[] }> {
    return this.syncService.syncProperty(propertyId);
  }

  @Get()
  @ApiOperation({ summary: 'Check synchronization status and last sync time' })
  async getPropertySyncStatus(@Param('propertyId') propertyId: string) {
    return this.syncService.getPropertySyncStatus(propertyId);
  }
}
