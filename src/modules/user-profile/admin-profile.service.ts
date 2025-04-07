import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfile } from './schemas/user-profile.schema';
import { User } from '../auth/schemas/user.schema';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UploadService } from 'src/common/services/upload.service';

@Injectable()
export class AdminProfileService {
    constructor(
        @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
        @Inject(forwardRef(() => User))
        private userModel: Model<User>,
        private readonly uploadService: UploadService,
    ) { }

    async getAllProfiles(adminId: string, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        // Get all users created by this admin
        const users = await this.userModel
            .find({ created_by: adminId, is_active: true })
            .select('_id email first_name last_name')
            .exec();

        // Fix: Cast the _id to the correct type
        const userIds = users.map(user => user._id);
        const userMap = Object.fromEntries(users.map(user => [user._id, user]));

        // Get profiles for these users
        const profiles = await this.userProfileModel
            .find({ user_id: { $in: userIds } })
            .skip(skip)
            .limit(limit)
            .exec();

        const total = await this.userProfileModel
            .countDocuments({ user_id: { $in: userIds } });

        // Enhance profiles with user information
        const enhancedProfiles = profiles.map(profile => {
            const profileObj = profile.toObject();
            const user = userMap[profileObj.user_id.toString()];

            return {
                ...profileObj,
                user_details: user ? {
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    full_name: `${user.first_name} ${user.last_name}`.trim(),
                } : null
            };
        });

        return {
            success: true,
            data: enhancedProfiles,
            message: `Retrieved ${profiles.length} user profiles successfully`,
            timestamp: new Date().toISOString(),
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                has_next_page: page < Math.ceil(total / limit),
                has_previous_page: page > 1,
                next_page: page < Math.ceil(total / limit) ? page + 1 : null,
                previous_page: page > 1 ? page - 1 : null,
                profiles_with_onboarding_completed: enhancedProfiles.filter(p => p.onboarding_completed).length,
                profiles_with_contact_info: enhancedProfiles.filter(p => Object.keys(p.contact_info || {}).length > 0).length,
            },
        };
    }

    async getProfileByUserId(adminId: string, userId: string) {
        try {
            // Check if user exists and was created by this admin
            const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

            if (!user) {
                return {
                    success: false,
                    message: 'User not found or you do not have permission to access this user',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'USER_NOT_FOUND',
                        details: 'The requested user does not exist or was not created by this admin'
                    }
                };
            }

            const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

            if (!profile) {
                return {
                    success: false,
                    message: 'User profile not found',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'PROFILE_NOT_FOUND',
                        details: 'No profile exists for this user'
                    }
                };
            }

            const profileObj = profile.toObject();

            return {
                success: true,
                data: {
                    ...profileObj,
                    user_details: {
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        full_name: `${user.first_name} ${user.last_name}`.trim(),
                    }
                },
                message: 'User profile retrieved successfully',
                timestamp: new Date().toISOString(),
                profile_status: {
                    onboarding_completed: profileObj.onboarding_completed,
                    preferences_set: Object.keys(profileObj.preferences || {}).length > 0,
                    contact_info_set: Object.keys(profileObj.contact_info || {}).length > 0,
                }
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new NotFoundException('Error retrieving user profile');
        }
    }

    async updateProfile(adminId: string, userId: string, updateProfileDto: UpdateUserProfileDto) {
        try {
            // Check if user exists and was created by this admin
            const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

            if (!user) {
                return {
                    success: false,
                    message: 'User not found or you do not have permission to update this user',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'USER_NOT_FOUND',
                        details: 'The requested user does not exist or was not created by this admin'
                    }
                };
            }

            const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

            if (!profile) {
                return {
                    success: false,
                    message: 'User profile not found',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'PROFILE_NOT_FOUND',
                        details: 'No profile exists for this user'
                    }
                };
            }

            // Track changes for detailed response
            const updatedFields: any[] = [];
            const previousValues: {preferences:any, contact_info:any, onboarding_completed:boolean} = {preferences:{}, contact_info:{}, onboarding_completed:false};

            // Update profile fields
            if (updateProfileDto.preferences) {
                // Store previous values for tracking changes
                previousValues.preferences = { ...profile.preferences };

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
                // Store previous values for tracking changes
                previousValues.contact_info = { ...profile.contact_info };

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
                previousValues.onboarding_completed = profile.onboarding_completed;
                profile.onboarding_completed = updateProfileDto.onboarding_completed;
                updatedFields.push('onboarding_completed');
            }

            const updatedProfile = await profile.save();
            const profileObj = updatedProfile.toObject();

            return {
                success: true,
                data: {
                    ...profileObj,
                    user_details: {
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        full_name: `${user.first_name} ${user.last_name}`.trim(),
                    }
                },
                message: `User profile updated successfully. Updated fields: ${updatedFields.join(', ')}`,
                timestamp: new Date().toISOString(),
                updated_by: adminId,
                updated_fields: updatedFields,
                previous_values: previousValues,
                profile_status: {
                    onboarding_completed: profileObj.onboarding_completed,
                    preferences_set: Object.keys(profileObj.preferences || {}).length > 0,
                    contact_info_set: Object.keys(profileObj.contact_info || {}).length > 0,
                }
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new NotFoundException('Error updating user profile');
        }
    }

    async resetProfile(adminId: string, userId: string) {
        try {
            // Check if user exists and was created by this admin
            const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

            if (!user) {
                return {
                    success: false,
                    message: 'User not found or you do not have permission to reset this user profile',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'USER_NOT_FOUND',
                        details: 'The requested user does not exist or was not created by this admin'
                    }
                };
            }

            const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

            if (!profile) {
                return {
                    success: false,
                    message: 'User profile not found',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'PROFILE_NOT_FOUND',
                        details: 'No profile exists for this user'
                    }
                };
            }

            // Store previous values for reference
            const previousPreferences = { ...profile.preferences };
            const previousContactInfo = { ...profile.contact_info };
            const previousOnboardingStatus = profile.onboarding_completed;

            // Reset profile to default values
            profile.preferences = {};
            profile.contact_info = {};
            profile.onboarding_completed = false;

            const resetProfile = await profile.save();
            const profileObj = resetProfile.toObject();

            return {
                success: true,
                data: {
                    ...profileObj,
                    user_details: {
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        full_name: `${user.first_name} ${user.last_name}`.trim(),
                    }
                },
                message: 'User profile reset successfully',
                timestamp: new Date().toISOString(),
                action: 'reset',
                reset_by: adminId,
                previous_state: {
                    preferences: previousPreferences,
                    contact_info: previousContactInfo,
                    onboarding_completed: previousOnboardingStatus,
                    had_preferences: Object.keys(previousPreferences || {}).length > 0,
                    had_contact_info: Object.keys(previousContactInfo || {}).length > 0,
                },
                current_state: {
                    preferences: profileObj.preferences,
                    contact_info: profileObj.contact_info,
                    onboarding_completed: profileObj.onboarding_completed,
                }
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new NotFoundException('Error resetting user profile');
        }
    }

    async uploadUserProfileImage(adminId: string, userId: string, file: Express.Multer.File) {
        try {
            // Check if user exists and was created by this admin
            const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

            if (!user) {
                return {
                    success: false,
                    message: 'User not found or you do not have permission to update this user',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'USER_NOT_FOUND',
                        details: 'The requested user does not exist or was not created by this admin'
                    }
                };
            }

            // Find the user profile
            let profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

            if (!profile) {
                // Create new profile if it doesn't exist
                profile = new this.userProfileModel({
                    user_id: userId,
                    created_by: adminId,
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
                    updated_by: adminId,
                },
                message: 'Profile image uploaded successfully by admin',
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }

            return {
                success: false,
                error: 'Failed to upload profile image',
                details: {
                    message: error.message,
                    user_id: userId,
                    admin_id: adminId,
                },
                timestamp: new Date().toISOString(),
            };
        }
    }

    async deleteUserProfileImage(adminId: string, userId: string) {
        try {
            // Check if user exists and was created by this admin
            const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

            if (!user) {
                return {
                    success: false,
                    message: 'User not found or you do not have permission to update this user',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'USER_NOT_FOUND',
                        details: 'The requested user does not exist or was not created by this admin'
                    }
                };
            }

            // Find the user profile
            const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

            if (!profile) {
                return {
                    success: false,
                    message: 'User profile not found',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'PROFILE_NOT_FOUND',
                        details: 'No profile exists for this user'
                    }
                };
            }

            // If no profile image, nothing to delete
            if (!profile.profile_image) {
                return {
                    success: false,
                    message: 'No profile image to delete',
                    timestamp: new Date().toISOString(),
                    error: {
                        code: 'NO_IMAGE',
                        details: 'User does not have a profile image'
                    }
                };
            }

            // Store previous image URL for reference
            const previousImage = profile.profile_image;

            // Delete profile image
            const deleted = this.uploadService.deleteProfileImage(profile.profile_image);

            if (await deleted) {
                // Update profile to remove image reference
                profile.profile_image = null!;
                await profile.save();

                return {
                    success: true,
                    data: {
                        user_id: userId,
                        deleted_by: adminId,
                        previous_image: previousImage,
                    },
                    message: 'Profile image deleted successfully by admin',
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
            if (error instanceof NotFoundException) {
                throw error;
            }

            return {
                success: false,
                error: 'Failed to delete profile image',
                details: {
                    message: error.message,
                    user_id: userId,
                    admin_id: adminId,
                },
                timestamp: new Date().toISOString(),
            };
        }
    }
}
