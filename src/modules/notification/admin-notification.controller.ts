// src/modules/notification/admin-notification.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminNotificationService } from './admin-notification.service';

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(private readonly adminNotificationService: AdminNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'user_id', required: false, type: String })
  @ApiQuery({ name: 'property_id', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'read', required: false, type: Boolean })
  async getAllNotifications(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('user_id') userId?: string,
    @Query('property_id') propertyId?: string,
    @Query('type') type?: string,
    @Query('read') read?: boolean,
  ) {
    return this.adminNotificationService.getAllNotifications(
      page,
      limit,
      userId,
      propertyId,
      type,
      read,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async getNotificationById(@Param('id') notificationId: string) {
    return this.adminNotificationService.getNotificationById(notificationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update notification (admin only)' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async updateNotification(
    @Req() req: any,
    @Param('id') notificationId: string,
    @Body() updateNotificationDto: any,
  ) {
    const adminId = req.user.userId;
    return this.adminNotificationService.updateNotification(notificationId, updateNotificationDto, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification (admin only)' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async deleteNotification(
    @Req() req: any,
    @Param('id') notificationId: string
  ) {
    const adminId = req.user.userId;
    return this.adminNotificationService.deleteNotification(notificationId, adminId);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate notification (admin only)' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async activateNotification(
    @Req() req: any,
    @Param('id') notificationId: string
  ) {
    const adminId = req.user.userId;
    return this.adminNotificationService.setNotificationActiveStatus(notificationId, true, adminId);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate notification (admin only)' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async deactivateNotification(
    @Req() req: any,
    @Param('id') notificationId: string
  ) {
    const adminId = req.user.userId;
    return this.adminNotificationService.setNotificationActiveStatus(notificationId, false, adminId);
  }
}