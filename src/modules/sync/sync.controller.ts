import { Controller, Post, Get, Param, UseGuards, Req } from '@nestjs/common';
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
  async syncAll(@Req() req: any): Promise<{ success: boolean; message: string; results: SyncResult[] }> {
    const userId = req.user.userId;
    return this.syncService.syncAllProperties(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get overall synchronization health status' })
  async getSyncStatus(@Req() req: any) {
    const userId = req.user.userId;
    return this.syncService.getSyncHealthStatus(userId);
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
  async syncProperty(@Req() req: any, @Param('propertyId') propertyId: string): Promise<{ success: boolean; message: string; results: PropertySyncResult[] }> {
    const userId = req.user.userId;
    return this.syncService.syncProperty(propertyId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Check synchronization status and last sync time' })
  async getPropertySyncStatus(@Req() req: any, @Param('propertyId') propertyId: string) {
    const userId = req.user.userId;
    return this.syncService.getPropertySyncStatus(propertyId, userId);
  }
}
