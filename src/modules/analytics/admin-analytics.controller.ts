// src/modules/analytics/admin-analytics.controller.ts
import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('system')
  @ApiOperation({ summary: 'Get system-wide analytics (Admin only)' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date for analytics (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date for analytics (YYYY-MM-DD)' })
  async getSystemAnalytics(
    @Query('start_date') startDateStr?: string,
    @Query('end_date') endDateStr?: string,
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return this.adminAnalyticsService.getSystemAnalytics(startDate, endDate);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get analytics for all users (Admin only)' })
  async getAllUsersAnalytics() {
    return this.adminAnalyticsService.getUserAnalytics();
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get analytics for a specific user (Admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getUserAnalytics(@Param('userId') userId: string) {
    return this.adminAnalyticsService.getUserAnalytics(userId);
  }
}