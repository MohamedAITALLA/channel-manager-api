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
  ) { }

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<any> {
    try {
      const newNotification = new this.notificationModel(createNotificationDto);
      const savedNotification = await newNotification.save();

      return {
        success: true,
        data: {
          notification: savedNotification,
          meta: {
            created_at: savedNotification.created_at || new Date(),
            notification_id: savedNotification._id,
            notification_type: savedNotification.type,
          }
        },
        message: `${savedNotification.type} notification created successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create notification',
        details: {
          message: error.message,
          notification_type: createNotificationDto.type,
          property_id: createNotificationDto.property_id,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findAll(query: NotificationQueryDto, userId: string): Promise<any> {
    try {
      const { page = 1, limit = 10, property_id, type, severity, read } = query;

      // Ensure page and limit are numbers and have sensible defaults
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter: Record<string, any> = { user_id: userId, is_active: true };

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
      const totalUnread = await this.notificationModel.countDocuments({ ...filter, read: false }).exec();

      // Group notifications by type for summary
      const typeCounts = await this.notificationModel.aggregate([
        { $match: filter },
        { $group: { _id: "$type", count: { $sum: 1 } } }
      ]).exec();

      const typeCountsMap = typeCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

      return {
        success: true,
        data: {
          notifications: data.map(notification => ({
            ...notification.toObject(),
            id: notification._id,
            age_in_hours: this.calculateAgeInHours(notification.created_at),
            is_recent: this.isRecent(notification.created_at),
          })),
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum),
            has_next_page: pageNum * limitNum < total,
            has_previous_page: pageNum > 1,
          },
          summary: {
            total_count: total,
            unread_count: totalUnread,
            read_count: total - totalUnread,
            by_type: typeCountsMap,
          }
        },
        message: total > 0
          ? `Retrieved ${data.length} notifications (${totalUnread} unread)`
          : 'No notifications found matching the criteria',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch notifications',
        details: {
          message: error.message,
          query: query,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  private calculateAgeInHours(createdAt: Date): number {
    if (!createdAt) return 0;
    const now = new Date();
    const diffMs = now.getTime() - new Date(createdAt).getTime();
    return Math.round(diffMs / (1000 * 60 * 60));
  }

  private isRecent(createdAt: Date): boolean {
    return this.calculateAgeInHours(createdAt) < 24;
  }

  async markAsRead(ids?: string[], userId?: string): Promise<any> {
    try {
      // If no IDs are provided, mark all unread notifications as read
      if (!ids || ids.length === 0) {
        const result = await this.notificationModel.updateMany(
          { read: false, user_id: userId },
          { read: true }
        ).exec();

        return {
          success: true,
          data: {
            updated_count: result.modifiedCount,
            action: 'mark_all_read',
            user_id: userId,
          },
          message: result.modifiedCount > 0
            ? `Marked ${result.modifiedCount} notifications as read`
            : 'No unread notifications found',
          timestamp: new Date().toISOString(),
        };
      }

      // Otherwise, mark only the specified notifications as read
      const result = await this.notificationModel.updateMany(
        { _id: { $in: ids }, user_id: userId },
        { read: true }
      ).exec();

      return {
        success: true,
        data: {
          updated_count: result.modifiedCount,
          total_requested: ids.length,
          action: 'mark_selected_read',
          notification_ids: ids,
          user_id: userId,
        },
        message: result.modifiedCount > 0
          ? `Marked ${result.modifiedCount} out of ${ids.length} notifications as read`
          : 'No matching notifications found to mark as read',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to mark notifications as read',
        details: {
          message: error.message,
          notification_ids: ids,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async markOneAsRead(id: string, userId: string): Promise<any> {
    try {
      const notification = await this.notificationModel.findOneAndUpdate(
        { _id: id, user_id: userId },
        { read: true },
        { new: true }
      ).exec();

      if (!notification) {
        return {
          success: false,
          error: 'Notification not found',
          details: {
            notification_id: id,
            user_id: userId,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          notification: {
            ...notification.toObject(),
            id: notification._id,
          },
          action: 'mark_read',
          previous_state: { read: false },
          updated_fields: ['read'],
        },
        message: `Notification "${notification.title || notification.type}" marked as read`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to mark notification as read',
        details: {
          message: error.message,
          notification_id: id,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSettings(userId: string): Promise<any> {
    try {
      // In a real application, these settings would be stored in the database
      // and associated with the current user
      return {
        success: true,
        data: {
          settings: this.settings,
          user_id: userId,
          last_updated: new Date().toISOString(),
        },
        message: 'Notification settings retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve notification settings',
        details: {
          message: error.message,
          user_id: userId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateSettings(updateSettingsDto: UpdateNotificationSettingsDto, userId: string): Promise<any> {
    try {
      // Track which fields were updated
      const updatedFields = Object.keys(updateSettingsDto).filter(
        key => this.settings[key] !== updateSettingsDto[key]
      );

      // Store previous settings for reference
      const previousSettings = { ...this.settings };

      // In a real application, these settings would be stored in the database
      // and associated with the current user
      this.settings = {
        ...this.settings,
        ...updateSettingsDto,
      };

      return {
        success: true,
        data: {
          settings: this.settings,
          user_id: userId,
          updated_fields: updatedFields,
          previous_settings: previousSettings,
          changes_count: updatedFields.length,
        },
        message: updatedFields.length > 0
          ? `Notification settings updated successfully (${updatedFields.join(', ')})`
          : 'No changes made to notification settings',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to update notification settings',
        details: {
          message: error.message,
          user_id: userId,
          attempted_updates: updateSettingsDto,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async remove(id: string, userId: any, preserveHistory: boolean = false): Promise<any> {
    try {
      let notification;
      let action;

      if (preserveHistory) {
        notification = await this.notificationModel
          .findOneAndUpdate({ _id: id, user_id: userId }, { is_active: false }, { new: true })
          .exec();
        action = 'deactivated';
      } else {
        notification = await this.notificationModel
          .findOneAndDelete({ _id: id, user_id: userId })
          .exec();
        action = 'deleted';
      }

      if (!notification) {
        return {
          success: false,
          error: 'Notification not found',
          details: {
            notification_id: id,
            user_id: userId,
            preserve_history: preserveHistory,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          notification: {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            created_at: notification.created_at,
          },
          action: preserveHistory ? 'deactivate' : 'delete',
          preserve_history: preserveHistory,
        },
        message: `Notification ${action} successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to ${preserveHistory ? 'deactivate' : 'delete'} notification`,
        details: {
          message: error.message,
          notification_id: id,
          user_id: userId,
          preserve_history: preserveHistory,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
