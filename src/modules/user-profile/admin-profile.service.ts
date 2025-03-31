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
            .find({ created_by: adminId })
            .select('_id')
            .exec();

        // Fix: Cast the _id to the correct type
        const userIds = users.map(user => user._id);

        // Get profiles for these users
        const profiles = await this.userProfileModel
            .find({ user_id: { $in: userIds } })
            .skip(skip)
            .limit(limit)
            .exec();

        const total = await this.userProfileModel
            .countDocuments({ user_id: { $in: userIds } });

        return {
            data: profiles,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }


    async getProfileByUserId(adminId: string, userId: string) {
        // Check if user exists and was created by this admin
        const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

        if (!user) {
            throw new NotFoundException('User not found or you do not have permission to access this user');
        }

        const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

        if (!profile) {
            throw new NotFoundException('User profile not found');
        }

        return profile;
    }

    async updateProfile(adminId: string, userId: string, updateProfileDto: UpdateUserProfileDto) {
        // Check if user exists and was created by this admin
        const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

        if (!user) {
            throw new NotFoundException('User not found or you do not have permission to update this user');
        }

        const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

        if (!profile) {
            throw new NotFoundException('User profile not found');
        }

        // Update profile fields
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

        const updatedProfile = await profile.save();

        return updatedProfile;
    }

    async resetProfile(adminId: string, userId: string) {
        // Check if user exists and was created by this admin
        const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

        if (!user) {
            throw new NotFoundException('User not found or you do not have permission to reset this user profile');
        }

        const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();

        if (!profile) {
            throw new NotFoundException('User profile not found');
        }

        // Reset profile to default values
        profile.preferences = {};
        profile.contact_info = {};
        profile.onboarding_completed = false;

        const resetProfile = await profile.save();

        return {
            ...resetProfile.toObject(),
            message: 'User profile reset successfully',
        };
    }
}
