import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfile } from './schemas/user-profile.schema';
import { User } from '../auth/schemas/user.schema';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class AdminProfileService {
    constructor(
        @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
        @InjectModel(User.name) private userModel: Model<User>,
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
}
