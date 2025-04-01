import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarEvent } from './schemas/calendar-event.schema';
import { Conflict } from './schemas/conflict.schema';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { ConflictDetectorService } from './conflict-detector.service';
import { Platform, EventStatus, ConflictStatus } from '../../common/types';

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
    @InjectModel(Conflict.name) private conflictModel: Model<Conflict>,
    private readonly conflictDetectorService: ConflictDetectorService,
  ) {}

  async getCalendar(propertyId: string, query: CalendarQueryDto) {
    const filter: any = { property_id: propertyId };
    
    if (query.start_date) {
      filter.end_date = { $gte: new Date(query.start_date) };
    }
    
    if (query.end_date) {
      filter.start_date = { $lte: new Date(query.end_date) };
    }
    
    if (query.platforms && query.platforms.length > 0) {
      filter.platform = { $in: query.platforms };
    }
    
    if (query.event_types && query.event_types.length > 0) {
      filter.event_type = { $in: query.event_types };
    }
    
    const events = await this.calendarEventModel
      .find(filter)
      .sort({ start_date: 1 })
      .exec();
    
    // Applied filters for response message
    const appliedFilters:any[] = [];
    if (query.start_date) appliedFilters.push(`start after ${query.start_date}`);
    if (query.end_date) appliedFilters.push(`end before ${query.end_date}`);
    if (query.platforms?.length) appliedFilters.push(`platforms: ${query.platforms.join(', ')}`);
    if (query.event_types?.length) appliedFilters.push(`event types: ${query.event_types.join(', ')}`);
    
    const filterMessage = appliedFilters.length > 0 
      ? ` with filters: ${appliedFilters.join('; ')}` 
      : '';
    
    return {
      success: true,
      data: events,
      meta: {
        total: events.length,
        property_id: propertyId,
        filters: {
          start_date: query.start_date || null,
          end_date: query.end_date || null,
          platforms: query.platforms || [],
          event_types: query.event_types || [],
        }
      },
      message: events.length > 0 
        ? `Successfully retrieved ${events.length} calendar events${filterMessage}`
        : `No calendar events found${filterMessage}`,
      timestamp: new Date().toISOString(),
    };
  }

  async checkAvailability(propertyId: string, startDateStr: string, endDateStr: string) {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('Both start_date and end_date are required');
    }
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }
    
    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }
    
    // Check for overlapping events
    const overlappingEvents = await this.calendarEventModel.find({
      property_id: propertyId,
      status: { $regex: new RegExp(EventStatus.CONFIRMED, 'i') }, // Case-insensitive match
      $or: [
        { start_date: { $lt: endDate }, end_date: { $gt: startDate } },
      ],
    }).exec();
    
    const isAvailable = overlappingEvents.length === 0;
    
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return {
      success: true,
      data: {
        property_id: propertyId,
        start_date: startDate,
        end_date: endDate,
        is_available: isAvailable,
        conflicting_events: isAvailable ? [] : overlappingEvents,
        duration_days: durationDays,
      },
      message: isAvailable 
        ? `Property is available for the requested period (${durationDays} days)`
        : `Property has ${overlappingEvents.length} conflicting booking(s) during the requested period`,
      timestamp: new Date().toISOString(),
    };
  }

  async getEvents(propertyId: string, query: CalendarQueryDto) {
    const filter: any = { property_id: propertyId };
    
    if (query.start_date) {
      filter.end_date = { $gte: new Date(query.start_date) };
    }
    
    if (query.end_date) {
      filter.start_date = { $lte: new Date(query.end_date) };
    }
    
    if (query.platforms && query.platforms.length > 0) {
      filter.platform = { $in: query.platforms };
    }
    
    if (query.event_types && query.event_types.length > 0) {
      filter.event_type = { $in: query.event_types };
    }
    
    const events = await this.calendarEventModel
      .find(filter)
      .sort({ start_date: 1 })
      .exec();
    
    // Group events by platform for the metadata
    const platformCounts = events.reduce((acc, event) => {
      const platform = event.platform || 'unspecified';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});
    
    return {
      success: true,
      data: events,
      meta: {
        total: events.length,
        property_id: propertyId,
        platforms: platformCounts,
        date_range: {
          from: query.start_date || 'any',
          to: query.end_date || 'any',
        }
      },
      message: events.length > 0 
        ? `Successfully retrieved ${events.length} events for property ${propertyId}`
        : `No events found for the specified criteria`,
      timestamp: new Date().toISOString(),
    };
  }

  async createManualEvent(propertyId: string, createEventDto: CreateEventDto) {
    // Validate dates
    if (createEventDto.start_date >= createEventDto.end_date) {
      throw new BadRequestException('End date must be after start date');
    }
    
    // Generate a unique iCal UID for manual events
    const icalUid = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    const newEvent = new this.calendarEventModel({
      property_id: propertyId,
      ical_uid: icalUid,
      ...createEventDto,
    });
    
    const savedEvent = await newEvent.save();
    
    // Check for conflicts
    const conflicts = await this.conflictDetectorService.detectConflictsForEvent(savedEvent);
    
    const startDate = new Date(savedEvent.start_date);
    const endDate = new Date(savedEvent.end_date);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    
    return {
      success: true,
      data: {
        ...savedEvent.toObject(),
        duration_days: durationDays,
      },
      meta: {
        conflicts_detected: conflicts?.meta?.conflicts_detected || 0,
        property_id: propertyId,
      },
      message: `Event created successfully for property ${propertyId}${conflicts?.length ? `. ${conflicts.length} conflicts detected.` : ''}`,
      timestamp: new Date().toISOString(),
    };
  }

  async getConflicts(propertyId: string, status?: string) {
    const filter: any = { property_id: propertyId };
    
    if (status) {
      filter.status = status;
    }
    
    const conflicts = await this.conflictModel
      .find(filter)
      .populate('event_ids')
      .sort({ created_at: -1 })
      .exec();
    
    // Group conflicts by status
    const statusCounts = conflicts.reduce((acc, conflict) => {
      acc[conflict.status] = (acc[conflict.status] || 0) + 1;
      return acc;
    }, {});
    
    return {
      success: true,
      data: conflicts,
      meta: {
        total: conflicts.length,
        property_id: propertyId,
        status_filter: status || 'all',
        status_breakdown: statusCounts,
      },
      message: conflicts.length > 0 
        ? `Retrieved ${conflicts.length} conflicts${status ? ` with status '${status}'` : ''} for property ${propertyId}`
        : `No conflicts found${status ? ` with status '${status}'` : ''} for property ${propertyId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async removeCalenderEevent(eventId: string, propertyId: string, preserve_history: boolean = false) {
    let event;
    let actionTaken;
    
    if (preserve_history) {
      event = await this.calendarEventModel
        .findOneAndUpdate(
          { _id: eventId, property_id: propertyId },
          { is_active: false },
          { new: true }
        )
        .exec();
      
      actionTaken = 'deactivated';
    } else {
      event = await this.calendarEventModel
        .findOneAndDelete({ _id: eventId, property_id: propertyId })
        .exec();
      
      actionTaken = 'permanently deleted';
    }
    
    if (!event) {
      throw new NotFoundException(`Calendar event with ID ${eventId} not found`);
    }
    
    return {
      success: true,
      data: event.toObject(),
      meta: {
        property_id: propertyId,
        event_id: eventId,
        preserve_history,
        action: actionTaken,
      },
      message: `Calendar event has been ${actionTaken} successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  async removeConflict(conflictId: string, propertyId: string, preserve_history: boolean = false) {
    let conflict;
    let actionTaken;
    
    if (preserve_history) {
      conflict = await this.conflictModel
        .findOneAndUpdate(
          { _id: conflictId, property_id: propertyId },
          { is_active: false },
          { new: true }
        )
        .exec();
      
      actionTaken = 'deactivated';
    } else {
      conflict = await this.conflictModel
        .findOneAndDelete({ _id: conflictId, property_id: propertyId })
        .exec();
      
      actionTaken = 'permanently deleted';
    }
    
    if (!conflict) {
      throw new NotFoundException(`Conflict with ID ${conflictId} not found`);
    }
    
    return {
      success: true,
      data: conflict.toObject(),
      meta: {
        property_id: propertyId,
        conflict_id: conflictId,
        preserve_history,
        action: actionTaken,
        affected_events: conflict.event_ids?.length || 0,
      },
      message: `Conflict has been ${actionTaken} successfully`,
      timestamp: new Date().toISOString(),
    };
  }
}
