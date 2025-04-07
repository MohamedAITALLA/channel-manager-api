import { Module, forwardRef } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { CalendarController, EventsController, ConflictsController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { ConflictDetectorService } from './conflict-detector.service';
import { AdminCalendarEventController } from './admin-calendar-event.controller';
import { AdminCalendarService } from './admin-calendar.service';
import { CalendarEvent, CalendarEventSchema } from './schemas/calendar-event.schema';
import { Conflict, ConflictSchema } from './schemas/conflict.schema';
import { AuditService } from '../audit/audit.service';
import { AdminConflictController } from './admin-conflict.controller';
import { AdminConflictService } from './admin-conflict.service';
import { IcalModule } from '../ical/ical.module';
import {Model} from 'mongoose';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CalendarEvent.name, schema: CalendarEventSchema },
      { name: Conflict.name, schema: ConflictSchema },
    ]),
    // Use forwardRef to handle circular dependency with IcalModule
    forwardRef(() => IcalModule),
    forwardRef(() => AuditModule), 
    forwardRef(() => AuthModule),// This is correct
  ],
  controllers: [CalendarController, EventsController, ConflictsController, AdminCalendarEventController, AdminConflictController],
  providers: [
    CalendarService, 
    ConflictDetectorService, 
    AdminCalendarService, 
    AdminConflictService,
    // REMOVE THIS PROVIDER - it's causing the issue:
    // {
    //   provide: AuditService,
    //   useFactory: (auditService) => auditService,
    //   inject: [AuditService],
    // },
    {
      provide: CalendarEvent,
      useFactory: (calendarEventModel: Model<CalendarEvent>) => calendarEventModel,
      inject: [getModelToken(CalendarEvent.name)],
    },
    {
      provide: Conflict,
      useFactory: (conflictModel: Model<Conflict>) => conflictModel,
      inject: [getModelToken(Conflict.name)],
    }
  ],
  exports: [CalendarService, ConflictDetectorService, AdminCalendarService, AdminConflictService, CalendarEvent, Conflict],
})
export class CalendarModule {}