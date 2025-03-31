import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve unified calendar for a property' })
  async getCalendar(
    @Param('propertyId') propertyId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.calendarService.getCalendar(propertyId, query);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check availability for specific dates' })
  async checkAvailability(
    @Param('propertyId') propertyId: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return this.calendarService.checkAvailability(propertyId, startDate, endDate);
  }
}

@ApiTags('Calendar Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/events')
export class EventsController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'List all booking events across platforms with filtering options' })
  async getEvents(
    @Param('propertyId') propertyId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.calendarService.getEvents(propertyId, query);
  }
  @Post()
  @ApiOperation({ summary: 'Create a manual event (e.g., maintenance, blocking)' })
  async createEvent(
    @Param('propertyId') propertyId: string,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.calendarService.createManualEvent(propertyId, createEventDto);
  }

  @Delete(':eventId')
  @ApiOperation({ summary: 'Remove a calender event' })
  @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
  async remove(
    @Param('propertyId') propertyId: string,
    @Param('eventId') eventId: string,
    @Query('preserve_history') preserveHistory?: boolean
  ) {
    return this.calendarService.removeCalenderEevent(eventId,propertyId,preserveHistory);
  }
}

@ApiTags('Conflicts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/conflicts')
export class ConflictsController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'List all detected booking conflicts' })
  async getConflicts(
    @Param('propertyId') propertyId: string,
    @Query('status') status?: string,
  ) {
    return this.calendarService.getConflicts(propertyId, status);
  }

  @Delete(':conflictId')
  @ApiOperation({ summary: 'Remove a conflict' })
  @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
  async remove(
    @Param('propertyId') propertyId: string,
    @Param('conflictId') conflictId: string,
    @Query('preserve_history') preserveHistory?: boolean
  ) {
    return this.calendarService.removeConflict(conflictId,propertyId,preserveHistory);
  }
}
