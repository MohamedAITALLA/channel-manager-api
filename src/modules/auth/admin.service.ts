// src/modules/auth/admin.service.ts
import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from './schemas/user.schema';
import { UserProfile } from '../user-profile/schemas/user-profile.schema';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
  ) { }

  async getAllUsers(adminId: string, page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    // Build query
    let query = this.userModel.find({ created_by: adminId, is_active: true });

    // Add search functionality
    if (search) {
      query = query.or([
        { email: { $regex: search, $options: 'i' } },
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
      ]);
    }

    // Execute query with pagination
    const users = await query
      .skip(skip)
      .limit(limit)
      .select('-password')
      .exec();

    const total = await this.userModel.countDocuments(query.getFilter());
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: users.map(user => {
        const userObj = user.toObject();
        return {
          ...userObj,
          full_name: `${userObj.first_name} ${userObj.last_name}`,
        };
      }),
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: users.length > 0
        ? `Successfully retrieved ${users.length} users`
        : 'No users found matching the criteria',
    };
  }

  async getUserById(adminId: string, userId: string) {
    const user = await this.userModel
      .findOne({ _id: userId, created_by: adminId })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found or you do not have permission to access this user');
    }

    // Get user profile
    const profile = await this.userProfileModel.findOne({ user_id: userId }).exec();
    const userObj = user.toObject();

    return {
      success: true,
      data: {
        user: {
          ...userObj,
          full_name: `${userObj.first_name} ${userObj.last_name}`,
        },
        profile: profile ? profile.toObject() : null,
      },
      message: 'User details retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  async createUser(adminId: string, createUserDto: RegisterDto) {
    const { email, password, first_name, last_name } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email }).exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with admin as creator
    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      first_name,
      last_name,
      created_by: adminId,
    });

    const savedUser = await newUser.save();

    // Create user profile
    const newUserProfile = new this.userProfileModel({
      user_id: savedUser._id,
      created_by: adminId,
    });

    await newUserProfile.save();

    const userObj = savedUser.toObject();
    const { password: _, ...userData } = userObj;

    return {
      success: true,
      data: {
        ...userData,
        full_name: `${userData.first_name} ${userData.last_name}`,
        profile_id: newUserProfile._id,
      },
      message: 'User created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  async updateUser(adminId: string, userId: string, updateUserDto: UpdateUserDto) {
    // Check if user exists and was created by this admin
    const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

    if (!user) {
      throw new NotFoundException('User not found or you do not have permission to update this user');
    }

    // Keep track of what was updated
    const updatedFields: string[] = [];

    // Update user fields
    if (updateUserDto.email) {
      // Check if email is already in use by another user
      const existingUser = await this.userModel.findOne({
        email: updateUserDto.email,
        _id: { $ne: userId }
      }).exec();

      if (existingUser) {
        throw new ConflictException('Email already in use');
      }

      user.email = updateUserDto.email;
      updatedFields.push('email');
    }

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
      updatedFields.push('password');
    }

    if (updateUserDto.first_name) {
      user.first_name = updateUserDto.first_name;
      updatedFields.push('first_name');
    }

    if (updateUserDto.last_name) {
      user.last_name = updateUserDto.last_name;
      updatedFields.push('last_name');
    }

    // Handle is_active with type safety
    if (updateUserDto.is_active !== undefined) {
      // Using type assertion to handle potential type mismatch
      (user as any).is_active = updateUserDto.is_active;
      updatedFields.push('is_active');
    }

    const updatedUser = await user.save();
    const userObj = updatedUser.toObject();
    const { password: _, ...userData } = userObj;

    return {
      success: true,
      data: {
        ...userData,
        full_name: `${userData.first_name} ${userData.last_name}`,
      },
      message: `User updated successfully. Updated fields: ${updatedFields.join(', ')}`,
      timestamp: new Date().toISOString(),
      updated_fields: updatedFields,
    };
  }

  async deleteUser(adminId: string, userId: string, preserveHistory = false) {
    let result;
    let actionTaken;

    if (preserveHistory) {
      // Using type-safe update approach
      const updateQuery = { is_active: false } as any;

      const user = await this.userModel
        .findOneAndUpdate(
          { _id: userId, created_by: adminId },
          updateQuery,
          { new: true }
        )
        .exec();

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      result = user;
      actionTaken = 'deactivated';
    } else {
      const user = await this.userModel.findOneAndDelete({ _id: userId, created_by: adminId }).exec();

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      result = user;
      actionTaken = 'permanently deleted';
    }

    const userObj = result.toObject();
    const { password: _, ...userData } = userObj;

    return {
      success: true,
      data: {
        ...userData,
        full_name: `${userData.first_name} ${userData.last_name}`,
      },
      message: `User has been ${actionTaken} successfully`,
      timestamp: new Date().toISOString(),
      action: actionTaken,
      preserveHistory,
    };
  }

  async promoteToAdmin(adminId: string, userId: string) {
    // Check if user exists and was created by this admin
    const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

    if (!user) {
      throw new NotFoundException('User not found or you do not have permission to promote this user');
    }

    if (user.is_admin) {
      throw new ConflictException('User is already an admin');
    }

    user.is_admin = true;
    await user.save();

    const userObj = user.toObject();
    const { password: _, ...userData } = userObj;

    return {
      success: true,
      data: {
        ...userData,
        full_name: `${userData.first_name} ${userData.last_name}`,
        role: 'admin',
      },
      message: 'User promoted to admin successfully',
      timestamp: new Date().toISOString(),
      action: 'promotion',
      previous_role: 'user',
      new_role: 'admin',
    };
  }

  async demoteFromAdmin(adminId: string, userId: string) {
    // Check if user exists and was created by this admin
    const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

    if (!user) {
      throw new NotFoundException('User not found or you do not have permission to demote this user');
    }

    if (!user.is_admin) {
      throw new ConflictException('User is not an admin');
    }

    user.is_admin = false;
    await user.save();

    const userObj = user.toObject();
    const { password: _, ...userData } = userObj;

    return {
      success: true,
      data: {
        ...userData,
        full_name: `${userData.first_name} ${userData.last_name}`,
        role: 'user',
      },
      message: 'User demoted from admin successfully',
      timestamp: new Date().toISOString(),
      action: 'demotion',
      previous_role: 'admin',
      new_role: 'user',
    };
  }
}
