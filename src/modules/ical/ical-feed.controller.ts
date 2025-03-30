import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { CalendarService } from '../calendar/calendar.service';
import { IcalService } from './ical.service';
import { EventType, Platform } from '../../common/types';

@ApiTags('iCal Feeds')
@Controller('properties/:propertyId/ical-feed')
export class IcalFeedController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly icalService: IcalService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get iCal feed for a property' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  async getIcalFeed(@Param('propertyId') propertyId: string, @Res() res: Response) {
    // Get all events for the property
    const events = await this.calendarService.getCalendar(propertyId, {});
    
    // Generate iCal content
    const icalContent = this.icalService.generateIcalContent(events, propertyId);
    
    // Set response headers
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="property-${propertyId}.ics"`);
    
    // Send the response
    return res.send(icalContent);
  }


}