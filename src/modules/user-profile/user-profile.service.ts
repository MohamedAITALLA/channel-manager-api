import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfile } from './schemas/user-profile.schema';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    // Try to find existing profile
    let profile = await this.userProfileModel.findOne({ user_id: userId }).exec();
    
    // If profile doesn't exist, create a new one with default values
    if (!profile) {
      profile = new this.userProfileModel({
        user_id: userId,
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
          date_format: 'MM/DD/YYYY',
          time_format: '12h',
          currency: 'USD',
          notifications_enabled: true,
        },
        contact_info: {},
        onboarding_completed: false,
      });
      await profile.save();
    }
    
    return profile;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateUserProfileDto): Promise<UserProfile> {
    const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();
    
    if (!profile) {
      // Create new profile with provided data
      const newProfile = new this.userProfileModel({
        user_id: userId,
        ...updateProfileDto,
      });
      return newProfile.save();
    }
    
    // Update existing profile
    if (updateProfileDto.preferences) {
      profile.preferences = {
        ...profile.preferences,
        ...updateProfileDto.preferences,
      };
    }
    
    if (updateProfileDto.contact_info) {
      profile.contact_info = {
        ...profile.contact_info,
        ...updateProfileDto.contact_info,
      };
    }
    
    if (updateProfileDto.onboarding_completed !== undefined) {
      profile.onboarding_completed = updateProfileDto.onboarding_completed;
    }
    
    return profile.save();
  }

  async resetProfile(userId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.userProfileModel.findOneAndDelete({ user_id: userId }).exec();
    
    if (!result) {
      return {
        success: false,
        message: 'Profile not found',
      };
    }
    
    // Create a new profile with default settings
    await this.getProfile(userId);
    
    return {
      success: true,
      message: 'Profile reset to default settings',
    };
  }
}