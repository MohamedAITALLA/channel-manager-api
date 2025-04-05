// src/modules/analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import { CalendarEvent, CalendarEventSchema } from '../calendar/schemas/calendar-event.schema';
import { ICalConnection, ICalConnectionSchema } from '../ical/schemas/ical-connection.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Conflict, ConflictSchema } from '../calendar/schemas/conflict.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: CalendarEvent.name, schema: CalendarEventSchema },
      { name: ICalConnection.name, schema: ICalConnectionSchema },
      { name: User.name, schema: UserSchema },
      { name: Conflict.name, schema: ConflictSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
