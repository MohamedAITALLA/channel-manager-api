// src/modules/analytics/analytics.controller.ts
import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview analytics' })
  async getDashboardAnalytics(@Req() req: any) {
    const userId = req.user.userId;
    return this.analyticsService.getDashboardAnalytics(userId);
  }

  @Get('properties')
  @ApiOperation({ summary: 'Get property analytics' })
  @ApiQuery({ name: 'property_id', required: false, description: 'Filter by specific property' })
  async getPropertyAnalytics(
    @Req() req: any,
    @Query('property_id') propertyId?: string,
  ) {
    const userId = req.user.userId;
    return this.analyticsService.getPropertyAnalytics(userId, propertyId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get booking analytics' })
  @ApiQuery({ name: 'property_id', required: false, description: 'Filter by specific property' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date for analytics (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date for analytics (YYYY-MM-DD)' })
  async getBookingAnalytics(
    @Req() req: any,
    @Query('property_id') propertyId?: string,
    @Query('start_date') startDateStr?: string,
    @Query('end_date') endDateStr?: string,
  ) {
    const userId = req.user.userId;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return this.analyticsService.getBookingAnalytics(userId, propertyId, startDate, endDate);
  }

  @Get('platforms')
  @ApiOperation({ summary: 'Get platform performance analytics' })
  @ApiQuery({ name: 'property_id', required: false, description: 'Filter by specific property' })
  async getPlatformAnalytics(
    @Req() req: any,
    @Query('property_id') propertyId?: string,
  ) {
    const userId = req.user.userId;
    return this.analyticsService.getPlatformAnalytics(userId, propertyId);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get calendar and occupancy analytics' })
  @ApiQuery({ name: 'property_id', required: false, description: 'Filter by specific property' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date for analytics (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date for analytics (YYYY-MM-DD)' })
  async getCalendarAnalytics(
    @Req() req: any,
    @Query('property_id') propertyId?: string,
    @Query('start_date') startDateStr?: string,
    @Query('end_date') endDateStr?: string,
  ) {
    const userId = req.user.userId;
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return this.analyticsService.getCalendarAnalytics(userId, propertyId, startDate, endDate);
  }

  @Get('user-activity')
  @ApiOperation({ summary: 'Get user activity analytics' })
  async getUserActivityAnalytics(@Req() req: any) {
    const userId = req.user.userId;
    return this.analyticsService.getUserActivityAnalytics(userId);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare performance between multiple properties' })
  @ApiQuery({ 
    name: 'property_ids', 
    required: true, 
    description: 'Comma-separated list of property IDs to compare',
    example: 'property1Id,property2Id,property3Id'
  })
  async getPerformanceComparison(
    @Req() req: any,
    @Query('property_ids') propertyIdsStr: string,
  ) {
    const userId = req.user.userId;
    const propertyIds = propertyIdsStr.split(',').filter(Boolean);
    
    return this.analyticsService.getPerformanceComparisonAnalytics(userId, propertyIds);
  }

  @Get('properties/:propertyId/revenue')
  @ApiOperation({ summary: 'Get revenue analytics for a specific property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date for analytics (YYYY-MM-DD)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date for analytics (YYYY-MM-DD)' })
  async getRevenueAnalytics(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
    @Query('start_date') startDateStr?: string,
    @Query('end_date') endDateStr?: string,
  ) {
    // This would require a revenue model in your database
    // For now, return a placeholder response
    return {
      success: true,
      data: {
        property_id: propertyId,
        message: "Revenue analytics feature coming soon",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get booking trends and seasonality analysis' })
  @ApiQuery({ name: 'property_id', required: false, description: 'Filter by specific property' })
  async getTrendsAnalytics(
    @Req() req: any,
    @Query('property_id') propertyId?: string,
  ) {
    // This would analyze historical booking data to identify trends
    // For now, return a placeholder response
    return {
      success: true,
      data: {
        property_id: propertyId || 'all',
        message: "Booking trends analytics feature coming soon",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
