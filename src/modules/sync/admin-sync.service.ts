// src/modules/sync/admin-sync.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICalConnection } from '../ical/schemas/ical-connection.schema';
import { CalendarEvent } from '../calendar/schemas/calendar-event.schema';
import { SyncService } from './sync.service';
import { AuditService } from '../audit/audit.service';
import { ConnectionStatus } from '../../common/types';
import { SyncResult, PropertySyncResult } from './types';

@Injectable()
export class AdminSyncService {
  constructor(
    @InjectModel(ICalConnection.name) private icalConnectionModel: Model<ICalConnection>,
    @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
    private readonly syncService: SyncService,
    private readonly auditService: AuditService,
  ) {}

  async getAllSyncConnections(
    page: number = 1,
    limit: number = 10,
    propertyId?: string,
    platform?: string,
    status?: ConnectionStatus,
    userId?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (propertyId) query.property_id = propertyId;
    if (platform) query.platform = platform;
    if (status) query.status = status;
    if (userId) {
      // Find properties belonging to this user
      const properties = await this.icalConnectionModel.find({ user_id: userId }).distinct('property_id').exec();
      query.property_id = { $in: properties };
    }

    const connections = await this.icalConnectionModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ last_synced: -1 })
      .exec();

    const total = await this.icalConnectionModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: connections,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: connections.length > 0
        ? `Successfully retrieved ${connections.length} sync connections`
        : 'No sync connections found matching the criteria',
    };
  }

  async getSyncConnectionById(connectionId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('Sync connection not found');
    }

    return {
      success: true,
      data: connection,
      message: 'Sync connection retrieved successfully',
    };
  }

  async updateSyncConnection(connectionId: string, updateConnectionDto: any, adminId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('Sync connection not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: 'UPDATE',
      entity_type: 'ICalConnection',
      entity_id: connectionId,
      user_id: adminId,
      property_id: connection.property_id.toString(),
      details: {
        before: connection.toObject(),
        changes: updateConnectionDto,
      },
    });

    const updatedConnection = await this.icalConnectionModel
      .findByIdAndUpdate(connectionId, updateConnectionDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedConnection,
      message: 'Sync connection updated successfully',
    };
  }

  async deleteSyncConnection(connectionId: string, adminId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('Sync connection not found');
    }

    // Create audit entry before deletion
    await this.auditService.createAuditEntry({
      action: 'DELETE',
      entity_type: 'ICalConnection',
      entity_id: connectionId,
      user_id: adminId,
      property_id: connection.property_id.toString(),
      details: {
        deleted_connection: connection.toObject(),
      },
    });

    await this.icalConnectionModel.findByIdAndDelete(connectionId).exec();

    return {
      success: true,
      message: 'Sync connection deleted successfully',
    };
  }

  async triggerSystemWideSync(adminId: string) {
    try {
      // Get all active connections
      const connections = await this.icalConnectionModel.find({
        status: ConnectionStatus.ACTIVE,
        is_active: true,
      }).exec();

      const results = {
        connections_processed: 0,
        successful_syncs: 0,
        failed_syncs: 0,
        total_events_synced: 0,
        errors: [],
      };

      // Create audit entry for this system-wide sync
      await this.auditService.createAuditEntry({
        action: 'SYSTEM_SYNC',
        entity_type: 'System',
        entity_id: 'all',
        user_id: adminId,
        details: {
          total_connections: connections.length,
          timestamp: new Date(),
        },
      });

      // Use the existing sync service to process each connection
      for (const connection of connections) {
        try {
          results.connections_processed++;
          // Use the sync service's method to sync a single connection
          const syncResult = await this.syncService.syncConnection(connection);
          results.successful_syncs++;
          results.total_events_synced += syncResult.events_synced || 0;
        } catch (error) {
          results.failed_syncs++;
          results.errors.push({
            property_id: connection.property_id.toString(),
            platform: connection.platform,
            error: error.message,
          } as never);
        }
      }

      return {
        success: true,
        data: results,
        message: `System-wide sync completed: ${results.successful_syncs}/${results.connections_processed} connections synced successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to trigger system-wide sync',
        details: {
          message: error.message,
        },
      };
    }
  }

  async getSyncStatistics() {
    try {
      // Get total connections
      const totalConnections = await this.icalConnectionModel.countDocuments().exec();
      
      // Get active connections
      const activeConnections = await this.icalConnectionModel.countDocuments({
        status: ConnectionStatus.ACTIVE,
        is_active: true,
      }).exec();
      
      // Get connections by status
      const connectionsByStatus = await this.icalConnectionModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec();
      
      // Get connections by platform
      const connectionsByPlatform = await this.icalConnectionModel.aggregate([
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec();
      
      // Get sync frequency distribution
      const syncFrequencyDistribution = await this.icalConnectionModel.aggregate([
        { $group: { _id: "$sync_frequency", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).exec();
      
      // Get recent syncs (last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const recentSyncs = await this.icalConnectionModel.countDocuments({
        last_synced: { $gte: oneDayAgo },
      }).exec();
      
      // Get connections that haven't synced in over a week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const staleSyncs = await this.icalConnectionModel.countDocuments({
        $or: [
          { last_synced: { $lt: oneWeekAgo } },
          { last_synced: { $exists: false } },
        ],
        status: ConnectionStatus.ACTIVE,
        is_active: true,
      }).exec();
      
      return {
        success: true,
        data: {
          total_connections: totalConnections,
          active_connections: activeConnections,
          inactive_connections: totalConnections - activeConnections,
          connections_by_status: connectionsByStatus,
          connections_by_platform: connectionsByPlatform,
          sync_frequency_distribution: syncFrequencyDistribution,
          recent_syncs: recentSyncs,
          stale_syncs: staleSyncs,
        },
        message: 'Sync statistics retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve sync statistics',
        details: {
          message: error.message,
        },
      };
    }
  }
}