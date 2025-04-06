import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ICalConnectionController } from './ical-connection.controller';
import { ICalConnectionService } from './ical-connection.service';
import { IcalService } from './ical.service';
import { IcalFeedController } from './ical-feed.controller';
import { AdminICalConnectionController } from './admin-ical-connection.controller';
import { AdminICalConnectionService } from './admin-ical-connection.service';
import { ICalConnection, ICalConnectionSchema } from './schemas/ical-connection.schema';
import { CalendarModule } from '../calendar/calendar.module';
import { AuditService } from '../audit/audit.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    MongooseModule.forFeature([
      { name: ICalConnection.name, schema: ICalConnectionSchema },
    ]),
    // Import CalendarModule to access CalendarService
    CalendarModule,
  ],
  controllers: [ICalConnectionController, IcalFeedController, AdminICalConnectionController],
  providers: [ICalConnectionService, IcalService, AdminICalConnectionService, AuditService],
  exports: [ICalConnectionService, IcalService, AdminICalConnectionService],
})
export class IcalModule {}
