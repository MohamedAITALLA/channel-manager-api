import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfile } from './schemas/user-profile.schema';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UploadService } from 'src/common/services/upload.service';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
    private readonly uploadService: UploadService,
  ) { }

  async getProfile(userId: string) {
    // Try to find existing profile
    let profile = await this.userProfileModel.findOne({ user_id: userId }).exec();
    let isNewProfile = false;

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
      isNewProfile = true;
    }

    const profileObj = profile.toObject();

    return {
      success: true,
      data: profileObj,
      message: isNewProfile
        ? 'New profile created with default settings'
        : 'Profile retrieved successfully',
      timestamp: new Date().toISOString(),
      profile_status: {
        is_new: isNewProfile,
        onboarding_completed: profileObj.onboarding_completed,
        preferences_set: Object.keys(profileObj.preferences || {}).length > 0,
        contact_info_set: Object.keys(profileObj.contact_info || {}).length > 0,
      }
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateUserProfileDto) {
    const profile = await this.userProfileModel.findOne({ user_id: userId, is_active: true }).exec();
    let isNewProfile = false;
    const updatedFields: any[] = [];

    if (!profile) {
      // Create new profile with provided data
      const newProfile = new this.userProfileModel({
        user_id: userId,
        ...updateProfileDto,
      });
      const savedProfile = await newProfile.save();
      isNewProfile = true;

      // Track what fields were set
      if (updateProfileDto.preferences) updatedFields.push('preferences');
      if (updateProfileDto.contact_info) updatedFields.push('contact_info');
      if (updateProfileDto.onboarding_completed !== undefined) updatedFields.push('onboarding_completed');

      return {
        success: true,
        data: savedProfile.toObject(),
        message: 'New user profile created successfully',
        timestamp: new Date().toISOString(),
        is_new_profile: true,
        updated_fields: updatedFields,
      };
    }

    // Update existing profile
    if (updateProfileDto.preferences) {
      profile.preferences = {
        ...profile.preferences,
        ...updateProfileDto.preferences,
      };
      updatedFields.push('preferences');

      // Track specific preference changes
      Object.keys(updateProfileDto.preferences).forEach(key => {
        updatedFields.push(`preferences.${key}`);
      });
    }

    if (updateProfileDto.contact_info) {
      profile.contact_info = {
        ...profile.contact_info,
        ...updateProfileDto.contact_info,
      };
      updatedFields.push('contact_info');

      // Track specific contact info changes
      Object.keys(updateProfileDto.contact_info).forEach(key => {
        updatedFields.push(`contact_info.${key}`);
      });
    }

    if (updateProfileDto.onboarding_completed !== undefined) {
      profile.onboarding_completed = updateProfileDto.onboarding_completed;
      updatedFields.push('onboarding_completed');
    }

    const updatedProfile = await profile.save();

    return {
      success: true,
      data: updatedProfile.toObject(),
      message: `Profile updated successfully. Updated fields: ${updatedFields.join(', ')}`,
      timestamp: new Date().toISOString(),
      updated_fields: updatedFields,
      profile_status: {
        onboarding_completed: updatedProfile.onboarding_completed,
        preferences_set: Object.keys(updatedProfile.preferences || {}).length > 0,
        contact_info_set: Object.keys(updatedProfile.contact_info || {}).length > 0,
      }
    };
  }

  async resetProfile(userId: string) {
    const profile = await this.userProfileModel.findOne({ user_id: userId, is_active: true }).exec();

    if (!profile) {
      return {
        success: false,
        message: 'Profile not found',
        timestamp: new Date().toISOString(),
        error: {
          code: 'PROFILE_NOT_FOUND',
          details: `No profile exists for user with ID: ${userId}`
        }
      };
    }

    // Store previous profile data for reference
    const previousProfile = profile.toObject();

    // Delete the existing profile
    await this.userProfileModel.findOneAndDelete({ user_id: userId }).exec();

    // Create a new profile with default settings
    const newProfile = await this.getProfile(userId);

    return {
      success: true,
      data: newProfile.data,
      message: 'Profile reset to default settings successfully',
      timestamp: new Date().toISOString(),
      action: 'reset',
      previous_settings: {
        had_preferences: Object.keys(previousProfile.preferences || {}).length > 0,
        had_contact_info: Object.keys(previousProfile.contact_info || {}).length > 0,
        was_onboarded: previousProfile.onboarding_completed,
      },
      current_settings: {
        has_preferences: Object.keys(newProfile.data.preferences || {}).length > 0,
        has_contact_info: Object.keys(newProfile.data.contact_info || {}).length > 0,
        is_onboarded: newProfile.data.onboarding_completed,
      }
    };
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    try {
      // Find the user profile
      let profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

      // If profile doesn't exist, create a new one
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
      }

      // Delete old profile image if exists
      if (profile.profile_image) {
        this.uploadService.deleteProfileImage(profile.profile_image);
      }

      // Save new profile image
      const imageUrl = await this.uploadService.saveProfileImage(file, userId);

      // Update profile with new image URL
      profile.profile_image = imageUrl;
      await profile.save();

      return {
        success: true,
        data: {
          profile_image: imageUrl,
          user_id: userId,
        },
        message: 'Profile image uploaded successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to upload profile image',
        details: {
          message: error.message,
          user_id: userId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteProfileImage(userId: string) {
    try {
      // Find the user profile
      const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

      if (!profile) {
        return {
          success: false,
          error: 'Profile not found',
          timestamp: new Date().toISOString(),
        };
      }

      // If no profile image, nothing to delete
      if (!profile.profile_image) {
        return {
          success: false,
          error: 'No profile image to delete',
          timestamp: new Date().toISOString(),
        };
      }

      // Delete profile image
      const deleted = this.uploadService.deleteProfileImage(profile.profile_image);

      if (deleted) {
        // Update profile to remove image reference
        profile.profile_image = null!;
        await profile.save();

        return {
          success: true,
          message: 'Profile image deleted successfully',
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: 'Failed to delete profile image',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete profile image',
        details: {
          message: error.message,
          user_id: userId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
