import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PropertyType } from '../../../common/types';

@Schema()
export class Address {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop()
  state_province: string;

  @Prop()
  postal_code: string;

  @Prop({ required: true })
  country: string;

  @Prop({
    type: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  })
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

@Schema()
export class Amenities {
  @Prop({ default: false })
  wifi: boolean;

  @Prop({ default: false })
  kitchen: boolean;

  @Prop({ default: false })
  ac: boolean;

  @Prop({ default: false })
  heating: boolean;

  @Prop({ default: false })
  tv: boolean;

  @Prop({ default: false })
  washer: boolean;

  @Prop({ default: false })
  dryer: boolean;

  @Prop({ default: false })
  parking: boolean;

  @Prop({ default: false })
  elevator: boolean;

  @Prop({ default: false })
  pool: boolean;
}

@Schema()
export class Policies {
  @Prop({ default: '15:00' })
  check_in_time: string;

  @Prop({ default: '11:00' })
  check_out_time: string;

  @Prop({ default: 1 })
  minimum_stay: number;

  @Prop({ default: false })
  pets_allowed: boolean;

  @Prop({ default: false })
  smoking_allowed: boolean;
}

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class Property extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: Object.values(PropertyType) })
  property_type: PropertyType;

  @Prop({ type: Address, required: true })
  address: Address;

  @Prop({ required: true, min: 1 })
  accommodates: number;

  @Prop({ required: true, min: 0 })
  bedrooms: number;

  @Prop({ required: true, min: 0 })
  beds: number;

  @Prop({ required: true, min: 0 })
  bathrooms: number;

  @Prop({ type: Amenities, default: {} })
  amenities: Amenities;

  @Prop({ type: Policies, default: {} })
  policies: Policies;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: MongooseSchema.Types.ObjectId;

  @Prop({ default: true })
  is_active: boolean;

  @Prop()
  created_at: Date;

  @Prop()
  updated_at: Date;
}

export const PropertySchema = SchemaFactory.createForClass(Property);
