import { Module, forwardRef } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
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
import { Model } from 'mongoose';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    MongooseModule.forFeature([
      { name: ICalConnection.name, schema: ICalConnectionSchema },
    ]),
    // Use forwardRef to handle circular dependency with CalendarModule
    forwardRef(() => CalendarModule),
    forwardRef(() => AuditModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => AuthModule),
    forwardRef(() => SyncModule),
  ],
  controllers: [ICalConnectionController, IcalFeedController, AdminICalConnectionController],
  providers: [
    ICalConnectionService, 
    IcalService, 
    AdminICalConnectionService, 
    // Remove AuditService from here
    {
      provide: ICalConnection,
      useFactory: (icalConnectionModel: Model<ICalConnection>) => icalConnectionModel,
      inject: [getModelToken(ICalConnection.name)],
    },
  ],
  exports: [ICalConnectionService, IcalService, AdminICalConnectionService, ICalConnection],
})
export class IcalModule {}