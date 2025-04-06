// src/modules/calendar/admin-conflict.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminConflictService } from './admin-conflict.service';

@ApiTags('Admin Conflicts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/conflicts')
export class AdminConflictController {
  constructor(private readonly adminConflictService: AdminConflictService) {}

  @Get()
  @ApiOperation({ summary: 'Get all conflicts (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'property_id', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'conflict_type', required: false, type: String })
  @ApiQuery({ name: 'severity', required: false, type: String })
  async getAllConflicts(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('property_id') propertyId?: string,
    @Query('status') status?: string,
    @Query('conflict_type') conflictType?: string,
    @Query('severity') severity?: string,
  ) {
    return this.adminConflictService.getAllConflicts(
      page,
      limit,
      propertyId,
      status,
      conflictType,
      severity,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conflict by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Conflict ID' })
  async getConflictById(@Param('id') conflictId: string) {
    return this.adminConflictService.getConflictById(conflictId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update conflict (admin only)' })
  @ApiParam({ name: 'id', description: 'Conflict ID' })
  async updateConflict(
    @Req() req: any,
    @Param('id') conflictId: string,
    @Body() updateConflictDto: any,
  ) {
    const adminId = req.user.userId;
    return this.adminConflictService.updateConflict(conflictId, updateConflictDto, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete conflict (admin only)' })
  @ApiParam({ name: 'id', description: 'Conflict ID' })
  async deleteConflict(
    @Req() req: any,
    @Param('id') conflictId: string
  ) {
    const adminId = req.user.userId;
    return this.adminConflictService.deleteConflict(conflictId, adminId);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate conflict (admin only)' })
  @ApiParam({ name: 'id', description: 'Conflict ID' })
  async activateConflict(
    @Req() req: any,
    @Param('id') conflictId: string
  ) {
    const adminId = req.user.userId;
    return this.adminConflictService.setConflictActiveStatus(conflictId, true, adminId);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate conflict (admin only)' })
  @ApiParam({ name: 'id', description: 'Conflict ID' })
  async deactivateConflict(
    @Req() req: any,
    @Param('id') conflictId: string
  ) {
    const adminId = req.user.userId;
    return this.adminConflictService.setConflictActiveStatus(conflictId, false, adminId);
  }
}