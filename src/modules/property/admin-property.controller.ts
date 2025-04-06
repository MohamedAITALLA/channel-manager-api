// src/modules/property/admin-property.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminPropertyService } from './admin-property.service';

@ApiTags('Admin Properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/properties')
export class AdminPropertyController {
  constructor(private readonly adminPropertyService: AdminPropertyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all properties (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'user_id', required: false, type: String })
  @ApiQuery({ name: 'property_type', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllProperties(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('user_id') userId?: string,
    @Query('property_type') propertyType?: string,
    @Query('search') search?: string,
  ) {
    return this.adminPropertyService.getAllProperties(
      page,
      limit,
      userId,
      propertyType,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  async getPropertyById(@Param('id') propertyId: string) {
    return this.adminPropertyService.getPropertyById(propertyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update property (admin only)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  async updateProperty(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Body() updatePropertyDto: any,
  ) {
    const adminId = req.user.userId;
    return this.adminPropertyService.updateProperty(propertyId, updatePropertyDto, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete property (admin only)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  async deleteProperty(
    @Req() req: any,
    @Param('id') propertyId: string
  ) {
    const adminId = req.user.userId;
    return this.adminPropertyService.deleteProperty(propertyId, adminId);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate property (admin only)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  async activateProperty(
    @Req() req: any,
    @Param('id') propertyId: string
  ) {
    const adminId = req.user.userId;
    return this.adminPropertyService.setPropertyActiveStatus(propertyId, true, adminId);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate property (admin only)' })
  @ApiParam({ name: 'id', description: 'Property ID' })
  async deactivateProperty(
    @Req() req: any,
    @Param('id') propertyId: string
  ) {
    const adminId = req.user.userId;
    return this.adminPropertyService.setPropertyActiveStatus(propertyId, false, adminId);
  }
}