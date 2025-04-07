// src/modules/audit/audit.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditController } from './admin-audit.controller';
import { AuditEntry, AuditEntrySchema } from './schemas/audit-entry.schema';
import { Model } from 'mongoose';
import { CalendarModule } from '../calendar/calendar.module';
import { PropertyModule } from '../property/property.module';
import { IcalModule } from '../ical/ical.module';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';
import { NotificationModule } from '../notification/notification.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UserProfileModule } from '../user-profile/user-profile.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditEntry.name, schema: AuditEntrySchema },
    ]),
    forwardRef(() => CalendarModule), // Add this line
    forwardRef(() => PropertyModule),
    forwardRef(() => IcalModule),
    forwardRef(() => AuthModule),
    forwardRef(() => SyncModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => UserProfileModule),

  ],
  controllers: [AdminAuditController],
  providers: [AuditService, AdminAuditService, {
    provide: AuditEntry,
    useFactory: (auditEntryModel: Model<AuditEntry>) => auditEntryModel,
    inject: [getModelToken(AuditEntry.name)],
  }],
  exports: [AuditService, AdminAuditService, AuditEntry],
})
export class AuditModule {}
