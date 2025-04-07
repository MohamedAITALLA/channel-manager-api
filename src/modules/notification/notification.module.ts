import { Module, forwardRef } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { AdminNotificationController } from './admin-notification.controller';
import { AdminNotificationService } from './admin-notification.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Model } from 'mongoose';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    forwardRef(() => AuditModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [NotificationController, AdminNotificationController],
  providers: [NotificationService, AdminNotificationService, 
    {
      provide: Notification,
      useFactory: (notificationModel: Model<Notification>) => notificationModel,
      inject: [getModelToken(Notification.name)],
    },

  ],
  exports: [NotificationService, AdminNotificationService, Notification],
})
export class NotificationModule {}
