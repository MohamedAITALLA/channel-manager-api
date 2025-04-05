import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateEventDto } from './dto/update-event.dto';
import { ConflictResolutionStrategy, ResolveConflictDto } from './dto/resolve-conflict.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) { }

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
  constructor(private readonly calendarService: CalendarService) { }

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
    return this.calendarService.removeCalenderEevent(eventId, propertyId, preserveHistory);
  }

  @Put(':eventId')
  @ApiOperation({ summary: 'Update an existing event' })
  async updateEvent(
    @Param('propertyId') propertyId: string,
    @Param('eventId') eventId: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.calendarService.updateEvent(eventId, propertyId, updateEventDto);
  }

}

@ApiTags('Conflicts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties/:propertyId/conflicts')
export class ConflictsController {
  constructor(private readonly calendarService: CalendarService) { }

  @Get()
  @ApiOperation({ summary: 'List all detected booking conflicts' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter conflicts by status'
  })
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
    return this.calendarService.removeConflict(conflictId, propertyId, preserveHistory);
  }

  // In src/modules/calendar/calendar.controller.ts - extend the ConflictsController

  @Post(':conflictId/resolve')
  @ApiOperation({ summary: 'Resolve a conflict by removing or deactivating conflicting events' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiParam({ name: 'conflictId', description: 'Conflict ID to resolve' })
  async resolveConflict(
    @Param('propertyId') propertyId: string,
    @Param('conflictId') conflictId: string,
    @Body() resolveConflictDto: ResolveConflictDto
  ) {
    return this.calendarService.resolveConflict(propertyId, conflictId, resolveConflictDto);
  }

  @Post(':conflictId/auto-resolve')
  @ApiOperation({ summary: 'Automatically resolve a conflict by removing/deactivating events with shorter duration' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  @ApiParam({ name: 'conflictId', description: 'Conflict ID to resolve' })
  @ApiQuery({ name: 'strategy', enum: ConflictResolutionStrategy, required: false })
  async autoResolveConflict(
    @Param('propertyId') propertyId: string,
    @Param('conflictId') conflictId: string,
    @Query('strategy') strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.DEACTIVATE
  ) {
    return this.calendarService.autoResolveConflict(propertyId, conflictId, strategy);
  }

}
