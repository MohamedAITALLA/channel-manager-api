import { Controller, Get, Put, Body, Query, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List all notifications with filtering options' })
  async findAll(@Req() req: any, @Query() query: NotificationQueryDto) {
    const userId = req.user.userId;
    return this.notificationService.findAll(query, userId);
  }

  @Put('read')
  @ApiOperation({ summary: 'Mark all or specific notifications as read' })
  async markAsRead(@Req() req: any, @Body() body?: { ids?: string[] }) {
    const userId = req.user.userId;
    // If no body is provided or ids is not provided, mark all unread notifications as read
    return this.notificationService.markAsRead(body?.ids, userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read by its ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async markOneAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.notificationService.markOneAsRead(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a notification by its ID' })
  @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
  async remove(@Req() req: any, @Param('id') id: string, @Query('preserve_history') preserveHistory?: boolean) {
    const userId = req.user.userId;
    return this.notificationService.remove(id, userId, preserveHistory);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Retrieve notification preferences' })
  async getSettings(@Req() req: any) {
    const userId = req.user.userId;
    return this.notificationService.getSettings(userId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateSettings(@Req() req: any, @Body() updateSettingsDto: UpdateNotificationSettingsDto) {
    const userId = req.user.userId;
    return this.notificationService.updateSettings(updateSettingsDto, userId);
  }
}
