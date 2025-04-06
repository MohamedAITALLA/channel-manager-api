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

    /**
     * Common method to handle cron sync jobs with different time intervals
     * @param intervalMinutes The interval in minutes for this sync job
     * @returns Results of the sync operation
     */
    private async handleCronSyncCommon(intervalMinutes: number) {
        try {
            // Find connections that need syncing based on their sync frequency
            const connections = await this.icalConnectionModel.find({
                status: ConnectionStatus.ACTIVE,
                is_active: true,
                $or: [
                    { last_synced: { $exists: false } },
                    {
                        $expr: {
                            $gt: [
                                { $subtract: [new Date(), '$last_synced'] },
                                { $multiply: ['$sync_frequency', intervalMinutes * 60 * 1000] } // Convert minutes to milliseconds
                            ]
                        }
                    }
                ]
            }).exec();

            const results = {
                connections_processed: 0,
                successful_syncs: 0,
                failed_syncs: 0,
                total_events_synced: 0,
                errors: []
            };

            // Process connections in batches to avoid overwhelming the system
            const BATCH_SIZE = 10;
            for (let i = 0; i < connections.length; i += BATCH_SIZE) {
                const batch = connections.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (connection) => {
                    try {
                        results.connections_processed++;
                        const syncResult = await this.syncConnection(connection);
                        results.successful_syncs++;
                        results.total_events_synced += syncResult.events_synced!;
                        return { success: true, connection };
                    } catch (error) {
                        results.failed_syncs++;
                        results.errors.push({
                            property_id: connection.property_id.toString(),
                            platform: connection.platform,
                            error: error.message
                        } as never);
                        return { success: false, connection, error };
                    }
                });

                await Promise.all(batchPromises);
            }

            console.log(`Cron sync (${intervalMinutes}min) completed: ${results.successful_syncs}/${results.connections_processed} connections synced successfully`);
            return results;
        } catch (error) {
            console.error(`Error in ${intervalMinutes}min cron sync job:`, error);
            throw error;
        }
    }

    @Cron(CronExpression.EVERY_QUARTER)
    async handleCronSync15Min() {
        return this.handleCronSyncCommon(15);
    }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async handleCronSync30Min() {
        return this.handleCronSyncCommon(30);
    }

    @Cron('0 */45 * * * *')
    async handleCronSync45Min() {
        return this.handleCronSyncCommon(45);
    }

    @Cron(CronExpression.EVERY_HOUR)
    async handleCronSyncHour() {
        return this.handleCronSyncCommon(60);
    }



    async syncAllProperties(userId: string): Promise<any> {
        try {
            const connections = await this.icalConnectionModel.find({
                status: ConnectionStatus.ACTIVE, is_active: true,
                user_id: userId
            }).exec();

            if (connections.length === 0) {
                return {
                    success: false,
                    error: 'No active connections found',
                    details: {
                        user_id: userId
                    },
                    timestamp: new Date().toISOString()
                };
            }

            const results: SyncResult[] = [];
            let totalEventsSynced = 0;
            let propertiesSynced = new Set();

            for (const connection of connections) {
                try {
                    const result = await this.syncConnection(connection);
                    results.push({
                        property_id: connection.property_id.toString(),
                        platform: connection.platform,
                        success: true,
                        events_synced: result.events_synced,
                        last_synced: new Date(),
                        sync_duration_ms: result.sync_duration_ms
                    });
                    totalEventsSynced += result.events_synced!;
                    propertiesSynced.add(connection.property_id.toString());
                } catch (error) {
                    results.push({
                        property_id: connection.property_id.toString(),
                        platform: connection.platform,
                        success: false,
                        error: error.message,
                        last_synced: connection.last_synced || null
                    });
                }
            }

            // Group results by property for better organization
            const resultsByProperty: Record<string, any[]> = {};
            results.forEach(result => {
                const propertyIdStr = result.property_id.toString();
                if (!resultsByProperty[propertyIdStr]) {
                    resultsByProperty[propertyIdStr] = [];
                }
                resultsByProperty[propertyIdStr].push(result);
            });


            return {
                success: true,
                data: {
                    sync_results: resultsByProperty,
                    summary: {
                        total_connections: connections.length,
                        successful_syncs: results.filter(r => r.success).length,
                        failed_syncs: results.filter(r => !r.success).length,
                        total_events_synced: totalEventsSynced,
                        properties_synced: propertiesSynced.size,
                        sync_completion_time: new Date()
                    }
                },
                message: `Synced ${results.filter(r => r.success).length} of ${results.length} connections across ${propertiesSynced.size} properties`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to sync properties',
                details: {
                    message: error.message,
                    user_id: userId
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    async syncProperty(propertyId: string, userId: string): Promise<any> {
        try {
            const connections = await this.icalConnectionModel.find({
                property_id: propertyId,
                user_id: userId,
                status: ConnectionStatus.ACTIVE,
                is_active: true
            }).exec();

            if (connections.length === 0) {
                return {
                    success: false,
                    error: 'No active iCal connections found',
                    details: {
                        property_id: propertyId,
                        user_id: userId
                    },
                    timestamp: new Date().toISOString()
                };
            }

            const results: PropertySyncResult[] = [];
            let totalEventsSynced = 0;
            let totalNewEvents = 0;
            let totalUpdatedEvents = 0;
            let totalCancelledEvents = 0;

            for (const connection of connections) {
                try {

                    const result = await this.syncConnection(connection);

                    results.push({
                        platform: connection.platform,
                        success: true,
                        events_synced: result.events_synced,
                        events_created: result.events_created,
                        events_updated: result.events_updated,
                        events_cancelled: result.events_cancelled,
                        sync_duration_ms: result.sync_duration_ms,
                        conflicts: result.conflicts,
                        last_synced: new Date()
                    });

                    totalEventsSynced += result.events_synced!;
                    totalNewEvents += result.events_created!;
                    totalUpdatedEvents += result.events_updated!;
                    totalCancelledEvents += result.events_cancelled!;
                } catch (error) {
                    results.push({
                        platform: connection.platform,
                        success: false,
                        error: error.message,
                        last_synced: connection.last_synced || null
                    });

                    // Update connection status
                    await this.icalConnectionModel.findByIdAndUpdate(
                        connection._id,
                        {
                            status: ConnectionStatus.ERROR,
                            error_message: error.message,
                            last_error_time: new Date()
                        }
                    ).exec();

                    // Create notification for sync failure
                    await this.notificationService.createNotification({
                        user_id: connection.user_id.toString(),
                        property_id: connection.property_id.toString(),
                        type: NotificationType.SYNC_FAILURE,
                        title: `Sync failed for ${connection.platform}`,
                        message: `Failed to sync calendar for ${connection.platform}: ${error.message}`,
                        severity: NotificationSeverity.WARNING,
                    });
                }
            }

            // Detect conflicts after all syncs are complete
            const conflictResults = await this.conflictDetectorService.detectAllConflictsForProperty(propertyId);

            return {
                success: true,
                data: {
                    property_id: propertyId,
                    sync_results: results,
                    summary: {
                        total_connections: connections.length,
                        successful_syncs: results.filter(r => r.success).length,
                        failed_syncs: results.filter(r => !r.success).length,
                        total_events_synced: totalEventsSynced,
                        events_created: totalNewEvents,
                        events_updated: totalUpdatedEvents,
                        events_cancelled: totalCancelledEvents,
                        conflicts_detected: conflictResults?.meta?.conflicts_detected?.total || 0,
                        sync_completion_time: new Date()
                    },
                    next_sync: this.getNextSyncDate(connections)
                },
                message: `Synced ${results.filter(r => r.success).length} of ${connections.length} connections for property ${propertyId}`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to sync property',
                details: {
                    message: error.message,
                    property_id: propertyId,
                    user_id: userId
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    async getPropertySyncStatus(propertyId: string, userId: string): Promise<any> {
        try {
            const connections = await this.icalConnectionModel.find({
                property_id: propertyId,
                user_id: userId,
                is_active: true
            }).exec();

            if (connections.length === 0) {
                return {
                    success: false,
                    error: 'No iCal connections found',
                    details: {
                        property_id: propertyId,
                        user_id: userId
                    },
                    timestamp: new Date().toISOString()
                };
            }

            const connectionStatuses = connections.map(connection => ({
                id: connection._id,
                platform: connection.platform,
                status: connection.status,
                last_synced: connection.last_synced,
                next_sync: connection.last_synced ?
                    new Date(connection.last_synced.getTime() + (connection.sync_frequency * 60 * 1000)) :
                    null,
                error_message: connection.error_message,
                last_error_time: connection.last_error_time,
                sync_frequency_minutes: connection.sync_frequency,
                url_hash: connection.ical_url ?
                    Buffer.from(connection.ical_url).toString('base64').substring(0, 8) :
                    null
            }));

            // Get event counts by platform
            const eventCounts = await Promise.all(connections.map(async connection => {
                const total = await this.calendarEventModel.countDocuments({
                    connection_id: connection._id
                });
                const active = await this.calendarEventModel.countDocuments({
                    connection_id: connection._id,
                    status: { $ne: EventStatus.CANCELLED },
                    end_date: { $gte: new Date() }
                });
                return {
                    platform: connection.platform,
                    total_events: total,
                    active_events: active
                };
            }));

            const lastSyncDate = this.getLastSyncDate(connections);
            const nextSyncDate = this.getNextSyncDate(connections);
            const overallStatus = this.getOverallStatus(connections);

            return {
                success: true,
                data: {
                    property_id: propertyId,
                    connections: connectionStatuses,
                    event_counts: eventCounts,
                    summary: {
                        last_sync: lastSyncDate,
                        next_sync: nextSyncDate,
                        overall_status: overallStatus,
                        total_connections: connections.length,
                        active_connections: connections.filter(c =>
                            c.status?.toUpperCase() === ConnectionStatus.ACTIVE.toUpperCase()
                        ).length,
                        error_connections: connections.filter(c =>
                            c.status?.toUpperCase() === ConnectionStatus.ERROR.toUpperCase()
                        ).length,
                        health_percentage: connections.length > 0 ?
                            Math.round((connections.filter(c =>
                                c.status?.toUpperCase() === ConnectionStatus.ACTIVE.toUpperCase()
                            ).length / connections.length) * 100) : 0
                    }
                },
                message: `Retrieved sync status for ${connections.length} connections`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to retrieve property sync status',
                details: {
                    message: error.message,
                    property_id: propertyId,
                    user_id: userId
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    async getSyncHealthStatus(userId: string): Promise<any> {
        try {
            const allConnections = await this.icalConnectionModel.find({ user_id: userId, is_active: true }).exec();

            const totalConnections = allConnections.length;
            const activeConnections = allConnections.filter(c =>
                c.status?.toUpperCase() === ConnectionStatus.ACTIVE.toUpperCase()
            ).length;
            const errorConnections = allConnections.filter(c =>
                c.status?.toUpperCase() === ConnectionStatus.ERROR.toUpperCase()
            ).length;

            // Get properties with connections
            const propertiesWithConnections = await this.icalConnectionModel.distinct('property_id', {
                user_id: userId
            }).exec();

            // Get properties with errors
            const propertiesWithErrors = await this.icalConnectionModel.distinct('property_id', {
                user_id: userId,
                status: ConnectionStatus.ERROR
            }).exec();

            // Get recent sync failures
            const recentFailures = await this.icalConnectionModel.find({
                user_id: userId,
                status: ConnectionStatus.ERROR,
                last_error_time: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
            }).sort({ last_error_time: -1 }).limit(5).exec();

            // Get upcoming syncs
            const upcomingSyncs = await this.icalConnectionModel.find({
                user_id: userId,
                status: ConnectionStatus.ACTIVE,
                last_synced: { $exists: true }
            }).sort({ last_synced: 1 }).limit(5).exec();

            const upcomingSyncsList = upcomingSyncs.map(conn => ({
                property_id: conn.property_id,
                platform: conn.platform,
                last_synced: conn.last_synced,
                next_sync: new Date(conn.last_synced.getTime() + (conn.sync_frequency * 60 * 1000)),
                minutes_until_next_sync: Math.round((new Date(conn.last_synced.getTime() +
                    (conn.sync_frequency * 60 * 1000)).getTime() - Date.now()) / (60 * 1000))
            }));

            // Get sync statistics
            const lastSystemSync = await this.getLastSystemSync();
            const healthPercentage = totalConnections > 0
                ? Math.round((activeConnections / totalConnections) * 100)
                : 100;

            // Get sync history - count of syncs per day for the last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const syncHistory = await this.icalConnectionModel.aggregate([
                {
                    $match: {
                        user_id: new Types.ObjectId(userId),
                        last_synced: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$last_synced" }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]).exec();

            return {
                success: true,
                data: {
                    summary: {
                        total_connections: totalConnections,
                        active_connections: activeConnections,
                        error_connections: errorConnections,
                        total_properties: propertiesWithConnections.length,
                        properties_with_errors: propertiesWithErrors.length,
                        health_percentage: healthPercentage,
                        health_status: this.getSyncHealthStatusText(healthPercentage),
                        last_system_sync: lastSystemSync
                    },
                    recent_failures: recentFailures.map(conn => ({
                        property_id: conn.property_id,
                        platform: conn.platform,
                        error_message: conn.error_message,
                        last_error_time: conn.last_error_time
                    })),
                    upcoming_syncs: upcomingSyncsList,
                    sync_history: syncHistory,
                    platforms: this.getPlatformBreakdown(allConnections)
                },
                message: totalConnections > 0
                    ? `Sync health: ${healthPercentage}% (${activeConnections}/${totalConnections} connections healthy)`
                    : 'No connections configured',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to retrieve sync health status',
                details: {
                    message: error.message,
                    user_id: userId
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    private getSyncHealthStatusText(percentage: number): string {
        if (percentage >= 90) return 'Excellent';
        if (percentage >= 75) return 'Good';
        if (percentage >= 50) return 'Fair';
        return 'Poor';
    }

    private getPlatformBreakdown(connections: ICalConnection[]): any {
        const platforms = {};

        connections.forEach(conn => {
            if (!platforms[conn.platform]) {
                platforms[conn.platform] = {
                    total: 0,
                    active: 0,
                    error: 0
                };
            }

            platforms[conn.platform].total++;

            if (conn.status?.toUpperCase() === ConnectionStatus.ACTIVE.toUpperCase()) {
                platforms[conn.platform].active++;
            } else if (conn.status?.toUpperCase() === ConnectionStatus.ERROR.toUpperCase()) {
                platforms[conn.platform].error++;
            }
        });

        return platforms;
    }

    /**
     * Synchronizes a single iCal connection by fetching and processing events
     * @param connection The iCal connection to synchronize
     * @returns Results of the sync operation
     */
    async syncConnection(connection: ICalConnection): Promise<{
        events_synced?: number,
        events_created?: number,
        events_updated?: number,
        events_cancelled?: number,
        sync_duration_ms?: number,
        last_synced?: Date,
        conflicts?: any[]
    }> {
        const startTime = Date.now();
        let eventsObject;
        
        // Skip processing if connection is not active
        if (!connection.is_active) {
            throw new Error(`Connection is not active and cannot be synced`);
        }
        
        // Skip processing if connection status is not ACTIVE
        if (connection.status !== ConnectionStatus.ACTIVE) {
            throw new Error(`Connection status is ${connection.status} and cannot be synced`);
        }
        
        try {
            // Fetch and parse iCal feed
            try {
                eventsObject = await this.icalService.fetchAndParseICalFeed(connection.ical_url, connection.platform);
            } catch (fetchError) {
                console.error(`Error fetching iCal feed for ${connection.platform}:`, fetchError.message);
                // Update connection status with specific fetch error
                await this.icalConnectionModel.findByIdAndUpdate(
                    connection._id,
                    {
                        status: ConnectionStatus.ERROR,
                        error_message: `Failed to fetch calendar: ${fetchError.message}`,
                        last_error_time: new Date()
                    }
                ).exec();
                throw new Error(`Failed to fetch calendar: ${fetchError.message}`);
            }
            
            const allEvents = eventsObject.data.events;

            // Filter out past events (end date < today)
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to beginning of today

            const events = allEvents.filter(event =>
                new Date(event.end_date) >= today
            );

            console.log(`Processing ${events.length} events for ${connection.platform} (filtered from ${allEvents.length} total events)`);

            // Get existing events for this connection
            const existingEvents = await this.calendarEventModel.find({
                connection_id: connection._id,
                is_active: true
            }).exec();

            const existingEventMap = new Map<string, CalendarEvent>();
            existingEvents.forEach(event => {
                existingEventMap.set(event.ical_uid, event);
            });

            // Process events
            const eventsToCreate: Array<CalendarEventData & { property_id: Types.ObjectId; connection_id: Types.ObjectId }> = [];
            const eventsToUpdate: Array<{ id: Types.ObjectId; update: Partial<CalendarEventData> }> = [];
            const processedUids = new Set<string>();

            // Process events in batches to avoid memory issues with large calendars
            const BATCH_SIZE = 50;
            for (let i = 0; i < events.length; i += BATCH_SIZE) {
                const eventBatch = events.slice(i, i + BATCH_SIZE);
                
                for (const eventData of eventBatch as CalendarEventData[]) {
                    // Skip events with missing required data
                    if (!eventData.ical_uid || !eventData.start_date || !eventData.end_date) {
                        console.warn(`Skipping event with missing data: ${JSON.stringify(eventData)}`);
                        continue;
                    }
                    
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
                                    status: eventData.status.toLowerCase() as EventStatus,
                                    description: eventData.description,
                                    updated_at: new Date()
                                }
                            });
                        }
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

            // Process database operations in batches
            if (eventsToCreate.length > 0) {
                try {
                    // Insert in smaller batches to avoid MongoDB document size limits
                    const CREATE_BATCH_SIZE = 100;
                    for (let i = 0; i < eventsToCreate.length; i += CREATE_BATCH_SIZE) {
                        const batch = eventsToCreate.slice(i, i + CREATE_BATCH_SIZE);
                        await this.calendarEventModel.insertMany(batch, { ordered: false });
                    }

                    // Create notifications for new bookings (limit to avoid flooding)
                    const MAX_NOTIFICATIONS = 5;
                    const bookingEvents = eventsToCreate
                        .filter(event => event.event_type?.toUpperCase() === EventType.BOOKING.toUpperCase())
                        .slice(0, MAX_NOTIFICATIONS);
                        
                    for (const event of bookingEvents) {
                        await this.notificationService.createNotification({
                            user_id: connection.user_id.toString(),
                            property_id: connection.property_id.toString(),
                            type: NotificationType.NEW_BOOKING,
                            title: `New booking from ${connection.platform}`,
                            message: `New booking: ${event.summary} from ${new Date(event.start_date).toLocaleDateString()} to ${new Date(event.end_date).toLocaleDateString()}`,
                            severity: NotificationSeverity.INFO,
                        });
                    }
                    
                    // If we limited notifications, add a summary notification
                    if (bookingEvents.length < eventsToCreate.filter(e => e.event_type?.toUpperCase() === EventType.BOOKING.toUpperCase()).length) {
                        const totalNewBookings = eventsToCreate.filter(e => e.event_type?.toUpperCase() === EventType.BOOKING.toUpperCase()).length;
                        await this.notificationService.createNotification({
                            user_id: connection.user_id.toString(),
                            property_id: connection.property_id.toString(),
                            type: NotificationType.NEW_BOOKING,
                            title: `${totalNewBookings} new bookings from ${connection.platform}`,
                            message: `${totalNewBookings} new bookings were imported from ${connection.platform}`,
                            severity: NotificationSeverity.INFO,
                        });
                    }
                } catch (dbError) {
                    console.error(`Error creating events for ${connection.platform}:`, dbError.message);
                    // Continue with the sync process despite this error
                }
            }

            // Update events in batches
            if (eventsToUpdate.length > 0) {
                try {
                    const UPDATE_BATCH_SIZE = 50;
                    for (let i = 0; i < eventsToUpdate.length; i += UPDATE_BATCH_SIZE) {
                        const batch = eventsToUpdate.slice(i, i + UPDATE_BATCH_SIZE);
                        await Promise.all(batch.map(({ id, update }) => 
                            this.calendarEventModel.findByIdAndUpdate(id, update).exec()
                        ));
                    }

                    // Only create one notification for updates to avoid flooding
                    if (eventsToUpdate.length > 0) {
                        await this.notificationService.createNotification({
                            user_id: connection.user_id.toString(),
                            property_id: connection.property_id.toString(),
                            type: NotificationType.MODIFIED_BOOKING,
                            title: `${eventsToUpdate.length} booking(s) modified on ${connection.platform}`,
                            message: `${eventsToUpdate.length} booking(s) have been updated from the ${connection.platform} calendar`,
                            severity: NotificationSeverity.INFO,
                        });
                    }
                } catch (dbError) {
                    console.error(`Error updating events for ${connection.platform}:`, dbError.message);
                    // Continue with the sync process despite this error
                }
            }

            // Cancel events in batches
            if (eventsToCancel.length > 0) {
                try {
                    await this.calendarEventModel.updateMany(
                        { _id: { $in: eventsToCancel } },
                        {
                            status: EventStatus.CANCELLED,
                            updated_at: new Date(),
                            cancelled_at: new Date()
                        }
                    ).exec();

                    // Create notifications for cancelled bookings
                    await this.notificationService.createNotification({
                        user_id: connection.user_id.toString(),
                        property_id: connection.property_id.toString(),
                        type: NotificationType.CANCELLED_BOOKING,
                        title: `${eventsToCancel.length} booking(s) cancelled on ${connection.platform}`,
                        message: `${eventsToCancel.length} booking(s) have been removed from the ${connection.platform} calendar`,
                        severity: NotificationSeverity.INFO,
                    });
                } catch (dbError) {
                    console.error(`Error cancelling events for ${connection.platform}:`, dbError.message);
                    // Continue with the sync process despite this error
                }
            }

            // Update connection status
            await this.icalConnectionModel.findByIdAndUpdate(
                connection._id,
                {
                    last_synced: new Date(),
                    status: ConnectionStatus.ACTIVE,
                    error_message: null,
                    sync_count: (connection.sync_count || 0) + 1
                }
            ).exec();

            // Detect conflicts
            let conflictsData;
            try {
                conflictsData = await this.conflictDetectorService.detectAllConflictsForProperty(connection.property_id.toString());
            } catch (conflictError) {
                console.error(`Error detecting conflicts for ${connection.platform}:`, conflictError.message);
                // Don't fail the sync if conflict detection fails
                conflictsData = { data: [] };
            }

            const syncDuration = Date.now() - startTime;
            return {
                events_synced: eventsToCreate.length + eventsToUpdate.length + eventsToCancel.length,
                events_created: eventsToCreate.length,
                events_updated: eventsToUpdate.length,
                events_cancelled: eventsToCancel.length,
                conflicts: conflictsData.data,
                sync_duration_ms: syncDuration
            };
        } catch (error) {
            const syncDuration = Date.now() - startTime;
            console.error(`Sync failed for ${connection.platform} after ${syncDuration}ms:`, error.message);
            
            // Update connection status
            try {
                await this.icalConnectionModel.findByIdAndUpdate(
                    connection._id,
                    {
                        status: ConnectionStatus.ERROR,
                        error_message: error.message,
                        last_error_time: new Date(),
                        sync_duration_ms: syncDuration
                    }
                ).exec();
            } catch (updateError) {
                console.error(`Failed to update connection status for ${connection.platform}:`, updateError.message);
            }

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
