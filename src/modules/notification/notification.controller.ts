import { Controller, Get, Put, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
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
  @ApiOperation({ summary: 'Mark notifications as read' })
  async markAsRead(@Body() body: { ids: string[] }) {
    return this.notificationService.markAsRead(body.ids);
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
