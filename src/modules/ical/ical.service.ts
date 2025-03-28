import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as ical from 'node-ical';
import { Platform, EventType } from '../../common/types';

@Injectable()
export class IcalService {
  constructor(private readonly httpService: HttpService) {}

  async validateICalUrl(url: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'text' })
      );
      
      // Try to parse the iCal data
      const events = await ical.async.parseICS(response.data);
      
      // Check if there are any events in the feed
      if (Object.keys(events).length === 0) {
        throw new Error('iCal feed contains no events');
      }
      
      return true;
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          `Failed to fetch iCal feed: ${error.response.status} ${error.response.statusText}`,
          HttpStatus.BAD_REQUEST
        );
      }
      throw new HttpException(
        `Failed to validate iCal URL: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async fetchAndParseICalFeed(url: string, platform: Platform): Promise<any[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'text' })
      );
      
      const events = await ical.async.parseICS(response.data);
      return this.normalizeICalEvents(events, platform);
    } catch (error) {
      throw new HttpException(
        `Failed to fetch iCal feed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private normalizeICalEvents(events: any, platform: Platform): any[] {
    // Explicitly type the array to avoid 'never[]' inference
    const normalizedEvents: any[] = [];
    
    // Properly type the entries from Object.entries
    for (const [uid, event] of Object.entries(events) as [string, any][]) {
      if (event.type !== 'VEVENT') continue;
      
      const eventData = event as ical.VEvent;
      
      normalizedEvents.push({
        ical_uid: uid,
        summary: eventData.summary,
        start_date: eventData.start,
        end_date: eventData.end,
        event_type: this.determineEventType(eventData, platform),
        status: eventData.status || 'confirmed',
        description: eventData.description,
        platform,
      });
    }
    
    return normalizedEvents;
  }
  

  private determineEventType(event: ical.VEvent, platform: Platform): EventType {
    // Platform-specific logic to determine event type
    switch (platform) {
      case Platform.AIRBNB:
        if (event.summary?.includes('CONFIRMED')) {
          return EventType.BOOKING;
        } else if (event.summary?.includes('UNAVAILABLE')) {
          return EventType.BLOCKED;
        }
        break;
      case Platform.BOOKING:
        if (event.summary?.includes('Booking.com')) {
          return EventType.BOOKING;
        }
        break;
      // Add cases for other platforms
    }
    
    // Default determination based on common patterns
    if (event.summary?.toLowerCase().includes('booking') || 
        event.summary?.toLowerCase().includes('reservation')) {
      return EventType.BOOKING;
    } else if (event.summary?.toLowerCase().includes('blocked') || 
               event.summary?.toLowerCase().includes('unavailable')) {
      return EventType.BLOCKED;
    } else if (event.summary?.toLowerCase().includes('maintenance')) {
      return EventType.MAINTENANCE;
    }
    
    // Default to booking if we can't determine
    return EventType.BOOKING;
  }
}
