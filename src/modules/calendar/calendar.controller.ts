import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
}
