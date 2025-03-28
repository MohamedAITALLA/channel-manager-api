import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarEvent } from './schemas/calendar-event.schema';
import { Conflict } from './schemas/conflict.schema';
import { ConflictType, ConflictSeverity, ConflictStatus, EventStatus } from '../../common/types';

@Injectable()
export class ConflictDetectorService {
  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
    @InjectModel(Conflict.name) private conflictModel: Model<Conflict>,
  ) {}

  async detectConflictsForEvent(event: CalendarEvent): Promise<Conflict[]> {
    // Skip conflict detection for cancelled events
    if (event.status === EventStatus.CANCELLED) {
      return [];
    }
    
    // Find overlapping events
    const overlappingEvents = await this.calendarEventModel.find({
      property_id: event.property_id,
      _id: { $ne: event._id }, // Exclude the current event
      status: EventStatus.CONFIRMED,
      $or: [
        { start_date: { $lt: event.end_date }, end_date: { $gt: event.start_date } },
      ],
    }).exec();
    
    if (overlappingEvents.length === 0) {
      return [];
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
    
    return [await conflict.save()];
  }

  async detectAllConflictsForProperty(propertyId: string): Promise<Conflict[]> {
    // Get all active events for the property
    const events = await this.calendarEventModel.find({
      property_id: propertyId,
      status: EventStatus.CONFIRMED,
    }).exec();
    
    // Clear existing conflicts for this property
    await this.conflictModel.deleteMany({
      property_id: propertyId,
    }).exec();
    
    const conflicts: Conflict[] = [];
    
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
            description: `Booking conflict detected between events from ${event1.platform} and ${event2.platform}`,
          });
          
          conflicts.push(await conflict.save());
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
            description: `Same-day turnover detected between events from ${event1.platform} and ${event2.platform}`,
          });
          
          conflicts.push(await conflict.save());
        }
      }
    }
    
    return conflicts;
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
}
