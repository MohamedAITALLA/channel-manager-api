// src/modules/auth/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  first_name: string;

  @Prop({ required: true })
  last_name: string;

  @Prop({ default: false })
  is_admin: boolean;

  @Prop({ default: true })
  is_active: boolean;
  
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  created_by: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
