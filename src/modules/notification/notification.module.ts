import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { AdminNotificationController } from './admin-notification.controller';
import { AdminNotificationService } from './admin-notification.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationController, AdminNotificationController],
  providers: [NotificationService, AdminNotificationService],
  exports: [NotificationService, AdminNotificationService],
})
export class NotificationModule {}
