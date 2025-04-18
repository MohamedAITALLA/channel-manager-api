import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { NotificationType, NotificationSeverity } from '../../../common/types';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Notification extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property' })
  property_id: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: Object.values(NotificationType) })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, enum: Object.values(NotificationSeverity) })
  severity: NotificationSeverity;

  @Prop({ default: false })
  read: boolean;

  @Prop({ default: true })
  is_active: boolean;

  @Prop()
  created_at: Date;

  @Prop()
  updated_at: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Create index for efficient queries
NotificationSchema.index({ read: 1, created_at: -1 });
NotificationSchema.index({ property_id: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, created_at: -1 });
