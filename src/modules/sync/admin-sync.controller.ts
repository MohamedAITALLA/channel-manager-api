// src/modules/sync/admin-sync.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminSyncService } from './admin-sync.service';
import { ConnectionStatus } from '../../common/types';

@ApiTags('Admin Sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/sync')
export class AdminSyncController {
  constructor(private readonly adminSyncService: AdminSyncService) {}

  @Get('connections')
  @ApiOperation({ summary: 'Get all sync connections (Admin only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'property_id', required: false, description: 'Filter by property ID' })
  @ApiQuery({ name: 'platform', required: false, description: 'Filter by platform' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by connection status' })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  async getAllSyncConnections(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('property_id') propertyId?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: ConnectionStatus,
    @Query('user_id') userId?: string,
  ) {
    return this.adminSyncService.getAllSyncConnections(
      page,
      limit,
      propertyId,
      platform,
      status,
      userId,
    );
  }

  @Get('connections/:connectionId')
  @ApiOperation({ summary: 'Get a specific sync connection (Admin only)' })
  @ApiParam({ name: 'connectionId', description: 'Sync connection ID' })
  async getSyncConnectionById(@Param('connectionId') connectionId: string) {
    return this.adminSyncService.getSyncConnectionById(connectionId);
  }

  @Put('connections/:connectionId')
  @ApiOperation({ summary: 'Update a sync connection (Admin only)' })
  @ApiParam({ name: 'connectionId', description: 'Sync connection ID' })
  async updateSyncConnection(
    @Param('connectionId') connectionId: string,
    @Body() updateConnectionDto: any,
    @Req() req: any,
  ) {
    const adminId = req.user.userId;
    return this.adminSyncService.updateSyncConnection(connectionId, updateConnectionDto, adminId);
  }

  @Delete('connections/:connectionId')
  @ApiOperation({ summary: 'Delete a sync connection (Admin only)' })
  @ApiParam({ name: 'connectionId', description: 'Sync connection ID' })
  async deleteSyncConnection(
    @Param('connectionId') connectionId: string,
    @Req() req: any,
  ) {
    const adminId = req.user.userId;
    return this.adminSyncService.deleteSyncConnection(connectionId, adminId);
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Trigger a system-wide sync (Admin only)' })
  async triggerSystemWideSync(@Req() req: any) {
    const adminId = req.user.userId;
    return this.adminSyncService.triggerSystemWideSync(adminId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get sync statistics (Admin only)' })
  async getSyncStatistics() {
    return this.adminSyncService.getSyncStatistics();
  }
}