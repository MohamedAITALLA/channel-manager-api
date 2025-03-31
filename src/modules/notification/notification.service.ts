import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Injectable()
export class NotificationService {

  private settings = {
    email_notifications: true,
    new_booking_notifications: true,
    modified_booking_notifications: true,
    cancelled_booking_notifications: true,
    conflict_notifications: true,
    sync_failure_notifications: true,
  };

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
  ) {}

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const newNotification = new this.notificationModel(createNotificationDto);
    return newNotification.save();
  }

  async findAll(query: NotificationQueryDto, userId: string): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, property_id, type, severity, read } = query;
    
    // Ensure page and limit are numbers and have sensible defaults
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;
    
    // Build filter
    const filter: Record<string, any> = { user_id: userId, isFinite: true };
    
    if (property_id) {
      filter.property_id = property_id;
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (severity) {
      filter.severity = severity;
    }
    
    if (read !== undefined) {
      filter.read = read;
    }
    
    const data = await this.notificationModel
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum)
      .exec();
    
    const total = await this.notificationModel.countDocuments(filter).exec();
    
    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }
  

  async markAsRead(ids?: string[], userId?: string): Promise<{ success: boolean; count: number }> {
    // If no IDs are provided, mark all unread notifications as read
    if (!ids || ids.length === 0) {
      const result = await this.notificationModel.updateMany(
        { read: false, user_id: userId },
        { read: true }
      ).exec();
      
      return {
        success: true,
        count: result.modifiedCount,
      };
    }
    
    // Otherwise, mark only the specified notifications as read
    const result = await this.notificationModel.updateMany(
      { _id: { $in: ids }, user_id: userId },
      { read: true }
    ).exec();
    
    return {
      success: true,
      count: result.modifiedCount,
    };
  }

  async markOneAsRead(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id, user_id: userId },
      { read: true },
      { new: true }
    ).exec();
    
    if (!notification) {
      return {
        success: false,
        message: 'Notification not found',
      };
    }
    
    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  async getSettings(userId: string): Promise<any> {
    // In a real application, these settings would be stored in the database
    // and associated with the current user
    return this.settings;
  }

  async updateSettings(updateSettingsDto: UpdateNotificationSettingsDto, userId: string): Promise<any> {
    // In a real application, these settings would be stored in the database
    // and associated with the current user
    this.settings = {
      ...this.settings,
      ...updateSettingsDto,
    };
    
    return this.settings;
  }

  async remove(id: string, userId: any, preserveHistory: boolean= false): Promise<Notification> {
    if (preserveHistory) {
      const notification = await this.notificationModel
          .findOneAndUpdate({ _id: id, user_id: userId }, { is_active: false }, { new: true })
          .exec();

      if (!notification) {
          throw new NotFoundException(`Notification with ID ${id} not found`);
      }
      return notification;
  } else {
      const notification = await this.notificationModel.findOneAndDelete({ _id: id, user_id: userId }).exec();
      if (!notification) {
          throw new NotFoundException(`Notification with ID ${id} not found`);
      }
      return notification;
  }
  }
}
