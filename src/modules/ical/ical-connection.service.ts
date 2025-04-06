import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getModelToken, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICalConnection } from './schemas/ical-connection.schema';
import { CreateICalConnectionDto } from './dto/create-ical-connection.dto';
import { UpdateICalConnectionDto } from './dto/update-ical-connection.dto';
import { IcalService } from './ical.service';
import { ConnectionStatus, EventStatus, NotificationSeverity, NotificationType } from '../../common/types';
import { CalendarEvent } from '../calendar/schemas/calendar-event.schema';
import { NotificationService } from '../notification/notification.service';
import { ConflictDetectorService } from '../calendar/conflict-detector.service';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class ICalConnectionService {
  constructor(
    @InjectModel(ICalConnection.name) private icalConnectionModel: Model<ICalConnection>,
    private readonly icalService: IcalService,
    private readonly moduleRef: ModuleRef
  ) { }

  async create(
    propertyId: string,
    createICalConnectionDto: CreateICalConnectionDto,
    userId: string,
  ) {
    // Check if connection with this platform already exists for the property
    const existingConnection = await this.icalConnectionModel.findOne({
      property_id: propertyId,
      platform: createICalConnectionDto.platform,
    });

    if (existingConnection) {
      throw new BadRequestException(
        `A connection for ${createICalConnectionDto.platform} already exists for this property`,
      );
    }

    // Validate the iCal URL
    try {
      await this.icalService.validateICalUrl(createICalConnectionDto.ical_url);
    } catch (error) {
      throw new BadRequestException(`Invalid iCal URL: ${error.message}`);
    }

    const newConnection = new this.icalConnectionModel({
      property_id: propertyId,
      status: ConnectionStatus.ACTIVE, // Set initial status to active since validation passed
      ...createICalConnectionDto,
      user_id: userId
    });

    const savedConnection = await newConnection.save();

    return {
      success: true,
      data: savedConnection,
      meta: {
        property_id: propertyId,
        platform: savedConnection.platform,
        status: savedConnection.status,
        created_at: savedConnection.created_at || new Date(),
      },
      message: `Successfully created iCal connection for ${savedConnection.platform}`,
      timestamp: new Date().toISOString(),
    };
  }

  async findAllByProperty(propertyId: string) {
    const connections = await this.icalConnectionModel.find({ property_id: propertyId, is_active: true }).exec();

    // Group connections by status
    const statusCounts = connections.reduce((acc, conn) => {
      acc[conn.status] = (acc[conn.status] || 0) + 1;
      return acc;
    }, {});

    // Group connections by platform
    const platformCounts = connections.reduce((acc, conn) => {
      acc[conn.platform] = (acc[conn.platform] || 0) + 1;
      return acc;
    }, {});

    return {
      success: true,
      data: connections,
      meta: {
        property_id: propertyId,
        total: connections.length,
        status_breakdown: statusCounts,
        platform_breakdown: platformCounts,
        active_connections: connections.filter(c => c.status === ConnectionStatus.ACTIVE).length,
      },
      message: connections.length > 0
        ? `Retrieved ${connections.length} iCal connections for property ${propertyId}`
        : `No iCal connections found for property ${propertyId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async findOne(propertyId: string, connectionId: string) {
    const connection = await this.icalConnectionModel
      .findOne({
        _id: connectionId,
        property_id: propertyId,
        is_active: true
      })
      .exec();

    if (!connection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }

    // Calculate days since last sync if applicable
    let daysSinceLastSync: number | undefined;
    if (connection.last_synced) {
      const lastSyncDate = new Date(connection.last_synced);
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate.getTime() - lastSyncDate.getTime());
      daysSinceLastSync = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      success: true,
      data: connection,
      meta: {
        property_id: propertyId,
        connection_id: connectionId,
        platform: connection.platform,
        status: connection.status,
        days_since_last_sync: daysSinceLastSync,
        is_active: connection.is_active !== false, // Default to true if not specified
      },
      message: `Successfully retrieved iCal connection for ${connection.platform}`,
      timestamp: new Date().toISOString(),
    };
  }

  async update(
    propertyId: string,
    connectionId: string,
    updateICalConnectionDto: UpdateICalConnectionDto,
  ) {
    // If URL is being updated, validate it
    if (updateICalConnectionDto.ical_url) {
      try {
        await this.icalService.validateICalUrl(updateICalConnectionDto.ical_url);
        // If URL validation passes, update status to active
        updateICalConnectionDto.status = ConnectionStatus.ACTIVE;
        updateICalConnectionDto.error_message = null;
      } catch (error) {
        throw new BadRequestException(`Invalid iCal URL: ${error.message}`);
      }
    }

    const updatedConnection = await this.icalConnectionModel
      .findOneAndUpdate(
        {
          _id: connectionId,
          property_id: propertyId,
        },
        updateICalConnectionDto,
        { new: true },
      )
      .exec();

    if (!updatedConnection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }

    // Identify what fields were updated
    const updatedFields = Object.keys(updateICalConnectionDto);

    return {
      success: true,
      data: updatedConnection,
      meta: {
        property_id: propertyId,
        connection_id: connectionId,
        platform: updatedConnection.platform,
        status: updatedConnection.status,
        updated_fields: updatedFields,
        updated_at: new Date(),
      },
      message: `Successfully updated iCal connection for ${updatedConnection.platform}`,
      timestamp: new Date().toISOString(),
    };
  }

  // src/modules/ical/ical-connection.service.ts
  async remove(
    propertyId: string,
    connectionId: string,
    preserve_history: boolean = true,
    eventAction: 'delete' | 'deactivate' | 'convert' | 'keep' = 'deactivate'
  ) {
    let connection;
    let actionTaken;

    // Find the connection to ensure it exists
    const existingConnection = await this.icalConnectionModel.findOne({
      _id: connectionId,
      property_id: propertyId
    }).exec();

    if (!existingConnection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }

    // Handle the connection itself
    if (preserve_history) {
      connection = await this.icalConnectionModel
        .findOneAndUpdate(
          { _id: connectionId, property_id: propertyId },
          { 
            is_active: false,
            status: ConnectionStatus.INACTIVE,
            updated_at: new Date()
          },
          { new: true }
        )
        .exec();

      actionTaken = 'deactivated';
    } else {
      connection = await this.icalConnectionModel
        .findOneAndDelete({ _id: connectionId, property_id: propertyId })
        .exec();

      actionTaken = 'permanently deleted';
    }

    // Handle associated events
    const eventsResult = await this.handleAssociatedEvents(
      propertyId,
      connectionId,
      eventAction,
      preserve_history
    );

    // Clean up conflicts using the affected event IDs
    const conflictDetectorService = this.moduleRef.get(ConflictDetectorService, { strict: false });
    const conflictsResult = await conflictDetectorService.cleanupConflictsAfterConnectionRemoval(
      propertyId,
      connectionId,
      eventsResult.affected_event_ids || []
    );

    // Notify the user
    await this.notifyUserAboutConnectionRemoval(
      propertyId,
      connection,
      actionTaken,
      eventsResult.count,
      eventAction
    );

    // Create an audit trail entry
    await this.createAuditTrailEntry(
      propertyId,
      connection,
      actionTaken,
      eventAction,
      eventsResult.count
    );

    return {
      success: true,
      data: connection,
      meta: {
        property_id: propertyId,
        connection_id: connectionId,
        platform: connection.platform,
        preserve_history,
        action: actionTaken,
        events_action: eventAction,
        events_affected: eventsResult.count,
        conflicts_processed: conflictsResult.affected_conflicts,
      },
      message: `iCal connection for ${connection.platform} has been ${actionTaken} successfully. ${eventsResult.message}`,
      timestamp: new Date().toISOString(),
    };
  }

  // Method to create an audit trail entry
  private async createAuditTrailEntry(
    propertyId: string,
    connection: ICalConnection,
    actionTaken: string,
    eventAction: string,
    eventsAffected: number
  ): Promise<void> {
    // In a real implementation, you would save this to an audit log collection
    console.log(`AUDIT: ${new Date().toISOString()} - Connection ${connection._id} (${connection.platform}) for property ${propertyId} was ${actionTaken}. ${eventsAffected} events were ${eventAction}.`);
  }


  // Handle associated events when a connection is removed or deactivated
  private async handleAssociatedEvents(
    propertyId: string,
    connectionId: string,
    action: 'delete' | 'deactivate' | 'convert' | 'keep',
    preserveHistory: boolean
  ): Promise<{ count: number; message: string; affected_events?: any[]; affected_event_ids?: any[] }> {
    // Inject CalendarEvent model
    const calendarEventModel = this.moduleRef.get(getModelToken(CalendarEvent.name), { strict: false });

    // Find all events associated with this connection
    const query = {
      property_id: propertyId,
      connection_id: connectionId,
      is_active: true
    };

    // Get the actual events for more detailed processing
    const events = await calendarEventModel.find(query).exec();
    const eventsCount = events.length;

    if (eventsCount === 0) {
      return { count: 0, message: 'No events were associated with this connection.' };
    }

    // Store affected event IDs for conflict detection
    const affectedEventIds = events.map(event => event._id);
    const affectedEvents = events.map(event => ({
      id: event._id,
      summary: event.summary,
      start_date: event.start_date,
      end_date: event.end_date,
      status: event.status
    }));

    switch (action) {
      case 'delete':
        if (preserveHistory) {
          // Soft delete - mark as inactive and update status to cancelled
          await calendarEventModel.updateMany(
            query,
            { 
              is_active: false, 
              status: EventStatus.CANCELLED,
              updated_at: new Date() 
            }
          ).exec();
          return {
            count: eventsCount,
            message: `${eventsCount} associated events have been deactivated and marked as cancelled.`,
            affected_events: affectedEvents,
            affected_event_ids: affectedEventIds
          };
        } else {
          // Hard delete
          await calendarEventModel.deleteMany(query).exec();
          return {
            count: eventsCount,
            message: `${eventsCount} associated events have been permanently deleted.`,
            affected_events: affectedEvents,
            affected_event_ids: affectedEventIds
          };
        }

      case 'deactivate':
        // Mark as inactive and update status to cancelled
        await calendarEventModel.updateMany(
          query,
          { 
            is_active: false, 
            status: EventStatus.CANCELLED,
            updated_at: new Date() 
          }
        ).exec();
        return {
          count: eventsCount,
          message: `${eventsCount} associated events have been deactivated and marked as cancelled.`,
          affected_events: affectedEvents,
          affected_event_ids: affectedEventIds
        };

      case 'convert':
        // Convert to manual events by removing connection_id and setting platform to 'manual'
        await calendarEventModel.updateMany(
          query,
          {
            connection_id: null,
            platform: 'manual',
            updated_at: new Date(),
            ical_uid: null // Remove the ical_uid to prevent conflicts with future syncs
          }
        ).exec();
        return {
          count: eventsCount,
          message: `${eventsCount} associated events have been converted to manual events.`,
          affected_events: affectedEvents,
          affected_event_ids: affectedEventIds
        };

      case 'keep':
      default:
        // Do nothing to the events
        return {
          count: eventsCount,
          message: `${eventsCount} associated events remain unchanged. These events may become stale without their connection.`,
          affected_events: affectedEvents,
          affected_event_ids: affectedEventIds
        };
    }
  }


  async testConnection(propertyId: string, connectionId: string) {
    const connectionResult = await this.findOne(propertyId, connectionId);
    const connection = connectionResult.data;

    try {
      await this.icalService.validateICalUrl(connection.ical_url);

      // Update connection status
      const updatedConnection = await this.icalConnectionModel
        .findOneAndUpdate(
          { _id: connectionId },
          {
            status: ConnectionStatus.ACTIVE,
            error_message: null,
            last_sync_at: new Date()
          },
          { new: true }
        )
        .exec();

      return {
        success: true,
        data: {
          valid: true,
          connection: updatedConnection
        },
        meta: {
          property_id: propertyId,
          connection_id: connectionId,
          platform: connection.platform,
          status: ConnectionStatus.ACTIVE,
          tested_at: new Date(),
        },
        message: `iCal connection for ${connection.platform} is valid and accessible`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Update connection status
      const updatedConnection = await this.icalConnectionModel
        .findOneAndUpdate(
          { _id: connectionId },
          {
            status: ConnectionStatus.ERROR,
            error_message: error.message,
            last_sync_at: new Date()
          },
          { new: true }
        )
        .exec();

      return {
        success: false,
        data: {
          valid: false,
          connection: updatedConnection,
          error: error.message
        },
        meta: {
          property_id: propertyId,
          connection_id: connectionId,
          platform: connection.platform,
          status: ConnectionStatus.ERROR,
          tested_at: new Date(),
        },
        message: `Error validating iCal connection for ${connection.platform}: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // src/modules/ical/ical-connection.service.ts

  private async notifyUserAboutConnectionRemoval(
    propertyId: string,
    connection: ICalConnection,
    actionTaken: string,
    eventsAffected: number,
    eventAction: string
  ): Promise<void> {
    try {
      // Inject the notification service
      const notificationService = this.moduleRef.get(NotificationService, { strict: false });

      // Create a notification about the connection removal
      await notificationService.createNotification({
        property_id: propertyId,
        user_id: connection.user_id.toString(),
        type: NotificationType.ICAL_REMOVED,
        title: `iCal Connection ${actionTaken}`,
        message: `Your ${connection.platform} calendar connection has been ${actionTaken}. ${eventsAffected} events were ${eventAction}. This may affect your property's availability.`,
        severity: NotificationSeverity.WARNING
      });
    } catch (error) {
      console.error(`Failed to create notification: ${error.message}`);
      // Don't throw the error - this is a non-critical operation
    }
  }

}
