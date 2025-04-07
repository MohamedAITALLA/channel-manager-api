// src/modules/analytics/analytics.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AuditModule } from '../audit/audit.module';
import { PropertyModule } from '../property/property.module';
import { CalendarModule } from '../calendar/calendar.module';
import { IcalModule } from '../ical/ical.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuditModule),
    forwardRef(() => PropertyModule),
    forwardRef(() => CalendarModule),
    forwardRef(() => IcalModule),
    forwardRef(() => AuthModule),
  
  ],
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService, AdminAnalyticsService],
  exports: [AnalyticsService, AdminAnalyticsService],
})
export class AnalyticsModule {}
