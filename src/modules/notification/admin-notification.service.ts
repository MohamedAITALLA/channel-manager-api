// src/modules/notification/admin-notification.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './schemas/notification.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminNotificationService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    private readonly auditService: AuditService,
  ) {}

  async getAllNotifications(
    page: number = 1,
    limit: number = 10,
    userId?: string,
    propertyId?: string,
    type?: string,
    read?: boolean,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (userId) query.user_id = userId;
    if (propertyId) query.property_id = propertyId;
    if (type) query.type = type;
    if (read !== undefined) query.read = read;

    const notifications = await this.notificationModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 })
      .exec();

    const total = await this.notificationModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: notifications,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: notifications.length > 0
        ? `Successfully retrieved ${notifications.length} notifications`
        : 'No notifications found matching the criteria',
    };
  }

  async getNotificationById(notificationId: string) {
    const notification = await this.notificationModel.findById(notificationId).exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return {
      success: true,
      data: notification,
      message: 'Notification retrieved successfully',
    };
  }

  async updateNotification(notificationId: string, updateNotificationDto: any, adminId: string) {
    const notification = await this.notificationModel.findById(notificationId).exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: 'UPDATE',
      entity_type: 'Notification',
      entity_id: notificationId,
      user_id: adminId,
      property_id: notification.property_id?.toString(),
      details: {
        before: notification.toObject(),
        changes: updateNotificationDto,
      },
    });

    const updatedNotification = await this.notificationModel
      .findByIdAndUpdate(notificationId, updateNotificationDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedNotification,
      message: 'Notification updated successfully',
    };
  }

  async deleteNotification(notificationId: string, adminId: string) {
    const notification = await this.notificationModel.findById(notificationId).exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Create audit entry before deletion
    await this.auditService.createAuditEntry({
      action: 'DELETE',
      entity_type: 'Notification',
      entity_id: notificationId,
      user_id: adminId,
      property_id: notification.property_id?.toString(),
      details: {
        deleted_notification: notification.toObject(),
      },
    });

    await this.notificationModel.findByIdAndDelete(notificationId).exec();

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }

  async setNotificationActiveStatus(notificationId: string, isActive: boolean, adminId: string) {
    const notification = await this.notificationModel.findById(notificationId).exec();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity_type: 'Notification',
      entity_id: notificationId,
      user_id: adminId,
      property_id: notification.property_id?.toString(),
      details: {
        before: { is_active: notification.is_active },
        after: { is_active: isActive },
      },
    });

    const updatedNotification = await this.notificationModel
      .findByIdAndUpdate(notificationId, { is_active: isActive }, { new: true })
      .exec();

    return {
      success: true,
      data: updatedNotification,
      message: `Notification ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}