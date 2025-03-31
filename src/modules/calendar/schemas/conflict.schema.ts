import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ConflictType, ConflictSeverity, ConflictStatus } from '../../../common/types';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Conflict extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property', required: true })
  property_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'CalendarEvent', required: true })
  event_ids: MongooseSchema.Types.ObjectId[];

  @Prop({ required: true, enum: Object.values(ConflictType) })
  conflict_type: ConflictType;

  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  @Prop({ required: true, enum: Object.values(ConflictSeverity) })
  severity: ConflictSeverity;

  @Prop({ required: true, enum: Object.values(ConflictStatus), default: ConflictStatus.NEW })
  status: ConflictStatus;

  @Prop()
  description: string;

  
  @Prop({ default: true })
  is_active: boolean;
}

export const ConflictSchema = SchemaFactory.createForClass(Conflict);

// Create index for efficient property-based queries
ConflictSchema.index({ property_id: 1, status: 1 });
