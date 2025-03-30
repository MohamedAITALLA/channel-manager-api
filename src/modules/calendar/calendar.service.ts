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
    
    return events;
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
    
    return {
      property_id: propertyId,
      start_date: startDate,
      end_date: endDate,
      is_available: isAvailable,
      conflicting_events: isAvailable ? [] : overlappingEvents,
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
    
    return events;
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
    await this.conflictDetectorService.detectConflictsForEvent(savedEvent);
    
    return savedEvent;
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
    
    return conflicts;
  }
}
