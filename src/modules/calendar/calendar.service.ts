import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarEvent } from './schemas/calendar-event.schema';
import { Conflict } from './schemas/conflict.schema';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { ConflictDetectorService } from './conflict-detector.service';
import { Platform, EventStatus, ConflictStatus } from '../../common/types';
import { UpdateEventDto } from './dto/update-event.dto';
import { ConflictResolutionStrategy, ResolveConflictDto } from './dto/resolve-conflict.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
    @InjectModel(Conflict.name) private conflictModel: Model<Conflict>,
    private readonly conflictDetectorService: ConflictDetectorService,
  ) { }

  async getCalendar(propertyId: string, query: CalendarQueryDto) {
    const filter: any = { property_id: propertyId, is_active: true };

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
    const appliedFilters: any[] = [];
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
      property_id: propertyId, is_active: true,
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
    const filter: any = { property_id: propertyId, is_active: true };

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

  // In src/modules/calendar/calendar.service.ts

  async createManualEvent(propertyId: string, createEventDto: CreateEventDto) {
    // Validate dates
    if (createEventDto.start_date >= createEventDto.end_date) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping events
    const availabilityCheck = await this.checkEventOverlap(
      propertyId,
      createEventDto.start_date,
      createEventDto.end_date
    );

    // If there are overlapping events, return a conflict response
    if (!availabilityCheck.isAvailable) {
      const conflictingEvents = availabilityCheck.conflictingEvents.map(event => ({
        id: event._id,
        summary: event.summary,
        start_date: event.start_date,
        end_date: event.end_date,
        platform: event.platform
      }));

      return {
        success: false,
        error: 'Date range conflict',
        details: {
          message: 'The selected dates conflict with existing events',
          conflicting_events: conflictingEvents,
          property_id: propertyId,
        },
        timestamp: new Date().toISOString(),
      };
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

  // In src/modules/calendar/calendar.service.ts

  async updateEvent(eventId: string, propertyId: string, updateEventDto: UpdateEventDto) {
    // Find the existing event
    const existingEvent = await this.calendarEventModel.findOne({
      _id: eventId,
      property_id: propertyId,
      is_active: true
    }).exec();

    if (!existingEvent) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Prepare the updated event data
    const updatedEventData: any = { ...updateEventDto };

    // If start or end dates are being updated, check for conflicts
    if (updatedEventData.start_date || updatedEventData.end_date) {
      const startDate = updatedEventData.start_date || existingEvent.start_date;
      const endDate = updatedEventData.end_date || existingEvent.end_date;

      // Validate dates
      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }

      // Check for overlapping events (excluding this event)
      const availabilityCheck = await this.checkEventOverlap(
        propertyId,
        startDate,
        endDate,
        eventId
      );

      // If there are overlapping events, return a conflict response
      if (!availabilityCheck.isAvailable) {
        const conflictingEvents = availabilityCheck.conflictingEvents.map(event => ({
          id: event._id,
          summary: event.summary,
          start_date: event.start_date,
          end_date: event.end_date,
          platform: event.platform
        }));

        return {
          success: false,
          error: 'Date range conflict',
          details: {
            message: 'The updated dates conflict with existing events',
            conflicting_events: conflictingEvents,
            property_id: propertyId,
            event_id: eventId
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Update the event
    updatedEventData.updated_at = new Date();
    const updatedEvent = await this.calendarEventModel.findByIdAndUpdate(
      eventId,
      updatedEventData,
      { new: true }
    ).exec();

    // Check for conflicts
    const conflicts = await this.conflictDetectorService.detectConflictsForEvent(updatedEvent!);

    const startDate = new Date(updatedEvent?.start_date!);
    const endDate = new Date(updatedEvent?.end_date!);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    return {
      success: true,
      data: {
        ...updatedEvent!.toObject(),
        duration_days: durationDays,
      },
      meta: {
        conflicts_detected: conflicts?.meta?.conflicts_detected || 0,
        property_id: propertyId,
      },
      message: `Event updated successfully for property ${propertyId}${conflicts?.length ? `. ${conflicts.length} conflicts detected.` : ''}`,
      timestamp: new Date().toISOString(),
    };
  }


  async getConflicts(propertyId: string, status?: string) {
    const filter: any = { property_id: propertyId, is_active: true };

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

  // src/modules/calendar/calendar.service.ts

  async transferEventOwnership(
    eventIds: string[],
    newPlatform: Platform = Platform.MANUAL
  ): Promise<any> {
    try {
      const updatedEvents = await this.calendarEventModel.updateMany(
        { _id: { $in: eventIds } },
        {
          platform: newPlatform,
          connection_id: null,
          ical_uid: null,
          updated_at: new Date()
        }
      ).exec();

      return {
        success: true,
        data: {
          matched_count: updatedEvents.matchedCount,
          modified_count: updatedEvents.modifiedCount,
          new_platform: newPlatform
        },
        message: `${updatedEvents.modifiedCount} events transferred to ${newPlatform} platform`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to transfer event ownership',
        details: {
          message: error.message,
          event_ids: eventIds,
          new_platform: newPlatform
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  // In src/modules/calendar/calendar.service.ts

  async checkEventOverlap(propertyId: string, startDate: Date, endDate: Date, excludeEventId?: string): Promise<{
    isAvailable: boolean;
    conflictingEvents: CalendarEvent[];
  }> {
    // Build the query to find overlapping events
    const query: any = {
      property_id: propertyId,
      is_active: true,
      status: { $regex: new RegExp(EventStatus.CONFIRMED, 'i') }, // Case-insensitive match
      $or: [
        { start_date: { $lt: endDate }, end_date: { $gt: startDate } },
      ],
    };

    // If we're editing an existing event, exclude it from the check
    if (excludeEventId) {
      query._id = { $ne: excludeEventId };
    }

    // Find overlapping events
    const overlappingEvents = await this.calendarEventModel.find(query).exec();

    return {
      isAvailable: overlappingEvents.length === 0,
      conflictingEvents: overlappingEvents
    };
  }

// In src/modules/calendar/calendar.service.ts - add these methods

async resolveConflict(
  propertyId: string,
  conflictId: string,
  resolveConflictDto: ResolveConflictDto
): Promise<any> {
  try {
    // Find the conflict
    const conflict = await this.conflictModel.findOne({
      _id: conflictId,
      property_id: propertyId,
      is_active: true
    }).exec();

    if (!conflict) {
      throw new NotFoundException(`Conflict with ID ${conflictId} not found for property ${propertyId}`);
    }

    // Get all events involved in the conflict
    const allEventIds = conflict.event_ids.map(id => id.toString());
    const eventsToRemove = allEventIds.filter(id => !resolveConflictDto.eventsToKeep.includes(id));

    if (eventsToRemove.length === 0) {
      return {
        success: false,
        message: 'No events selected for removal',
        details: {
          conflict_id: conflictId,
          property_id: propertyId,
          all_events: allEventIds,
          events_to_keep: resolveConflictDto.eventsToKeep
        },
        timestamp: new Date().toISOString()
      };
    }

    // Process the events based on the selected strategy
    let actionTaken: string;
    
    if (resolveConflictDto.strategy === ConflictResolutionStrategy.DELETE) {
      // Permanently delete the events
      await this.calendarEventModel.deleteMany({
        _id: { $in: eventsToRemove },
        property_id: propertyId
      }).exec();
      actionTaken = 'deleted';
    } else {
      // Deactivate the events
      await this.calendarEventModel.updateMany(
        { _id: { $in: eventsToRemove }, property_id: propertyId },
        { is_active: false }
      ).exec();
      actionTaken = 'deactivated';
    }

    // Mark the conflict as resolved
    await this.conflictModel.findByIdAndUpdate(
      conflictId,
      { status: ConflictStatus.RESOLVED, is_active: false }
    ).exec();

    // Get details of the remaining events for the response
    const remainingEvents = await this.calendarEventModel.find({
      _id: { $in: resolveConflictDto.eventsToKeep },
      property_id: propertyId, is_active: true
    }).exec();

    return {
      success: true,
      data: {
        conflict_id: conflictId,
        property_id: propertyId,
        resolution_strategy: resolveConflictDto.strategy,
        events_kept: remainingEvents.map(event => ({
          id: event._id,
          summary: event.summary,
          start_date: event.start_date,
          end_date: event.end_date,
          platform: event.platform
        })),
        events_removed: eventsToRemove,
        events_count: {
          total: allEventIds.length,
          kept: resolveConflictDto.eventsToKeep.length,
          removed: eventsToRemove.length
        }
      },
      message: `Conflict resolved successfully. ${eventsToRemove.length} events were ${actionTaken}.`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    return {
      success: false,
      error: 'Failed to resolve conflict',
      details: {
        message: error.message,
        conflict_id: conflictId,
        property_id: propertyId
      },
      timestamp: new Date().toISOString()
    };
  }
}

async autoResolveConflict(
  propertyId: string,
  conflictId: string,
  strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.DEACTIVATE
): Promise<any> {
  try {
    // Find the conflict
    const conflict = await this.conflictModel.findOne({
      _id: conflictId,
      property_id: propertyId,
      is_active: true
    }).exec();

    if (!conflict) {
      throw new NotFoundException(`Conflict with ID ${conflictId} not found for property ${propertyId}`);
    }

    // Get all events involved in the conflict
    const events = await this.calendarEventModel.find({
      _id: { $in: conflict.event_ids },
      property_id: propertyId, is_active: true
    }).exec();

    if (events.length < 2) {
      return {
        success: false,
        message: 'Not enough events found to resolve conflict',
        details: {
          conflict_id: conflictId,
          property_id: propertyId,
          events_found: events.length
        },
        timestamp: new Date().toISOString()
      };
    }

    // Calculate duration for each event and sort by duration (ascending)
    const eventsWithDuration = events.map(event => {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      
      return {
        id: event._id,
        summary: event.summary,
        start_date: event.start_date,
        end_date: event.end_date,
        platform: event.platform,
        duration_days: durationDays,
        duration_ms: durationMs
      };
    });

    // Sort events by duration (ascending)
    eventsWithDuration.sort((a, b) => a.duration_ms - b.duration_ms);

    // The event with the longest duration will be kept
    const eventToKeep = eventsWithDuration[eventsWithDuration.length - 1];
    const eventsToRemove = eventsWithDuration.slice(0, -1);
    
    // Process the events based on the selected strategy
    let actionTaken: string;
    
    if (strategy === ConflictResolutionStrategy.DELETE) {
      // Permanently delete the events
      await this.calendarEventModel.deleteMany({
        _id: { $in: eventsToRemove.map(e => e.id) },
        property_id: propertyId
      }).exec();
      actionTaken = 'deleted';
    } else {
      // Deactivate the events
      await this.calendarEventModel.updateMany(
        { _id: { $in: eventsToRemove.map(e => e.id) }, property_id: propertyId },
        { is_active: false }
      ).exec();
      actionTaken = 'deactivated';
    }

    // Mark the conflict as resolved
    await this.conflictModel.findByIdAndUpdate(
      conflictId,
      { status: ConflictStatus.RESOLVED, is_active: false }
    ).exec();

    return {
      success: true,
      data: {
        conflict_id: conflictId,
        property_id: propertyId,
        resolution_strategy: strategy,
        auto_resolution_method: 'keep_longest_booking',
        event_kept: {
          id: eventToKeep.id,
          summary: eventToKeep.summary,
          start_date: eventToKeep.start_date,
          end_date: eventToKeep.end_date,
          platform: eventToKeep.platform,
          duration_days: eventToKeep.duration_days
        },
        events_removed: eventsToRemove.map(event => ({
          id: event.id,
          summary: event.summary,
          start_date: event.start_date,
          end_date: event.end_date,
          platform: event.platform,
          duration_days: event.duration_days
        })),
        events_count: {
          total: events.length,
          kept: 1,
          removed: eventsToRemove.length
        }
      },
      message: `Conflict auto-resolved successfully. Kept the longest booking (${eventToKeep.duration_days} days) and ${actionTaken} ${eventsToRemove.length} shorter bookings.`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof NotFoundException) {
      throw error;
    }
    
    return {
      success: false,
      error: 'Failed to auto-resolve conflict',
      details: {
        message: error.message,
        conflict_id: conflictId,
        property_id: propertyId
      },
      timestamp: new Date().toISOString()
    };
  }
}

}
