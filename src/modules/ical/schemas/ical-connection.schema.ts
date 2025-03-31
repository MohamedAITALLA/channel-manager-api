import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { ConnectionStatus, Platform } from '../../../common/types';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class ICalConnection extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property', required: true })
  property_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(Platform) })
  platform: Platform;

  @Prop({ required: true })
  ical_url: string;

  @Prop()
  last_synced: Date;

  @Prop({ default: 60 }) // Default to 60 minutes
  sync_frequency: number;

  @Prop({ default: ConnectionStatus.ACTIVE, enum: Object.values(ConnectionStatus) })
  status: ConnectionStatus;

  @Prop()
  error_message: string;
}

export const ICalConnectionSchema = SchemaFactory.createForClass(ICalConnection);
