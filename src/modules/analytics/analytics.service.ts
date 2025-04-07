// src/modules/analytics/analytics.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from '../property/schemas/property.schema';
import { CalendarEvent } from '../calendar/schemas/calendar-event.schema';
import { ICalConnection } from '../ical/schemas/ical-connection.schema';
import { User } from '../auth/schemas/user.schema';
import { Conflict } from '../calendar/schemas/conflict.schema';
import { EventType, Platform, EventStatus, ConnectionStatus } from '../../common/types';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(forwardRef(() => Property)) private propertyModel: Model<Property>,
    @Inject(forwardRef(() => CalendarEvent))  private calendarEventModel: Model<CalendarEvent>,
    @Inject(forwardRef(() => ICalConnection))  private icalConnectionModel: Model<ICalConnection>,
    @Inject(forwardRef(() => User))  private userModel: Model<User>,
    @Inject(forwardRef(() => Conflict))  private conflictModel: Model<Conflict>,
  ) {}

  // Property Analytics
  async getPropertyAnalytics(userId: string, propertyId?: string) {
    try {
      const query = propertyId ? { _id: propertyId, user_id: userId } : { user_id: userId };
      
      // Basic property stats
      const properties = await this.propertyModel.find(query).exec();
      
      // Get property types distribution
      const propertyTypeDistribution = await this.propertyModel.aggregate([
        { $match: { user_id: userId, is_active: true } },
        { $group: { _id: "$property_type", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get location distribution
      const locationDistribution = await this.propertyModel.aggregate([
        { $match: { user_id: userId, is_active: true } },
        { $group: { _id: "$address.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).exec();
      
      // Get amenities distribution
      const amenitiesDistribution = await this.propertyModel.aggregate([
        { $match: { user_id: userId, is_active: true } },
        { $project: {
            wifi: { $cond: ["$amenities.wifi", 1, 0] },
            kitchen: { $cond: ["$amenities.kitchen", 1, 0] },
            ac: { $cond: ["$amenities.ac", 1, 0] },
            heating: { $cond: ["$amenities.heating", 1, 0] },
            tv: { $cond: ["$amenities.tv", 1, 0] },
            washer: { $cond: ["$amenities.washer", 1, 0] },
            dryer: { $cond: ["$amenities.dryer", 1, 0] },
            parking: { $cond: ["$amenities.parking", 1, 0] },
            elevator: { $cond: ["$amenities.elevator", 1, 0] },
            pool: { $cond: ["$amenities.pool", 1, 0] },
          }
        },
        { $group: {
            _id: null,
            wifi: { $sum: "$wifi" },
            kitchen: { $sum: "$kitchen" },
            ac: { $sum: "$ac" },
            heating: { $sum: "$heating" },
            tv: { $sum: "$tv" },
            washer: { $sum: "$washer" },
            dryer: { $sum: "$dryer" },
            parking: { $sum: "$parking" },
            elevator: { $sum: "$elevator" },
            pool: { $sum: "$pool" },
            total: { $sum: 1 }
          }
        }
      ]).exec();
      
      return {
        success: true,
        data: {
          total_properties: properties.length,
          active_properties: properties.filter(p => p.is_active).length,
          property_types: propertyTypeDistribution,
          top_locations: locationDistribution,
          amenities_distribution: amenitiesDistribution.length > 0 ? this.formatAmenitiesData(amenitiesDistribution[0]) : [],
          average_bedrooms: this.calculateAverage(properties, 'bedrooms'),
          average_bathrooms: this.calculateAverage(properties, 'bathrooms'),
          average_accommodates: this.calculateAverage(properties, 'accommodates'),
        },
        message: 'Property analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve property analytics',
        details: {
          message: error.message,
          user_id: userId,
          property_id: propertyId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Booking Analytics
  async getBookingAnalytics(userId: string, propertyId?: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { is_active: true };
      
      // Filter by property if provided
      if (propertyId) {
        query.property_id = propertyId;
      } else {
        // Get all properties for this user
        const properties = await this.propertyModel.find({ user_id: userId, is_active: true }).select('_id').exec();
        query.property_id = { $in: properties.map(p => p._id) };
      }
      
      // Filter by date range if provided
      if (startDate || endDate) {
        query.start_date = {};
        if (startDate) query.start_date.$gte = startDate;
        if (endDate) query.start_date.$lte = endDate;
      }
      
      // Get all booking events
      const bookingEvents = await this.calendarEventModel.find({
        ...query,
        event_type: EventType.BOOKING,
      }).exec();
      
      // Get bookings by platform
      const bookingsByPlatform = await this.calendarEventModel.aggregate([
        { 
          $match: { 
            ...query, 
            event_type: EventType.BOOKING,
            status: { $ne: EventStatus.CANCELLED }
          } 
        },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get bookings by month
      const bookingsByMonth = await this.calendarEventModel.aggregate([
        { 
          $match: { 
            ...query, 
            event_type: EventType.BOOKING,
            status: { $ne: EventStatus.CANCELLED }
          } 
        },
        { 
          $group: { 
            _id: { 
              year: { $year: "$start_date" }, 
              month: { $month: "$start_date" } 
            }, 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]).exec();
      
      // Calculate average booking duration
      const totalDurationDays = bookingEvents.reduce((total, event) => {
        const duration = Math.ceil((new Date(event.end_date).getTime() - new Date(event.start_date).getTime()) / (1000 * 60 * 60 * 24));
        return total + duration;
      }, 0);
      
      const averageDuration = bookingEvents.length > 0 ? totalDurationDays / bookingEvents.length : 0;
      
      // Get occupancy rate by month
      const occupancyByMonth = await this.calculateOccupancyByMonth(query);
      
      return {
        success: true,
        data: {
          total_bookings: bookingEvents.length,
          active_bookings: bookingEvents.filter(b => b.status !== EventStatus.CANCELLED).length,
          bookings_by_platform: bookingsByPlatform,
          bookings_by_month: this.formatBookingsByMonth(bookingsByMonth),
          average_booking_duration: averageDuration.toFixed(1),
          occupancy_by_month: occupancyByMonth,
          cancelled_bookings: bookingEvents.filter(b => b.status === EventStatus.CANCELLED).length,
          cancelled_rate: bookingEvents.length > 0 ? 
            (bookingEvents.filter(b => b.status === EventStatus.CANCELLED).length / bookingEvents.length * 100).toFixed(1) + '%' : '0%',
        },
        message: 'Booking analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve booking analytics',
        details: {
          message: error.message,
          user_id: userId,
          property_id: propertyId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Platform Performance Analytics
  async getPlatformAnalytics(userId: string, propertyId?: string) {
    try {
      const query: any = { is_active: true };
      
      // Filter by property if provided
      if (propertyId) {
        query.property_id = propertyId;
      } else {
        // Get all properties for this user
        const properties = await this.propertyModel.find({ user_id: userId, is_active: true }).select('_id').exec();
        query.property_id = { $in: properties.map(p => p._id) };
      }
      
      // Get connections by platform
      const connectionsByPlatform = await this.icalConnectionModel.aggregate([
        { $match: { ...query, user_id: userId } },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get connections by status
      const connectionsByStatus = await this.icalConnectionModel.aggregate([
        { $match: { ...query, user_id: userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get bookings by platform
      const bookingsByPlatform = await this.calendarEventModel.aggregate([
        { 
          $match: { 
            ...query, 
            event_type: EventType.BOOKING,
            status: { $ne: EventStatus.CANCELLED }
          } 
        },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get sync errors by platform
      const syncErrorsByPlatform = await this.icalConnectionModel.aggregate([
        { $match: { ...query, user_id: userId, status: ConnectionStatus.ERROR } },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get platform performance score
      const platformScores = await this.calculatePlatformScores(userId, query);
      
      return {
        success: true,
        data: {
          connections_by_platform: connectionsByPlatform,
          connections_by_status: connectionsByStatus,
          bookings_by_platform: bookingsByPlatform,
          sync_errors_by_platform: syncErrorsByPlatform,
          platform_performance_scores: platformScores,
          most_reliable_platform: platformScores.length > 0 ? 
            platformScores.sort((a, b) => b.reliability_score - a.reliability_score)[0] : null,
          most_active_platform: bookingsByPlatform.length > 0 ? bookingsByPlatform[0] : null,
        },
        message: 'Platform analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve platform analytics',
        details: {
          message: error.message,
          user_id: userId,
          property_id: propertyId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Calendar and Occupancy Analytics
  async getCalendarAnalytics(userId: string, propertyId?: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { is_active: true };
      
      // Filter by property if provided
      if (propertyId) {
        query.property_id = propertyId;
      } else {
        // Get all properties for this user
        const properties = await this.propertyModel.find({ user_id: userId, is_active: true }).select('_id').exec();
        query.property_id = { $in: properties.map(p => p._id) };
      }
      
      // Filter by date range if provided
      if (startDate || endDate) {
        query.start_date = {};
        if (startDate) query.start_date.$gte = startDate;
        if (endDate) query.start_date.$lte = endDate;
      }
      
      // Get events by type
      const eventsByType = await this.calendarEventModel.aggregate([
        { $match: query },
        { $group: { _id: "$event_type", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Get conflicts
      const conflicts = await this.conflictModel.find({
        ...query,
        is_active: true,
      }).exec();
      
      // Calculate occupancy rate
      const occupancyRate = await this.calculateOccupancyRate(query);
      
      // Get availability by month
      const availabilityByMonth = await this.calculateAvailabilityByMonth(query);
      
      // Get turnover days
      const turnoverDays = await this.calculateTurnoverDays(query);
      
      return {
        success: true,
        data: {
          events_by_type: eventsByType,
          total_conflicts: conflicts.length,
          active_conflicts: conflicts.filter(c => c.status === 'new').length,
          occupancy_rate: occupancyRate,
          availability_by_month: availabilityByMonth,
          turnover_days: turnoverDays,
          booking_density: await this.calculateBookingDensity(query),
          average_gap_between_bookings: await this.calculateAverageGapBetweenBookings(query),
        },
        message: 'Calendar analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve calendar analytics',
        details: {
          message: error.message,
          user_id: userId,
          property_id: propertyId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // User Activity Analytics
  async getUserActivityAnalytics(userId: string) {
    try {
      // Get user properties
      const properties = await this.propertyModel.find({ user_id: userId, is_active: true }).exec();
      
      // Get all connections
      const connections = await this.icalConnectionModel.find({ user_id: userId, is_active: true }).exec();
      
      // Get recent sync activity
      const recentSyncs = await this.icalConnectionModel.find({ user_id: userId })
        .sort({ last_synced: -1 })
        .limit(10)
        .exec();
      
      // Get connection health
      const connectionHealth = {
        total: connections.length,
        active: connections.filter(c => c.status === ConnectionStatus.ACTIVE).length,
        error: connections.filter(c => c.status === ConnectionStatus.ERROR).length,
        inactive: connections.filter(c => c.status === ConnectionStatus.INACTIVE).length,
      };
      
      // Calculate health score
      const healthScore = connectionHealth.total > 0 ? 
        Math.round((connectionHealth.active / connectionHealth.total) * 100) : 100;
      
      return {
        success: true,
        data: {
          total_properties: properties.length,
          total_connections: connections.length,
          connection_health: connectionHealth,
          health_score: healthScore,
          recent_sync_activity: recentSyncs.map(sync => ({
            platform: sync.platform,
            property_id: sync.property_id,
            last_synced: sync.last_synced,
            status: sync.status,
            error_message: sync.error_message,
          })),
          platforms_used: [...new Set(connections.map(c => c.platform))],
          system_health_status: this.getSystemHealthStatus(healthScore),
          recommended_actions: this.getRecommendedActions(connectionHealth, properties.length),
        },
        message: 'User activity analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve user activity analytics',
        details: {
          message: error.message,
          user_id: userId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Dashboard Overview Analytics
  async getDashboardAnalytics(userId: string) {
    try {
      // Get user properties
      const properties = await this.propertyModel.find({ user_id: userId, is_active: true }).exec();
      
      // Get property IDs
      const propertyIds = properties.map(p => p._id);
      
      // Get active bookings
      const activeBookings = await this.calendarEventModel.find({
        property_id: { $in: propertyIds },
        event_type: EventType.BOOKING,
        status: { $ne: EventStatus.CANCELLED },
        end_date: { $gte: new Date() },
        is_active: true,
      }).exec();
      
      // Get upcoming bookings
      const upcomingBookings = await this.calendarEventModel.find({
        property_id: { $in: propertyIds },
        event_type: EventType.BOOKING,
        status: { $ne: EventStatus.CANCELLED },
        start_date: { $gte: new Date() },
        is_active: true,
      }).sort({ start_date: 1 }).limit(5).exec();
      
      // Get active conflicts
      const activeConflicts = await this.conflictModel.find({
        property_id: { $in: propertyIds },
        status: 'new',
        is_active: true,
      }).exec();
      
      // Get connection health
      const connections = await this.icalConnectionModel.find({ user_id: userId, is_active: true }).exec();
      const connectionHealth = {
        total: connections.length,
        active: connections.filter(c => c.status === ConnectionStatus.ACTIVE).length,
        error: connections.filter(c => c.status === ConnectionStatus.ERROR).length,
        inactive: connections.filter(c => c.status === ConnectionStatus.INACTIVE).length,
      };
      
      // Calculate health score
      const healthScore = connectionHealth.total > 0 ? 
        Math.round((connectionHealth.active / connectionHealth.total) * 100) : 100;
      
      // Calculate current occupancy
      const today = new Date();
      const occupiedProperties = await this.calendarEventModel.distinct('property_id', {
        property_id: { $in: propertyIds },
        event_type: EventType.BOOKING,
        status: { $ne: EventStatus.CANCELLED },
        start_date: { $lte: today },
        end_date: { $gte: today },
        is_active: true,
      });
      
      const currentOccupancyRate = properties.length > 0 ? 
        Math.round((occupiedProperties.length / properties.length) * 100) : 0;
      
      return {
        success: true,
        data: {
          total_properties: properties.length,
          active_bookings: activeBookings.length,
          upcoming_bookings: upcomingBookings.map(booking => ({
            id: booking._id,
            property_id: booking.property_id,
            summary: booking.summary,
            start_date: booking.start_date,
            end_date: booking.end_date,
            platform: booking.platform,
            days_until: Math.ceil((new Date(booking.start_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          })),
          active_conflicts: activeConflicts.length,
          connection_health: connectionHealth,
          health_score: healthScore,
          current_occupancy_rate: currentOccupancyRate,
          system_health_status: this.getSystemHealthStatus(healthScore),
          alerts: this.generateAlerts(activeConflicts.length, connectionHealth.error, upcomingBookings),
        },
        message: 'Dashboard analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve dashboard analytics',
        details: {
          message: error.message,
          user_id: userId,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Performance Comparison Analytics
  async getPerformanceComparisonAnalytics(userId: string, propertyIds: string[]) {
    try {
      if (!propertyIds || propertyIds.length === 0) {
        return {
          success: false,
          error: 'No properties specified for comparison',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Ensure all properties belong to the user
      const userProperties = await this.propertyModel.find({ 
        user_id: userId, 
        _id: { $in: propertyIds },
        is_active: true 
      }).exec();
      
      if (userProperties.length !== propertyIds.length) {
        return {
          success: false,
          error: 'One or more properties not found or do not belong to the user',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Get comparison data for each property
      const comparisonData = await Promise.all(propertyIds.map(async (propertyId) => {
        const property = userProperties.find(p => p._id?.toString() === propertyId);
        
        // Get bookings for this property
        const bookings = await this.calendarEventModel.find({
          property_id: propertyId,
          event_type: EventType.BOOKING,
          is_active: true,
        }).exec();
        
        // Calculate occupancy rate for last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const occupancyRate = await this.calculateOccupancyRate({
          property_id: propertyId,
          start_date: { $gte: ninetyDaysAgo },
        });
        
        // Get connections for this property
        const connections = await this.icalConnectionModel.find({
          property_id: propertyId,
          is_active: true,
        }).exec();
        
        // Calculate average booking duration
        const totalDurationDays = bookings.reduce((total, event) => {
          const duration = Math.ceil((new Date(event.end_date).getTime() - new Date(event.start_date).getTime()) / (1000 * 60 * 60 * 24));
          return total + duration;
        }, 0);
        
        const averageDuration = bookings.length > 0 ? totalDurationDays / bookings.length : 0;
        
        return {
          property_id: propertyId,
          property_name: property?.name || 'Unknown Property',
          property_type: property?.property_type || 'Unknown',
          total_bookings: bookings.length,
          active_bookings: bookings.filter(b => b.status !== EventStatus.CANCELLED && new Date(b.end_date) >= new Date()).length,
          occupancy_rate: occupancyRate,
          average_booking_duration: averageDuration.toFixed(1),
          platforms_connected: connections.length,
          platforms: connections.map(c => c.platform),
          location: property?.address ? `${property.address.city}, ${property.address.country}` : 'Unknown',
        };
      }));
      
      return {
        success: true,
        data: {
          comparison_data: comparisonData,
          best_performing: this.getBestPerformingProperty(comparisonData),
          property_count: comparisonData.length,
        },
        message: 'Performance comparison analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve performance comparison analytics',
        details: {
          message: error.message,
          user_id: userId,
          property_ids: propertyIds,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Helper methods
  private calculateAverage(items: any[], field: string): number {
    if (items.length === 0) return 0;
    const sum = items.reduce((total, item) => total + (item[field] || 0), 0);
    return parseFloat((sum / items.length).toFixed(1));
  }

  private formatAmenitiesData(amenitiesData: any): any[] {
    const { _id, total, ...amenities } = amenitiesData;
    return Object.entries(amenities).map(([name, count]) => ({
      amenity: name,
      count,
      percentage: total > 0 ? Math.round((count as number) / total * 100) : 0
    }));
  }

  private formatBookingsByMonth(bookingsByMonth: any[]): any[] {
    return bookingsByMonth.map(item => ({
      year: item._id.year,
      month: item._id.month,
      month_name: this.getMonthName(item._id.month),
      count: item.count,
      period: `${this.getMonthName(item._id.month)} ${item._id.year}`
    }));
  }

  private getMonthName(month: number): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month - 1];
  }

  private async calculateOccupancyRate(query: any): Promise<string> {
    // Get total days in range
    const startDate = query.start_date?.$gte || new Date(new Date().getFullYear(), 0, 1);
    const endDate = query.start_date?.$lte || new Date();
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get all booking events in range
    const bookings = await this.calendarEventModel.find({
      ...query,
      event_type: EventType.BOOKING,
      status: { $ne: EventStatus.CANCELLED },
    }).exec();
    
    // Calculate occupied days
    let occupiedDays = 0;
    
    // Get unique property IDs
    const propertyIds = [...new Set(bookings.map(b => b.property_id.toString()))];
    
    // For each property, calculate occupied days
    for (const propertyId of propertyIds) {
      const propertyBookings = bookings.filter(b => b.property_id.toString() === propertyId);
      
      // Create a set of occupied dates
      const occupiedDates = new Set<string>();
      
      propertyBookings.forEach(booking => {
        const start = new Date(Math.max(booking.start_date.getTime(), startDate.getTime()));
        const end = new Date(Math.min(booking.end_date.getTime(), endDate.getTime()));
        
        for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
          occupiedDates.add(date.toISOString().split('T')[0]);
        }
      });
      
      occupiedDays += occupiedDates.size;
    }
    
    // Calculate occupancy rate
    const totalPossibleDays = totalDays * propertyIds.length;
    const occupancyRate = totalPossibleDays > 0 ? (occupiedDays / totalPossibleDays * 100).toFixed(1) + '%' : '0%';
    return occupancyRate;
}

private async calculateOccupancyByMonth(query: any): Promise<any[]> {
  // Get current year and last year
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  
  // Create a date range for the last 12 months
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);
  
  // Get all booking events in range
  const bookings = await this.calendarEventModel.find({
    ...query,
    event_type: EventType.BOOKING,
    status: { $ne: EventStatus.CANCELLED },
    start_date: { $gte: startDate },
    end_date: { $lte: endDate },
  }).exec();
  
  // Get unique property IDs
  const propertyIds = [...new Set(bookings.map(b => b.property_id.toString()))];
  
  // Initialize results array with all months
  const results:any[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    
    results.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      month_name: this.getMonthName(date.getMonth() + 1),
      occupancy_rate: '0%',
      occupied_days: 0,
      total_days: 0,
    });
  }
  
  // For each month, calculate occupancy
  for (const result of results) {
    const monthStart = new Date(result.year, result.month - 1, 1);
    const monthEnd = new Date(result.year, result.month, 0);
    const daysInMonth = monthEnd.getDate();
    
    // Total possible days across all properties
    const totalPossibleDays = daysInMonth * propertyIds.length;
    result.total_days = totalPossibleDays;
    
    // For each property, calculate occupied days in this month
    let occupiedDays = 0;
    
    for (const propertyId of propertyIds) {
      const propertyBookings = bookings.filter(b => 
        b.property_id.toString() === propertyId &&
        new Date(b.start_date) <= monthEnd &&
        new Date(b.end_date) >= monthStart
      );
      
      // Create a set of occupied dates for this property in this month
      const occupiedDates = new Set<string>();
      
      propertyBookings.forEach(booking => {
        const start = new Date(Math.max(booking.start_date.getTime(), monthStart.getTime()));
        const end = new Date(Math.min(booking.end_date.getTime(), monthEnd.getTime()));
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          if (date.getMonth() === monthStart.getMonth() && date.getFullYear() === monthStart.getFullYear()) {
            occupiedDates.add(date.toISOString().split('T')[0]);
          }
        }
      });
      
      occupiedDays += occupiedDates.size;
    }
    
    result.occupied_days = occupiedDays;
    result.occupancy_rate = totalPossibleDays > 0 ? 
      (occupiedDays / totalPossibleDays * 100).toFixed(1) + '%' : '0%';
  }
  
  // Sort by year and month
  results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  
  return results;
}

private async calculateAvailabilityByMonth(query: any): Promise<any[]> {
  // Similar to occupancy by month but returns availability instead
  const occupancyByMonth = await this.calculateOccupancyByMonth(query);
  
  return occupancyByMonth.map(month => ({
    ...month,
    availability_rate: month.total_days > 0 ? 
      (100 - parseFloat(month.occupancy_rate)).toFixed(1) + '%' : '100%',
  }));
}

private async calculateTurnoverDays(query: any): Promise<any[]> {
  // Get all booking events
  const bookings = await this.calendarEventModel.find({
    ...query,
    event_type: EventType.BOOKING,
    status: { $ne: EventStatus.CANCELLED },
  }).sort({ property_id: 1, start_date: 1 }).exec();
  
  // Group bookings by property
  const bookingsByProperty = bookings.reduce((acc, booking) => {
    const propertyId = booking.property_id.toString();
    if (!acc[propertyId]) acc[propertyId] = [];
    acc[propertyId].push(booking);
    return acc;
  }, {});
  
  // Calculate turnover days
  const turnoverDays:any[] = [];
  
  for (const [propertyId, propertyBookings] of Object.entries(bookingsByProperty)) {
    const bookingsArray = propertyBookings as any[];
    
    for (let i = 1; i < bookingsArray.length; i++) {
      const prevBooking = bookingsArray[i - 1];
      const currentBooking = bookingsArray[i];
      
      const prevEnd = new Date(prevBooking.end_date);
      const currentStart = new Date(currentBooking.start_date);
      
      // If bookings are on the same day or overlapping, it's a turnover day
      if (this.isSameDay(prevEnd, currentStart) || prevEnd > currentStart) {
        turnoverDays.push({
          property_id: propertyId,
          date: prevEnd.toISOString().split('T')[0],
          previous_booking_id: prevBooking._id,
          next_booking_id: currentBooking._id,
          is_overlap: prevEnd > currentStart,
        });
      }
    }
  }
  
  return turnoverDays;
}

private isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

private async calculateBookingDensity(query: any): Promise<any> {
  // Get all booking events
  const bookings = await this.calendarEventModel.find({
    ...query,
    event_type: EventType.BOOKING,
    status: { $ne: EventStatus.CANCELLED },
  }).exec();
  
  // Group bookings by property
  const bookingsByProperty = bookings.reduce((acc, booking) => {
    const propertyId = booking.property_id.toString();
    if (!acc[propertyId]) acc[propertyId] = [];
    acc[propertyId].push(booking);
    return acc;
  }, {});
  
  // Calculate booking density for each property
  const densityByProperty:any[] = [];
  
  for (const [propertyId, propertyBookings] of Object.entries(bookingsByProperty)) {
    const bookingsArray = propertyBookings as any[];
    
    // Get date range
    let minDate = new Date();
    let maxDate = new Date(0);
    
    bookingsArray.forEach(booking => {
      if (booking.start_date < minDate) minDate = new Date(booking.start_date);
      if (booking.end_date > maxDate) maxDate = new Date(booking.end_date);
    });
    
    // Calculate total days in range
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Create a set of occupied dates
    const occupiedDates = new Set<string>();
    
    bookingsArray.forEach(booking => {
      for (let date = new Date(booking.start_date); date < new Date(booking.end_date); date.setDate(date.getDate() + 1)) {
        occupiedDates.add(date.toISOString().split('T')[0]);
      }
    });
    
    densityByProperty.push({
      property_id: propertyId,
      booking_count: bookingsArray.length,
      occupied_days: occupiedDates.size,
      total_days: totalDays,
      density: totalDays > 0 ? (occupiedDates.size / totalDays).toFixed(2) : '0',
      density_percentage: totalDays > 0 ? (occupiedDates.size / totalDays * 100).toFixed(1) + '%' : '0%',
    });
  }
  
  // Calculate average density across all properties
  const totalDensity = densityByProperty.reduce((sum, item) => sum + parseFloat(item.density), 0);
  const averageDensity = densityByProperty.length > 0 ? totalDensity / densityByProperty.length : 0;
  
  return {
    by_property: densityByProperty,
    average_density: averageDensity.toFixed(2),
    average_density_percentage: (averageDensity * 100).toFixed(1) + '%',
  };
}

private async calculateAverageGapBetweenBookings(query: any): Promise<any> {
  // Get all booking events
  const bookings = await this.calendarEventModel.find({
    ...query,
    event_type: EventType.BOOKING,
    status: { $ne: EventStatus.CANCELLED },
  }).sort({ property_id: 1, start_date: 1 }).exec();
  
  // Group bookings by property
  const bookingsByProperty = bookings.reduce((acc, booking) => {
    const propertyId = booking.property_id.toString();
    if (!acc[propertyId]) acc[propertyId] = [];
    acc[propertyId].push(booking);
    return acc;
  }, {});
  
  // Calculate gaps for each property
  const gapsByProperty:any[] = [];
  
  for (const [propertyId, propertyBookings] of Object.entries(bookingsByProperty)) {
    const bookingsArray = propertyBookings as any[];
    const gaps:any[] = [];
    
    for (let i = 1; i < bookingsArray.length; i++) {
      const prevBooking = bookingsArray[i - 1];
      const currentBooking = bookingsArray[i];
      
      const prevEnd = new Date(prevBooking.end_date);
      const currentStart = new Date(currentBooking.start_date);
      
      // Calculate gap in days
      const gapDays = Math.ceil((currentStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24));
      
      // Only count positive gaps (no overlaps)
      if (gapDays > 0) {
        gaps.push({
          days: gapDays,
          start_date: prevEnd.toISOString().split('T')[0],
          end_date: currentStart.toISOString().split('T')[0],
        });
      }
    }
    
    // Calculate average gap
    const totalGapDays = gaps.reduce((sum, gap) => sum + gap.days, 0);
    const averageGap = gaps.length > 0 ? totalGapDays / gaps.length : 0;
    
    gapsByProperty.push({
      property_id: propertyId,
      gaps_count: gaps.length,
      total_gap_days: totalGapDays,
      average_gap_days: averageGap.toFixed(1),
      longest_gap: gaps.length > 0 ? Math.max(...gaps.map(g => g.days)) : 0,
      shortest_gap: gaps.length > 0 ? Math.min(...gaps.map(g => g.days)) : 0,
    });
  }
  
  // Calculate average gap across all properties
  const totalAvgGap = gapsByProperty.reduce((sum, item) => sum + parseFloat(item.average_gap_days), 0);
  const overallAverageGap = gapsByProperty.length > 0 ? totalAvgGap / gapsByProperty.length : 0;
  
  return {
    by_property: gapsByProperty,
    overall_average_gap_days: overallAverageGap.toFixed(1),
  };
}

private async calculatePlatformScores(userId: string, query: any): Promise<any[]> {
  // Get all connections
  const connections = await this.icalConnectionModel.find({
    ...query,
    user_id: userId,
  }).exec();
  
  // Group connections by platform
  const connectionsByPlatform = connections.reduce((acc, connection) => {
    const platform = connection.platform;
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(connection);
    return acc;
  }, {});
  
  // Calculate scores for each platform
  const platformScores:any[] = [];
  
  for (const [platform, platformConnections] of Object.entries(connectionsByPlatform)) {
    const connectionsArray = platformConnections as any[];
    
    // Calculate reliability score based on connection status
    const activeConnections = connectionsArray.filter(c => c.status === ConnectionStatus.ACTIVE).length;
    const reliabilityScore = connectionsArray.length > 0 ? 
      (activeConnections / connectionsArray.length) * 100 : 0;
    
    // Get bookings for this platform
    const bookings = await this.calendarEventModel.find({
      ...query,
      platform,
      event_type: EventType.BOOKING,
    }).exec();
    
    // Calculate average booking duration
    const totalDurationDays = bookings.reduce((total, event) => {
      const duration = Math.ceil((new Date(event.end_date).getTime() - new Date(event.start_date).getTime()) / (1000 * 60 * 60 * 24));
      return total + duration;
    }, 0);
    
    const averageDuration = bookings.length > 0 ? totalDurationDays / bookings.length : 0;
    
    platformScores.push({
      platform,
      connections_count: connectionsArray.length,
      active_connections: activeConnections,
      error_connections: connectionsArray.filter(c => c.status === ConnectionStatus.ERROR).length,
      reliability_score: reliabilityScore.toFixed(1),
      bookings_count: bookings.length,
      average_booking_duration: averageDuration.toFixed(1),
      last_synced: connectionsArray.reduce((latest, conn) => {
        return conn.last_synced && (!latest || conn.last_synced > latest) ? conn.last_synced : latest;
      }, null),
    });
  }
  
  return platformScores;
}

private getSystemHealthStatus(healthScore: number): string {
  if (healthScore >= 90) return 'Excellent';
  if (healthScore >= 75) return 'Good';
  if (healthScore >= 50) return 'Fair';
  return 'Needs Attention';
}

private getRecommendedActions(connectionHealth: any, propertiesCount: number): string[] {
  const actions:any[] = [];
  
  if (connectionHealth.error > 0) {
    actions.push(`Fix ${connectionHealth.error} connection(s) with errors`);
  }
  
  if (connectionHealth.inactive > 0) {
    actions.push(`Reactivate ${connectionHealth.inactive} inactive connection(s)`);
  }
  
  if (connectionHealth.total === 0 && propertiesCount > 0) {
    actions.push('Set up calendar connections for your properties');
  }
  
  if (actions.length === 0) {
    actions.push('Your system is healthy. No actions needed at this time.');
  }
  
  return actions;
}

private generateAlerts(conflictsCount: number, errorConnectionsCount: number, upcomingBookings: any[]): any[] {
  const alerts:any[] = [];
  
  if (conflictsCount > 0) {
    alerts.push({
      type: 'conflict',
      severity: 'high',
      message: `You have ${conflictsCount} active booking conflict(s) that need resolution`,
    });
  }
  
  if (errorConnectionsCount > 0) {
    alerts.push({
      type: 'connection',
      severity: 'medium',
      message: `${errorConnectionsCount} calendar connection(s) have errors and need attention`,
    });
  }
  
  // Check for imminent bookings (within next 48 hours)
  const now = new Date();
  const imminentBookings = upcomingBookings.filter(booking => {
    const bookingStart = new Date(booking.start_date);
    const hoursUntil = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntil <= 48;
  });
  
  if (imminentBookings.length > 0) {
    alerts.push({
      type: 'booking',
      severity: 'info',
      message: `You have ${imminentBookings.length} booking(s) starting in the next 48 hours`,
    });
  }
  
  return alerts;
}

private getBestPerformingProperty(properties: any[]): any {
  if (properties.length === 0) return null;
  
  // Sort by occupancy rate (descending)
  return [...properties].sort((a, b) => {
    const aRate = parseFloat(a.occupancy_rate);
    const bRate = parseFloat(b.occupancy_rate);
    return bRate - aRate;
  })[0];
}
}

