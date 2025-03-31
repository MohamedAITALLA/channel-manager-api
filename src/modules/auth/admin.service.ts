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

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
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

    return {
      user,
      profile,
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

    const { password: _, ...result } = savedUser.toObject();

    return result;
  }

  async updateUser(adminId: string, userId: string, updateUserDto: UpdateUserDto) {
    // Check if user exists and was created by this admin
    const user = await this.userModel.findOne({ _id: userId, created_by: adminId }).exec();

    if (!user) {
      throw new NotFoundException('User not found or you do not have permission to update this user');
    }

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
    }

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.first_name) {
      user.first_name = updateUserDto.first_name;
    }

    if (updateUserDto.last_name) {
      user.last_name = updateUserDto.last_name;
    }

    if (updateUserDto.is_active !== undefined) {
      user.is_active = updateUserDto.is_active;
    }

    const updatedUser = await user.save();

    const { password: _, ...result } = updatedUser.toObject();

    return result;
  }

  async deleteUser(adminId: string, userId: string, preserveHistory = false): Promise<User> {

    if (preserveHistory) {
      const property = await this.userModel
        .findOneAndUpdate({ _id: userId, created_by: adminId }, { is_active: false }, { new: true })
        .exec();

      if (!property) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return property;
    } else {
      const property = await this.userModel.findOneAndDelete({ _id: userId, created_by: adminId }).exec();
      if (!property) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      return property;
    }
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

    const { password: _, ...result } = user.toObject();

    return {
      ...result,
      message: 'User promoted to admin successfully',
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

    const { password: _, ...result } = user.toObject();

    return {
      ...result,
      message: 'User demoted from admin successfully',
    };
  }
}
