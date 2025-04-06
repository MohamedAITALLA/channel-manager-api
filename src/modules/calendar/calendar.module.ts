import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CalendarEvent.name, schema: CalendarEventSchema },
      { name: Conflict.name, schema: ConflictSchema },
    ]),
  ],
  controllers: [CalendarController, EventsController, ConflictsController, AdminCalendarEventController, AdminConflictController],
  providers: [CalendarService, ConflictDetectorService, AdminCalendarService, AdminConflictService, AuditService],
  exports: [CalendarService, ConflictDetectorService, AdminCalendarService, AdminConflictService],
})
export class CalendarModule {}
