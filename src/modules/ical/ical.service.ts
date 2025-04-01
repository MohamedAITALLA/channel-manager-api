import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as ical from 'node-ical';
import { Platform, EventType } from '../../common/types';

@Injectable()
export class IcalService {
  constructor(private readonly httpService: HttpService) { }

  async validateICalUrl(url: string): Promise<any> {
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

      return {
        success: true,
        data: {
          url,
          is_valid: true,
          events_count: Object.keys(events).length,
        },
        message: 'iCal URL validated successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          {
            success: false,
            error: `Failed to fetch iCal feed: ${error.response.status} ${error.response.statusText}`,
            details: {
              url,
              status_code: error.response.status,
              status_text: error.response.statusText,
            },
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST
        );
      }
      throw new HttpException(
        {
          success: false,
          error: `Failed to validate iCal URL: ${error.message}`,
          details: {
            url,
            reason: error.message,
          },
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async fetchAndParseICalFeed(url: string, platform: Platform): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { responseType: 'text' })
      );

      const events = await ical.async.parseICS(response.data);
      const normalizedEvents = this.normalizeICalEvents(events, platform);
      
      
      return {
        success: true,
        data: {
          events: normalizedEvents,
          source: {
            url,
            platform,
          },
          meta: {
            total_events: normalizedEvents.length,
            raw_events_count: Object.keys(events).length,
            platform_name: platform,
          }
        },
        message: normalizedEvents.length > 0 
          ? `Successfully fetched and parsed ${normalizedEvents.length} events from ${platform} calendar`
          : `No events found in the ${platform} calendar`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: `Failed to fetch iCal feed: ${error.message}`,
          details: {
            url,
            platform,
            reason: error.message,
          },
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private normalizeEventStatus(status: string): string {
    if (!status) return 'confirmed';
    
    const statusLower = status.toLowerCase();
    
    // Map various status values to your system's expected values
    if (statusLower.includes('confirm')) return 'confirmed';
    if (statusLower.includes('cancel')) return 'cancelled';
    if (statusLower.includes('tentative')) return 'tentative';
    
    return 'confirmed'; // Default
  }
  

  private normalizeICalEvents(events: any, platform: Platform): any[] {
    // Explicitly type the array to avoid 'never[]' inference
    const normalizedEvents: any[] = [];

    // Properly type the entries from Object.entries
    for (const [uid, event] of Object.entries(events) as [string, any][]) {
      if (event.type !== 'VEVENT') continue;

      const eventData = event as ical.VEvent;
      const eventType = this.determineEventType(eventData, platform);

      normalizedEvents.push({
        ical_uid: uid,
        summary: eventData.summary,
        start_date: eventData.start,
        end_date: eventData.end,
        event_type: eventType,
        event_type_label: this.getEventTypeLabel(eventType),
        status: this.normalizeEventStatus(eventData.status!) || 'confirmed',
        description: eventData.description,
        platform,
        duration_days: this.calculateDurationInDays(eventData.start, eventData.end),
      });
    }

    return normalizedEvents;
  }

  private calculateDurationInDays(start: Date, end: Date): number {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private determineEventType(event: ical.VEvent, platform: Platform): EventType {
    // Platform-specific logic to determine event type
    const platformUpper = platform?.toUpperCase();
    switch (platformUpper) {
      case Platform.AIRBNB.toUpperCase():
        if (event.summary?.includes('CONFIRMED')) {
          return EventType.BOOKING;
        } else if (event.summary?.includes('UNAVAILABLE')) {
          return EventType.BLOCKED;
        }
        break;
      case Platform.BOOKING.toUpperCase():
        if (event.summary?.includes('Booking')) {
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

  generateIcalContent(events: any, propertyId: string): any {
    try {
      // Start the iCal content
      let icalContent = [
        'BEGIN:VCALENDAR',
        'PRODID:-//Channel Manager//Property Calendar 1.0//EN',
        'CALSCALE:GREGORIAN',
        'VERSION:2.0',
      ];

      // Add each event
      for (const event of events) {
        // Format dates in iCal format (YYYYMMDD)
        const startDate = this.formatDateForIcal(event.start_date);
        const endDate = this.formatDateForIcal(event.end_date);

        // Create a unique ID for the event
        const uid = `${event._id}@channel-manager.com`;

        // Determine summary based on platform and event type
        let summary = `${event.platform} (${this.getEventTypeLabel(event.event_type)})`;

        // Add the event to the iCal content
        icalContent = [
          ...icalContent,
          'BEGIN:VEVENT',
          `DTSTAMP:${this.formatDateTimeForIcal(new Date())}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${endDate}`,
          `SUMMARY:${summary}`,
          `UID:${uid}`,
          'END:VEVENT',
        ];
      }

      // End the iCal content
      icalContent.push('END:VCALENDAR');

      // Join all lines with CRLF as per iCal spec
      const icalString = icalContent.join('\r\n');
      
      return {
        success: true,
        data: {
          content: icalString,
          property_id: propertyId,
          meta: {
            events_count: events.length,
            generated_at: new Date().toISOString(),
            file_size: Buffer.byteLength(icalString, 'utf8'),
          }
        },
        message: `Successfully generated iCal content with ${events.length} events for property ${propertyId}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate iCal content: ${error.message}`,
        details: {
          property_id: propertyId,
          events_count: events?.length || 0,
          reason: error.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  private formatDateForIcal(date: Date): string {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('T')[0];
  }

  private formatDateTimeForIcal(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\..+/g, 'Z');
  }

  private getEventTypeLabel(eventType: EventType): string {
    const eventTypeUpper = eventType?.toUpperCase();
    switch (eventTypeUpper) {
      case EventType.BOOKING.toUpperCase():
        return 'Booked';
      case EventType.BLOCKED.toUpperCase():
        return 'Not available';
      case EventType.MAINTENANCE.toUpperCase():
        return 'Maintenance';
      default:
        return 'Not available';
    }
  }
}
