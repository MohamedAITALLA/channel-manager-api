// src/modules/audit/schemas/audit-entry.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at' } })
export class AuditEntry extends Document {
  @Prop({ required: true })
  action: string;
  
  @Prop({ required: true })
  entity_type: string;
  
  @Prop({ required: true })
  entity_id: string;
  
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: MongooseSchema.Types.ObjectId;
  
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property' })
  property_id: MongooseSchema.Types.ObjectId;
  
  @Prop({ type: Object })
  details: Record<string, any>;
  
  @Prop()
  created_at: Date;
}

export const AuditEntrySchema = SchemaFactory.createForClass(AuditEntry);
