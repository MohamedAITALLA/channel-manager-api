// src/modules/calendar/admin-calendar-event.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminCalendarService } from './admin-calendar.service';

@ApiTags('Admin Calendar Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/calendar-events')
export class AdminCalendarEventController {
  constructor(private readonly adminCalendarService: AdminCalendarService) {}

  @Get()
  @ApiOperation({ summary: 'Get all calendar events (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'property_id', required: false, type: String })
  @ApiQuery({ name: 'start_date', required: false, type: Date })
  @ApiQuery({ name: 'end_date', required: false, type: Date })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'event_type', required: false, type: String })
  async getAllEvents(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('property_id') propertyId?: string,
    @Query('start_date') startDate?: Date,
    @Query('end_date') endDate?: Date,
    @Query('platform') platform?: string,
    @Query('event_type') eventType?: string,
  ) {
    return this.adminCalendarService.getAllEvents(
      page,
      limit,
      propertyId,
      startDate,
      endDate,
      platform,
      eventType,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get calendar event by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Calendar Event ID' })
  async getEventById(@Param('id') eventId: string) {
    return this.adminCalendarService.getEventById(eventId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update calendar event (admin only)' })
  @ApiParam({ name: 'id', description: 'Calendar Event ID' })
  async updateEvent(
    @Req() req: any,
    @Param('id') eventId: string,
    @Body() updateEventDto: any,
  ) {
    const adminId = req.user.userId;
    return this.adminCalendarService.updateEvent(eventId, updateEventDto, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete calendar event (admin only)' })
  @ApiParam({ name: 'id', description: 'Calendar Event ID' })
  async deleteEvent(
    @Req() req: any,
    @Param('id') eventId: string
  ) {
    const adminId = req.user.userId;
    return this.adminCalendarService.deleteEvent(eventId, adminId);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Activate calendar event (admin only)' })
  @ApiParam({ name: 'id', description: 'Calendar Event ID' })
  async activateEvent(
    @Req() req: any,
    @Param('id') eventId: string
  ) {
    const adminId = req.user.userId;
    return this.adminCalendarService.setEventActiveStatus(eventId, true, adminId);
  }

  @Put(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate calendar event (admin only)' })
  @ApiParam({ name: 'id', description: 'Calendar Event ID' })
  async deactivateEvent(
    @Req() req: any,
    @Param('id') eventId: string
  ) {
    const adminId = req.user.userId;
    return this.adminCalendarService.setEventActiveStatus(eventId, false, adminId);
  }
}