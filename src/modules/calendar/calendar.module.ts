import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CalendarController, EventsController, ConflictsController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { ConflictDetectorService } from './conflict-detector.service';
import { CalendarEvent, CalendarEventSchema } from './schemas/calendar-event.schema';
import { Conflict, ConflictSchema } from './schemas/conflict.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CalendarEvent.name, schema: CalendarEventSchema },
      { name: Conflict.name, schema: ConflictSchema },
    ]),
  ],
  controllers: [CalendarController, EventsController, ConflictsController],
  providers: [CalendarService, ConflictDetectorService],
  exports: [CalendarService, ConflictDetectorService],
})
export class CalendarModule {}
