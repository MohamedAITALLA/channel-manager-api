// src/modules/calendar/admin-calendar.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarEvent } from './schemas/calendar-event.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminCalendarService {
  constructor(
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
    private readonly auditService: AuditService,
  ) {}

  async getAllEvents(
    page: number = 1,
    limit: number = 10,
    propertyId?: string,
    startDate?: Date,
    endDate?: Date,
    platform?: string,
    eventType?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (propertyId) query.property_id = propertyId;
    if (platform) query.platform = platform;
    if (eventType) query.event_type = eventType;
    if (startDate || endDate) {
      query.$or = [];
      
      if (startDate && endDate) {
        // Events that overlap with the date range
        query.$or.push({
          $and: [
            { start_date: { $lte: new Date(endDate) } },
            { end_date: { $gte: new Date(startDate) } },
          ],
        });
      } else if (startDate) {
        query.$or.push({ start_date: { $gte: new Date(startDate) } });
      } else if (endDate) {
        query.$or.push({ end_date: { $lte: new Date(endDate) } });
      }
    }

    const events = await this.calendarEventModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ start_date: 1 })
      .exec();

    const total = await this.calendarEventModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: events,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: events.length > 0
        ? `Successfully retrieved ${events.length} calendar events`
        : 'No calendar events found matching the criteria',
    };
  }

  async getEventById(eventId: string) {
    const event = await this.calendarEventModel.findById(eventId).exec();

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    return {
      success: true,
      data: event,
      message: 'Calendar event retrieved successfully',
    };
  }

  async updateEvent(eventId: string, updateEventDto: any, adminId: string) {
    const event = await this.calendarEventModel.findById(eventId).exec();

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: 'UPDATE',
      entity_type: 'CalendarEvent',
      entity_id: eventId,
      user_id: adminId,
      property_id: event.property_id.toString(),
      details: {
        before: event.toObject(),
        changes: updateEventDto,
      },
    });

    const updatedEvent = await this.calendarEventModel
      .findByIdAndUpdate(eventId, updateEventDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedEvent,
      message: 'Calendar event updated successfully',
    };
  }

  async deleteEvent(eventId: string, adminId: string) {
    const event = await this.calendarEventModel.findById(eventId).exec();

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    // Create audit entry before deletion
    await this.auditService.createAuditEntry({
      action: 'DELETE',
      entity_type: 'CalendarEvent',
      entity_id: eventId,
      user_id: adminId,
      property_id: event.property_id.toString(),
      details: {
        deleted_event: event.toObject(),
      },
    });

    await this.calendarEventModel.findByIdAndDelete(eventId).exec();

    return {
      success: true,
      message: 'Calendar event deleted successfully',
    };
  }

  async setEventActiveStatus(eventId: string, isActive: boolean, adminId: string) {
    const event = await this.calendarEventModel.findById(eventId).exec();

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity_type: 'CalendarEvent',
      entity_id: eventId,
      user_id: adminId,
      property_id: event.property_id.toString(),
      details: {
        before: { is_active: event.is_active },
        after: { is_active: isActive },
      },
    });

    const updatedEvent = await this.calendarEventModel
      .findByIdAndUpdate(eventId, { is_active: isActive }, { new: true })
      .exec();

    return {
      success: true,
      data: updatedEvent,
      message: `Calendar event ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}