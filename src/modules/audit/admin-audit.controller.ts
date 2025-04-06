// src/modules/audit/admin-audit.controller.ts
import { Controller, Get, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminAuditService } from './admin-audit.service';

@ApiTags('Admin Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit entries (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'user_id', required: false, type: String })
  @ApiQuery({ name: 'property_id', required: false, type: String })
  @ApiQuery({ name: 'entity_type', required: false, type: String })
  @ApiQuery({ name: 'entity_id', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'start_date', required: false, type: Date })
  @ApiQuery({ name: 'end_date', required: false, type: Date })
  async getAllAuditEntries(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('user_id') userId?: string,
    @Query('property_id') propertyId?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('action') action?: string,
    @Query('start_date') startDate?: Date,
    @Query('end_date') endDate?: Date,
  ) {
    return this.adminAuditService.getAllAuditEntries(
      page,
      limit,
      userId,
      propertyId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit entry by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Audit Entry ID' })
  async getAuditEntryById(@Param('id') auditEntryId: string) {
    return this.adminAuditService.getAuditEntryById(auditEntryId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update audit entry (admin only)' })
  @ApiParam({ name: 'id', description: 'Audit Entry ID' })
  async updateAuditEntry(
    @Req() req: any,
    @Param('id') auditEntryId: string,
    @Body() updateAuditEntryDto: any,
  ) {
    const adminId = req.user.userId;
    return this.adminAuditService.updateAuditEntry(auditEntryId, updateAuditEntryDto, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete audit entry (admin only)' })
  @ApiParam({ name: 'id', description: 'Audit Entry ID' })
  async deleteAuditEntry(
    @Req() req: any,
    @Param('id') auditEntryId: string
  ) {
    const adminId = req.user.userId;
    return this.adminAuditService.deleteAuditEntry(auditEntryId, adminId);
  }
}