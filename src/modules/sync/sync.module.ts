import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SyncController, PropertySyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { IcalModule } from '../ical/ical.module';
import { CalendarModule } from '../calendar/calendar.module';
import { NotificationModule } from '../notification/notification.module';
import { ICalConnection, ICalConnectionSchema } from '../ical/schemas/ical-connection.schema';
import { CalendarEvent, CalendarEventSchema } from '../calendar/schemas/calendar-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ICalConnection.name, schema: ICalConnectionSchema },
      { name: CalendarEvent.name, schema: CalendarEventSchema },
    ]),
    IcalModule,
    CalendarModule,
    NotificationModule,
  ],
  controllers: [SyncController, PropertySyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
