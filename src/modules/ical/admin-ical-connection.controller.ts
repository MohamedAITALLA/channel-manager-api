// src/modules/ical/admin-ical-connection.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminICalConnectionService } from './admin-ical-connection.service';

@ApiTags('Admin iCal Connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/ical-connections')
export class AdminICalConnectionController {
  constructor(private readonly adminICalConnectionService: AdminICalConnectionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all iCal connections (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'property_id', required: false, type: String })
  @ApiQuery({ name: 'user_id', required: false, type: String })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getAllConnections(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('property_id') propertyId?: string,
    @Query('user_id') userId?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    return this.adminICalConnectionService.getAllConnections(
      page,
      limit,
      propertyId,
      userId,
      platform,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get iCal connection by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'iCal Connection ID' })
  async getConnectionById(@Param('id') connectionId: string) {
    return this.adminICalConnectionService.getConnectionById(connectionId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update iCal connection (admin only)' })
  @ApiParam({ name: 'id', description: 'iCal Connection ID' })
  async updateConnection(
    @Req() req: any,
    @Param('id') connectionId: string,
    @Body() updateConnectionDto: any,
  ) {
    const adminId = req.user.userId;
    return this.adminICalConnectionService.updateConnection(connectionId, updateConnectionDto, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete iCal connection (admin only)' })
  @ApiParam({ name: 'id', description: 'iCal Connection ID' })
  async deleteConnection(
    @Req() req: any,
    @Param('id') connectionId: string
  ) {
    const adminId = req.user.userId;
    return this.adminICalConnectionService.deleteConnection(connectionId, adminId);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate iCal connection (admin only)' })
  @ApiParam({ name: 'id', description: 'iCal Connection ID' })
  async activateConnection(
    @Req() req: any,
    @Param('id') connectionId: string
  ) {
    const adminId = req.user.userId;
    return this.adminICalConnectionService.setConnectionActiveStatus(connectionId, true, adminId);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate iCal connection (admin only)' })
  @ApiParam({ name: 'id', description: 'iCal Connection ID' })
  async deactivateConnection(
    @Req() req: any,
    @Param('id') connectionId: string
  ) {
    const adminId = req.user.userId;
    return this.adminICalConnectionService.setConnectionActiveStatus(connectionId, false, adminId);
  }
}