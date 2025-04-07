// src/modules/analytics/admin-analytics.service.ts
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from '../property/schemas/property.schema';
import { CalendarEvent } from '../calendar/schemas/calendar-event.schema';
import { ICalConnection } from '../ical/schemas/ical-connection.schema';
import { User } from '../auth/schemas/user.schema';
import { Conflict } from '../calendar/schemas/conflict.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @Inject(Property) private propertyModel: Model<Property>,
    @Inject(CalendarEvent) private calendarEventModel: Model<CalendarEvent>,
    @Inject(ICalConnection) private icalConnectionModel: Model<ICalConnection>,
    @Inject(User) private userModel: Model<User>,
    @Inject(Conflict) private conflictModel: Model<Conflict>,
    @Inject(forwardRef(() => AuditService))
    private readonly auditService: AuditService,
  ) {}

  async getSystemAnalytics(
    startDate?: Date,
    endDate?: Date,
  ) {
    try {
      // User statistics
      const totalUsers = await this.userModel.countDocuments().exec();
      const activeUsers = await this.userModel.countDocuments({ is_active: true }).exec();
      
      // Property statistics
      const totalProperties = await this.propertyModel.countDocuments().exec();
      const activeProperties = await this.propertyModel.countDocuments({ is_active: true }).exec();
      
      // Calendar event statistics
      const query: any = {};
      if (startDate || endDate) {
        query.$or = [];
        
        if (startDate && endDate) {
          // Events that overlap with the date range
          query.$or.push({
            $and: [
              { start_date: { $lte: new Date(endDate) } },
              { end_date: { $gte: new Date(startDate) } },
            ],
          });
        } else if (startDate) {
          query.$or.push({ start_date: { $gte: new Date(startDate) } });
        } else if (endDate) {
          query.$or.push({ end_date: { $lte: new Date(endDate) } });
        }
      }
      
      const totalEvents = await this.calendarEventModel.countDocuments(query).exec();
      
      // Platform distribution
      const platformDistribution = await this.calendarEventModel.aggregate([
        { $match: query },
        { $group: { _id: "$platform", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec();
      
      // Connection statistics
      const totalConnections = await this.icalConnectionModel.countDocuments().exec();
      const activeConnections = await this.icalConnectionModel.countDocuments({ is_active: true }).exec();
      
      // Conflict statistics
      const totalConflicts = await this.conflictModel.countDocuments().exec();
      const unresolvedConflicts = await this.conflictModel.countDocuments({ resolved: false }).exec();
      
      // User registration trend (last 12 months)
      const userRegistrationTrend = await this.getUserRegistrationTrend();
      
      // Property creation trend (last 12 months)
      const propertyCreationTrend = await this.getPropertyCreationTrend();
      
      return {
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            inactive: totalUsers - activeUsers,
            registration_trend: userRegistrationTrend,
          },
          properties: {
            total: totalProperties,
            active: activeProperties,
            inactive: totalProperties - activeProperties,
            creation_trend: propertyCreationTrend,
          },
          events: {
            total: totalEvents,
            platform_distribution: platformDistribution,
          },
          connections: {
            total: totalConnections,
            active: activeConnections,
            inactive: totalConnections - activeConnections,
          },
          conflicts: {
            total: totalConflicts,
            unresolved: unresolvedConflicts,
            resolved: totalConflicts - unresolvedConflicts,
          },
        },
        message: 'System analytics retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve system analytics',
        details: {
          message: error.message,
        },
      };
    }
  }

  async getUserAnalytics(userId?: string) {
    try {
      const query = userId ? { _id: userId } : {};
      const user = userId ? await this.userModel.findById(userId).exec() : null;
      
      // User property statistics
      const propertyCount = userId 
        ? await this.propertyModel.countDocuments({ user_id: userId }).exec()
        : await this.propertyModel.countDocuments().exec();
      
      // User event statistics
      const propertyIds = userId
        ? (await this.propertyModel.find({ user_id: userId }).select('_id').exec()).map(p => p._id)
        : [];
      
      const eventCount = userId
        ? await this.calendarEventModel.countDocuments({ property_id: { $in: propertyIds } }).exec()
        : await this.calendarEventModel.countDocuments().exec();
      
      // User activity statistics
      const userActivity = userId
        ? await this.getUserActivityStats(userId)
        : await this.getOverallUserActivityStats();
      
      return {
        success: true,
        data: {
          user: user ? {
            id: user._id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active,
            created_at: user.created_at,
          } : null,
          properties: propertyCount,
          events: eventCount,
          activity: userActivity,
        },
        message: userId ? 'User analytics retrieved successfully' : 'All users analytics retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve user analytics',
        details: {
          message: error.message,
          user_id: userId,
        },
      };
    }
  }

  private async getUserRegistrationTrend() {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    const registrationTrend = await this.userModel.aggregate([
      { $match: { created_at: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$created_at" }, month: { $month: "$created_at" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).exec();
    
    // Format the result to include all months
    const result:any[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const found = registrationTrend.find(item => item._id.year === year && item._id.month === month);
      
      result.push({
        year,
        month,
        count: found ? found.count : 0,
      });
    }
    
    return result;
  }

  private async getPropertyCreationTrend() {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    const creationTrend = await this.propertyModel.aggregate([
      { $match: { created_at: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$created_at" }, month: { $month: "$created_at" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).exec();
    
    // Format the result to include all months
    const result:any[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const found = creationTrend.find(item => item._id.year === year && item._id.month === month);
      
      result.push({
        year,
        month,
        count: found ? found.count : 0,
      });
    }
    
    return result;
  }

  private async getUserActivityStats(userId: string) {
    // This would typically come from audit logs
    // For now, we'll return a placeholder
    return {
      last_login: new Date(),
      login_count: 0,
      average_session_duration: 0,
    };
  }

  private async getOverallUserActivityStats() {
    // This would typically come from audit logs
    // For now, we'll return a placeholder
    return {
      active_users_last_24h: 0,
      active_users_last_7d: 0,
      active_users_last_30d: 0,
      average_session_duration: 0,
    };
  }
}