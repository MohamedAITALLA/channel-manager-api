import { Controller, Get, Put, Body, Query, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
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
  constructor(private readonly notificationService: NotificationService) { }
  
  @Get()
  @ApiOperation({ summary: 'List all notifications with filtering options' })
  @ApiQuery({
    type: NotificationQueryDto,
    description: 'Filtering options for notifications'
  })
  async findAll(@Req() req: any, @Query() query: NotificationQueryDto) {
    const userId = req.user.userId;
    return this.notificationService.findAll(query, userId);
  }

  @Put('read')
  @ApiOperation({ summary: 'Mark all or specific notifications as read' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [],
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of notification IDs to mark as read. If not provided, all notifications will be marked as read.'
        }
      }
    },
    required: false
  })
  async markAsRead(@Req() req: any, @Body() body?: { ids?: string[] }) {
    const userId = req.user.userId;
    // If no body is provided or ids is not provided, mark all unread notifications as read
    return this.notificationService.markAsRead(body?.ids, userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read by its ID' })
  @ApiParam({ name: 'id', description: 'Notification ID', required: true })
  async markOneAsRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.notificationService.markOneAsRead(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a notification by its ID' })
  @ApiParam({ name: 'id', description: 'Notification ID to delete', required: true })
  @ApiQuery({
    name: 'preserve_history',
    required: false,
    type: Boolean,
    description: 'Whether to preserve notification history'
  })
  async remove(@Req() req: any, @Param('id') id: string, @Query('preserve_history') preserveHistory?: boolean) {
    const userId = req.user.userId;
    return this.notificationService.remove(id, userId, preserveHistory);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Retrieve notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'User notification settings retrieved successfully'
  })
  async getSettings(@Req() req: any) {
    const userId = req.user.userId;
    return this.notificationService.getSettings(userId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBody({
    type: UpdateNotificationSettingsDto,
    description: 'Notification settings to update'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings updated successfully'
  })
  async updateSettings(@Req() req: any, @Body() updateSettingsDto: UpdateNotificationSettingsDto) {
    const userId = req.user.userId;
    return this.notificationService.updateSettings(updateSettingsDto, userId);
  }

}
