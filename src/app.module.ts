// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { UserProfileModule } from './modules/user-profile/user-profile.module';
import { AuthModule } from './modules/auth/auth.module';
import { PropertyModule } from './modules/property/property.module';
import { IcalModule } from './modules/ical/ical.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { SyncModule } from './modules/sync/sync.module';
import { NotificationModule } from './modules/notification/notification.module';
import { StaticModule } from './common/modules/static.module';
import { EmailModule } from './modules/email/email.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    UserProfileModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/property-management',
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    PropertyModule,
    IcalModule,
    CalendarModule,
    SyncModule,
    NotificationModule,
    StaticModule,
    EmailModule,
    AuditModule,
  ],
})
export class AppModule {}
