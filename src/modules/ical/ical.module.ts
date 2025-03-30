import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ICalConnectionController } from './ical-connection.controller';
import { ICalConnectionService } from './ical-connection.service';
import { IcalService } from './ical.service';
import { IcalFeedController } from './ical-feed.controller';
import { ICalConnection, ICalConnectionSchema } from './schemas/ical-connection.schema';
import { CalendarModule } from '../calendar/calendar.module';

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
  controllers: [ICalConnectionController, IcalFeedController],
  providers: [ICalConnectionService, IcalService],
  exports: [ICalConnectionService, IcalService],
})
export class IcalModule {}
