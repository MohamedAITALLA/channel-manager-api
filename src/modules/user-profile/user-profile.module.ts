// src/modules/user-profile/user-profile.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { AdminProfileController } from './admin-profile.controller';
import { AdminProfileService } from './admin-profile.service';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [UserProfileController, AdminProfileController],
  providers: [UserProfileService, AdminProfileService],
  exports: [UserProfileService, AdminProfileService],
})
export class UserProfileModule {}
