// src/modules/user-profile/schemas/user-profile.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class UserProfile extends Document {
    @Prop({ required: true, unique: true })
    user_id: string;

    @Prop({ default: {}, type: Object })
    preferences: {
        theme?: string;
        language?: string;
        timezone?: string;
        date_format?: string;
        time_format?: string;
        currency?: string;
        notifications_enabled?: boolean;
    };

    @Prop({ default: {}, type: Object })
    contact_info: {
        phone?: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        postal_code?: string;
    };

    @Prop({ default: false })
    onboarding_completed: boolean;

    @Prop({ default: true })
    is_active: boolean;
    
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
    created_by: string;

    @Prop({ default: null })
    profile_image: string;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
