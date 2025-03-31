import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ICalConnection } from '../ical/schemas/ical-connection.schema';
import { CalendarEvent } from '../calendar/schemas/calendar-event.schema';
import { IcalService } from '../ical/ical.service';
import { ConflictDetectorService } from '../calendar/conflict-detector.service';
import { NotificationService } from '../notification/notification.service';
import { ConnectionStatus, NotificationType, NotificationSeverity, EventStatus, EventType } from '../../common/types';
import { SyncResult, PropertySyncResult, CalendarEventData } from './types';

@Injectable()
export class SyncService {
    constructor(
        @InjectModel(ICalConnection.name) private icalConnectionModel: Model<ICalConnection>,
        @InjectModel(CalendarEvent.name) private calendarEventModel: Model<CalendarEvent>,
        private readonly icalService: IcalService,
        private readonly conflictDetectorService: ConflictDetectorService,
        private readonly notificationService: NotificationService,
    ) { }

    @Cron(CronExpression.EVERY_HOUR)
    async handleCronSync() {
        // Find connections that need syncing based on their sync frequency
        const connections = await this.icalConnectionModel.find({
            status: ConnectionStatus.ACTIVE,
            $or: [
                { last_synced: { $exists: false } },
                {
                    $expr: {
                        $gt: [
                            { $subtract: [new Date(), '$last_synced'] },
                            { $multiply: ['$sync_frequency', 60 * 1000] } // Convert minutes to milliseconds
                        ]
                    }
                }
            ]
        }).exec();

        for (const connection of connections) {
            await this.syncConnection(connection);
        }
    }

    async syncAllProperties(userId: string): Promise<{ success: boolean; message: string; results: SyncResult[] }> {
        const connections = await this.icalConnectionModel.find({
            status: ConnectionStatus.ACTIVE,
            user_id: userId
        }).exec();

        const results: SyncResult[] = [];
        for (const connection of connections) {
            try {
                const result = await this.syncConnection(connection);
                results.push({
                    property_id: connection.property_id.toString(),
                    platform: connection.platform,
                    success: true,
                    events_synced: result.events_synced,
                });
            } catch (error) {
                results.push({
                    property_id: connection.property_id.toString(),
                    platform: connection.platform,
                    success: false,
                    error: error.message,
                });
            }
        }

        return {
            success: true,
            message: `Synced ${results.filter(r => r.success).length} of ${results.length} connections`,
            results,
        };
    }

    async syncProperty(propertyId: string, userId: string): Promise<{ success: boolean; message: string; results: PropertySyncResult[] }> {
        const connections = await this.icalConnectionModel.find({
            property_id: propertyId,
            user_id: userId,
            status: ConnectionStatus.ACTIVE,
        }).exec();

        if (connections.length === 0) {
            throw new NotFoundException(`No active iCal connections found for property ${propertyId}`);
        }

        const results: PropertySyncResult[] = [];
        for (const connection of connections) {
            try {
                const result = await this.syncConnection(connection);
                results.push({
                    platform: connection.platform,
                    success: true,
                    events_synced: result.events_synced,
                });
            } catch (error) {
                results.push({
                    platform: connection.platform,
                    success: false,
                    error: error.message,
                });

                // Update connection status
                await this.icalConnectionModel.findByIdAndUpdate(
                    connection._id,
                    {
                        status: ConnectionStatus.ERROR,
                        error_message: error.message,
                    }
                ).exec();

                // Create notification for sync failure
                await this.notificationService.createNotification({
                    user_id:connection.user_id.toString(),
                    property_id: connection.property_id.toString(), // Convert ObjectId to string
                    type: NotificationType.SYNC_FAILURE,
                    title: `Sync failed for ${connection.platform}`,
                    message: `Failed to sync calendar for ${connection.platform}: ${error.message}`,
                    severity: NotificationSeverity.WARNING,
                });
            }
        }

        // Detect conflicts after all syncs are complete
        await this.conflictDetectorService.detectAllConflictsForProperty(propertyId);

        return {
            success: true,
            message: `Synced ${results.filter(r => r.success).length} of ${results.length} connections for property ${propertyId}`,
            results,
        };
    }

    async getPropertySyncStatus(propertyId: string, userId: string): Promise<any> {
        const connections = await this.icalConnectionModel.find({
            property_id: propertyId,
            user_id: userId,
        }).exec();

        if (connections.length === 0) {
            throw new NotFoundException(`No iCal connections found for property ${propertyId}`);
        }

        const connectionStatuses = connections.map(connection => ({
            platform: connection.platform,
            status: connection.status,
            last_synced: connection.last_synced,
            error_message: connection.error_message,
        }));

        return {
            property_id: propertyId,
            connections: connectionStatuses,
            last_sync: this.getLastSyncDate(connections),
            next_sync: this.getNextSyncDate(connections),
            overall_status: this.getOverallStatus(connections),
        };
    }

    async getSyncHealthStatus(userId: string): Promise<any> {
        const allConnections = await this.icalConnectionModel.find({ user_id: userId }).exec();

        const totalConnections = allConnections.length;
        const activeConnections = allConnections.filter(c => c.status?.match(new RegExp(ConnectionStatus.ACTIVE, 'i'))).length;
        const errorConnections = allConnections.filter(c => c.status?.match(new RegExp(ConnectionStatus.ERROR, 'i'))).length;

        const propertiesWithConnections = await this.icalConnectionModel.distinct('property_id').exec();
        const propertiesWithErrors = await this.icalConnectionModel
            .distinct('property_id', { status: { $regex: new RegExp(ConnectionStatus.ERROR, 'i') } })
            .exec();

        return {
            total_connections: totalConnections,
            active_connections: activeConnections,
            error_connections: errorConnections,
            total_properties: propertiesWithConnections.length,
            properties_with_errors: propertiesWithErrors.length,
            health_percentage: totalConnections > 0
                ? Math.round((activeConnections / totalConnections) * 100)
                : 100,
            last_system_sync: await this.getLastSystemSync(),
        };
    }

    private async syncConnection(connection: ICalConnection): Promise<{ events_synced: number }> {
        try {
            // Fetch and parse iCal feed
            const events = await this.icalService.fetchAndParseICalFeed(connection.ical_url, connection.platform);

            // Get existing events for this connection
            const existingEvents = await this.calendarEventModel.find({
                connection_id: connection._id,
            }).exec();

            const existingEventMap = new Map<string, CalendarEvent>();
            existingEvents.forEach(event => {
                existingEventMap.set(event.ical_uid, event);
            });

            // Process events
            const eventsToCreate: Array<CalendarEventData & { property_id: Types.ObjectId; connection_id: Types.ObjectId }> = [];
            const eventsToUpdate: Array<{ id: Types.ObjectId; update: Partial<CalendarEventData> }> = [];
            const processedUids = new Set<string>();

            for (const eventData of events as CalendarEventData[]) {
                processedUids.add(eventData.ical_uid);

                const existingEvent = existingEventMap.get(eventData.ical_uid);

                if (!existingEvent) {
                    // New event
                    eventsToCreate.push({
                        property_id: new Types.ObjectId(connection.property_id.toString()),
                        connection_id: connection._id as Types.ObjectId,
                        ...eventData,
                    });
                } else {
                    // Check if event has changed
                    const hasChanged =
                        existingEvent.summary !== eventData.summary ||
                        existingEvent.start_date.getTime() !== eventData.start_date.getTime() ||
                        existingEvent.end_date.getTime() !== eventData.end_date.getTime() ||
                        existingEvent.status?.toUpperCase() !== eventData.status?.toUpperCase();

                    if (hasChanged) {
                        eventsToUpdate.push({
                            id: existingEvent._id as Types.ObjectId,
                            update: {
                                summary: eventData.summary,
                                start_date: eventData.start_date,
                                end_date: eventData.end_date,
                                status: eventData.status,
                                description: eventData.description,
                            }
                        });
                    }
                }
            }

            // Find events to mark as cancelled (they exist in our DB but not in the feed anymore)
            const eventsToCancel: Types.ObjectId[] = [];
            existingEvents.forEach(event => {
                if (!processedUids.has(event.ical_uid) && !event.status?.match(new RegExp(EventStatus.CANCELLED, 'i'))) {
                    eventsToCancel.push(event._id as Types.ObjectId);
                }
            });

            // Process batch operations
            if (eventsToCreate.length > 0) {
                await this.calendarEventModel.insertMany(eventsToCreate);

                // Create notifications for new bookings
                for (const event of eventsToCreate) {
                    if (event.event_type?.toUpperCase() === EventType.BOOKING.toUpperCase()) {
                        await this.notificationService.createNotification({
                            user_id:connection.user_id.toString(),
                            property_id: connection.property_id.toString(), // Convert ObjectId to string
                            type: NotificationType.NEW_BOOKING,
                            title: `New booking from ${connection.platform}`,
                            message: `New booking: ${event.summary} from ${new Date(event.start_date).toLocaleDateString()} to ${new Date(event.end_date).toLocaleDateString()}`,
                            severity: NotificationSeverity.INFO,
                        });
                    }
                }
            }

            for (const { id, update } of eventsToUpdate) {
                await this.calendarEventModel.findByIdAndUpdate(id, update).exec();

                // Create notifications for modified bookings
                await this.notificationService.createNotification({
                    user_id:connection.user_id.toString(),
                    property_id: connection.property_id.toString(), // Convert ObjectId to string
                    type: NotificationType.MODIFIED_BOOKING,
                    title: `Booking modified on ${connection.platform}`,
                    message: `Booking updated: ${update.summary || 'Untitled'} from ${update.start_date ? new Date(update.start_date).toLocaleDateString() : 'N/A'
                        } to ${update.end_date ? new Date(update.end_date).toLocaleDateString() : 'N/A'
                        }`,
                    severity: NotificationSeverity.INFO,
                });
            }

            if (eventsToCancel.length > 0) {
                await this.calendarEventModel.updateMany(
                    { _id: { $in: eventsToCancel } },
                    { status: EventStatus.CANCELLED }
                ).exec();

                // Create notifications for cancelled bookings
                await this.notificationService.createNotification({
                    user_id:connection.user_id.toString(),
                    property_id: connection.property_id.toString(), // Convert ObjectId to string
                    type: NotificationType.CANCELLED_BOOKING,
                    title: `${eventsToCancel.length} booking(s) cancelled on ${connection.platform}`,
                    message: `${eventsToCancel.length} booking(s) have been removed from the ${connection.platform} calendar`,
                    severity: NotificationSeverity.INFO,
                });
            }

            // Update connection status
            await this.icalConnectionModel.findByIdAndUpdate(
                connection._id,
                {
                    last_synced: new Date(),
                    status: ConnectionStatus.ACTIVE,
                    error_message: null,
                }
            ).exec();

            // Detect conflicts
            await this.conflictDetectorService.detectAllConflictsForProperty(connection.property_id.toString());

            return { events_synced: eventsToCreate.length + eventsToUpdate.length + eventsToCancel.length };
        } catch (error) {
            // Update connection status
            await this.icalConnectionModel.findByIdAndUpdate(
                connection._id,
                {
                    status: ConnectionStatus.ERROR,
                    error_message: error.message,
                }
            ).exec();

            throw error;
        }
    }

    private getLastSyncDate(connections: ICalConnection[]): Date | null {
        const syncDates = connections
            .filter(c => c.last_synced)
            .map(c => c.last_synced);

        return syncDates.length > 0
            ? new Date(Math.max(...syncDates.map(date => date.getTime())))
            : null;
    }

    private getNextSyncDate(connections: ICalConnection[]): Date | null {
        const nextSyncDates = connections
            .filter(c => c.last_synced && c.status?.toUpperCase() === ConnectionStatus.ACTIVE.toUpperCase())
            .map(c => {
                const nextSync = new Date(c.last_synced);
                nextSync.setMinutes(nextSync.getMinutes() + c.sync_frequency);
                return nextSync;
            });

        return nextSyncDates.length > 0
            ? new Date(Math.min(...nextSyncDates.map(date => date.getTime())))
            : null;
    }

    private getOverallStatus(connections: ICalConnection[]): string {
        if (connections.length === 0) return 'no_connections';

        const hasErrors = connections.some(c => c.status?.match(new RegExp(ConnectionStatus.ERROR, 'i')));
        if (hasErrors) return 'error';

        return 'healthy';
    }

    private async getLastSystemSync(): Promise<Date | null> {
        const latestSync = await this.icalConnectionModel
            .findOne({ last_synced: { $exists: true } })
            .sort({ last_synced: -1 })
            .exec();

        return latestSync ? latestSync.last_synced : null;
    }
}
