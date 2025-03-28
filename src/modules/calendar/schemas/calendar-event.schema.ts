import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { EventType, EventStatus, Platform } from '../../../common/types';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class CalendarEvent extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property', required: true })
  property_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(Platform) })
  platform: Platform;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ICalConnection' })
  connection_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  ical_uid: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  @Prop({ required: true, enum: Object.values(EventType) })
  event_type: EventType;

  @Prop({ required: true, enum: Object.values(EventStatus), default: EventStatus.CONFIRMED })
  status: EventStatus;

  @Prop()
  description: string;
}

export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);

// Create compound index for property_id and ical_uid to ensure uniqueness
CalendarEventSchema.index({ property_id: 1, ical_uid: 1 }, { unique: true });

// Create index for efficient date range queries
CalendarEventSchema.index({ property_id: 1, start_date: 1, end_date: 1 });
