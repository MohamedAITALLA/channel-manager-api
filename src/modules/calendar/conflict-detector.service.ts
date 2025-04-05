import { Injectable } from '@nestjs/common';
import { getModelToken, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarEvent } from './schemas/calendar-event.schema';
import { Conflict } from './schemas/conflict.schema';
import { ConflictType, ConflictSeverity, ConflictStatus, EventStatus } from '../../common/types';

@Injectable()
export class ConflictDetectorService {
  moduleRef: any;
  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
    @InjectModel(Conflict.name) private conflictModel: Model<Conflict>,
  ) {}

  async detectConflictsForEvent(event: CalendarEvent): Promise<any> {
    // Skip conflict detection for cancelled events
    if (event.status?.toLowerCase() === EventStatus.CANCELLED.toLowerCase()) {
      return [];
    }
    
    // Find overlapping events
    const overlappingEvents = await this.calendarEventModel.find({
      property_id: event.property_id,
      _id: { $ne: event._id }, // Exclude the current event
      status: { $regex: new RegExp(EventStatus.CONFIRMED, 'i') }, // Case-insensitive match
      $or: [
        { start_date: { $lt: event.end_date }, end_date: { $gt: event.start_date } },
      ],
    }).exec();
    
    if (overlappingEvents.length === 0) {
      return {
        success: true,
        data: [],
        meta: {
          property_id: event.property_id,
          event_id: event._id,
          event_platform: event.platform,
          conflicts_detected: 0,
        },
        message: 'No conflicts detected for this event',
        timestamp: new Date().toISOString(),
      }.data;
    }
    
    // Create a conflict record
    const conflict = new this.conflictModel({
      property_id: event.property_id,
      event_ids: [event._id, ...overlappingEvents.map(e => e._id)],
      conflict_type: ConflictType.OVERLAP,
      start_date: this.getEarliestDate([event, ...overlappingEvents]),
      end_date: this.getLatestDate([event, ...overlappingEvents]),
      severity: ConflictSeverity.HIGH,
      status: ConflictStatus.NEW,
      description: `Booking conflict detected between ${overlappingEvents.length + 1} events`,
    });
    
    const savedConflict = await conflict.save();
    
    // Format the duration of the conflict
    const conflictDurationMs = savedConflict.end_date.getTime() - savedConflict.start_date.getTime();
    const conflictDurationDays = Math.ceil(conflictDurationMs / (1000 * 60 * 60 * 24));
    
    // Get platform information for the message
    const platforms = [...new Set([
      event.platform,
      ...overlappingEvents.map(e => e.platform)
    ])].filter(Boolean);
    
    const platformsStr = platforms.length > 0 
      ? `across platforms: ${platforms.join(', ')}` 
      : '';
    
    return {
      success: true,
      data: [savedConflict],
      meta: {
        property_id: event.property_id,
        event_id: event._id,
        event_platform: event.platform,
        conflicts_detected: 1,
        conflict_details: {
          type: ConflictType.OVERLAP,
          severity: ConflictSeverity.HIGH,
          duration_days: conflictDurationDays,
          affected_events: overlappingEvents.length + 1,
          platforms: platforms,
        },
      },
      message: `Detected ${overlappingEvents.length + 1}-way booking conflict ${platformsStr} spanning ${conflictDurationDays} days`,
      timestamp: new Date().toISOString(),
    }.data;
  }

  async detectAllConflictsForProperty(propertyId: string): Promise<any> {
    // Get all active events for the property
    const events = await this.calendarEventModel.find({
      property_id: propertyId,
      status: { $regex: new RegExp(EventStatus.CONFIRMED, 'i') }, // Case-insensitive match
    }).exec();
    
    // Clear existing conflicts for this property
    const deleteResult = await this.conflictModel.deleteMany({
      property_id: propertyId,
    }).exec();
    
    const conflicts: Conflict[] = [];
    const overlapConflicts: Conflict[] = [];
    const turnoverConflicts: Conflict[] = [];
    
    // Check each event against all others
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        // Check for overlap
        if (this.eventsOverlap(event1, event2)) {
          const conflict = new this.conflictModel({
            property_id: propertyId,
            event_ids: [event1._id, event2._id],
            conflict_type: ConflictType.OVERLAP,
            start_date: this.getEarliestDate([event1, event2]),
            end_date: this.getLatestDate([event1, event2]),
            severity: ConflictSeverity.HIGH,
            status: ConflictStatus.NEW,
            description: `Booking conflict detected between events from ${event1.platform || 'unknown'} and ${event2.platform || 'unknown'}`,
          });
          
          const savedConflict = await conflict.save();
          conflicts.push(savedConflict);
          overlapConflicts.push(savedConflict);
        }
        
        // Check for same-day turnover
        else if (this.eventsSameDayTurnover(event1, event2)) {
          const conflict = new this.conflictModel({
            property_id: propertyId,
            event_ids: [event1._id, event2._id],
            conflict_type: ConflictType.TURNOVER,
            start_date: this.getEarliestDate([event1, event2]),
            end_date: this.getLatestDate([event1, event2]),
            severity: ConflictSeverity.MEDIUM,
            status: ConflictStatus.NEW,
            description: `Same-day turnover detected between events from ${event1.platform || 'unknown'} and ${event2.platform || 'unknown'}`,
          });
          
          const savedConflict = await conflict.save();
          conflicts.push(savedConflict);
          turnoverConflicts.push(savedConflict);
        }
      }
    }
    
    // Group conflicts by platform combinations
    const platformPairs = conflicts.reduce((acc, conflict) => {
      const eventIds = conflict.event_ids;
      if (eventIds.length >= 2) {
        const eventsForConflict = eventIds.map(id => 
          events.find(e => e._id?.toString() === id.toString())
        ).filter(Boolean);
        
        if (eventsForConflict.length >= 2) {
          const platforms = eventsForConflict.map(e => e?.platform || 'unknown').sort();
          const key = platforms.join('-');
          acc[key] = (acc[key] || 0) + 1;
        }
      }
      return acc;
    }, {});
    
    return {
      success: true,
      data: conflicts,
      meta: {
        property_id: propertyId,
        total_events_analyzed: events.length,
        conflicts_detected: {
          total: conflicts.length,
          by_type: {
            overlap: overlapConflicts.length,
            turnover: turnoverConflicts.length,
          },
          by_platform_pairs: platformPairs,
        },
        previous_conflicts_cleared: deleteResult.deletedCount || 0,
      },
      message: conflicts.length > 0
        ? `Detected ${conflicts.length} conflicts (${overlapConflicts.length} overlaps, ${turnoverConflicts.length} turnovers) across ${events.length} events`
        : `No conflicts detected across ${events.length} events`,
      timestamp: new Date().toISOString(),
    }.data;
  }

  private eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return event1.start_date < event2.end_date && event2.start_date < event1.end_date;
  }

  private eventsSameDayTurnover(event1: CalendarEvent, event2: CalendarEvent): boolean {
    // Check if one event ends on the same day another begins
    const event1EndDate = new Date(event1.end_date);
    const event2StartDate = new Date(event2.start_date);
    const event2EndDate = new Date(event2.end_date);
    const event1StartDate = new Date(event1.start_date);
    
    return (
      this.isSameDay(event1EndDate, event2StartDate) ||
      this.isSameDay(event2EndDate, event1StartDate)
    );
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private getEarliestDate(events: CalendarEvent[]): Date {
    return new Date(
      Math.min(...events.map(e => e.start_date.getTime()))
    );
  }

  private getLatestDate(events: CalendarEvent[]): Date {
    return new Date(
      Math.max(...events.map(e => e.end_date.getTime()))
    );
  }

  // src/modules/calendar/conflict-detector.service.ts

async cleanupConflictsAfterConnectionRemoval(propertyId: string, connectionId: string): Promise<any> {
  try {
    // First, get all events associated with this connection
    const calendarEventModel = this.moduleRef.get(getModelToken(CalendarEvent.name), { strict: false });
    const eventsFromConnection = await calendarEventModel.find({
      property_id: propertyId,
      connection_id: connectionId
    }).select('_id').exec();
    
    const eventIds = eventsFromConnection.map(event => event._id);
    
    if (eventIds.length === 0) {
      return {
        success: true,
        message: 'No events from this connection were involved in conflicts',
        affected_conflicts: 0
      };
    }
    
    // Find conflicts involving these events
    const conflicts = await this.conflictModel.find({
      property_id: propertyId,
      event_ids: { $in: eventIds }
    }).exec();
    
    if (conflicts.length === 0) {
      return {
        success: true,
        message: 'No conflicts found involving events from this connection',
        affected_conflicts: 0
      };
    }
    
    // For each conflict, we need to decide what to do:
    // 1. If the conflict only involves events from this connection, delete it
    // 2. If the conflict involves other events too, recalculate it
    
    let deletedCount = 0;
    let recalculatedCount = 0;
    
    for (const conflict of conflicts) {
      // Check if all events in this conflict are from the removed connection
      const otherEventIds = conflict.event_ids.filter(
        id => !eventIds.some(eventId => eventId.equals(id))
      );
      
      if (otherEventIds.length === 0) {
        // All events in this conflict are from the removed connection, delete it
        await this.conflictModel.deleteOne({ _id: conflict._id }).exec();
        deletedCount++;
      } else if (otherEventIds.length === 1) {
        // Only one event remains, no conflict possible
        await this.conflictModel.deleteOne({ _id: conflict._id }).exec();
        deletedCount++;
      } else {
        // Recalculate the conflict with remaining events
        const remainingEvents = await calendarEventModel.find({
          _id: { $in: otherEventIds }
        }).exec();
        
        // Check if there's still a conflict
        const hasOverlap = this.checkForOverlap(remainingEvents);
        
        if (hasOverlap) {
          // Update the conflict with new information
          await this.conflictModel.updateOne(
            { _id: conflict._id },
            {
              event_ids: otherEventIds,
              start_date: this.getEarliestDate(remainingEvents),
              end_date: this.getLatestDate(remainingEvents),
              description: `Booking conflict detected between ${otherEventIds.length} events (recalculated after connection removal)`
            }
          ).exec();
          recalculatedCount++;
        } else {
          // No conflict anymore
          await this.conflictModel.deleteOne({ _id: conflict._id }).exec();
          deletedCount++;
        }
      }
    }
    
    return {
      success: true,
      message: `Cleaned up conflicts after connection removal: ${deletedCount} deleted, ${recalculatedCount} recalculated`,
      affected_conflicts: conflicts.length,
      deleted: deletedCount,
      recalculated: recalculatedCount
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to clean up conflicts: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Helper method to check for overlaps in a set of events
private checkForOverlap(events: CalendarEvent[]): boolean {
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (this.eventsOverlap(events[i], events[j])) {
        return true;
      }
    }
  }
  return false;
}

}
