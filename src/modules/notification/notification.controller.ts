import { Controller, Get, Put, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
  async findAll(@Query() query: NotificationQueryDto) {
    return this.notificationService.findAll(query);
  }

  @Put('read')
  @ApiOperation({ summary: 'Mark all or specific notifications as read' })
  async markAsRead(@Body() body?: { ids?: string[] }) {
    // If no body is provided or ids is not provided, mark all unread notifications as read
    return this.notificationService.markAsRead(body?.ids);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read by its ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async markOneAsRead(@Param('id') id: string) {
    return this.notificationService.markOneAsRead(id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Retrieve notification preferences' })
  async getSettings() {
    return this.notificationService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateSettings(@Body() updateSettingsDto: UpdateNotificationSettingsDto) {
    return this.notificationService.updateSettings(updateSettingsDto);
  }
}
