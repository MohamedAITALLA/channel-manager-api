// src/modules/user-profile/user-profile.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { AdminProfileController } from './admin-profile.controller';
import { AdminProfileService } from './admin-profile.service';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { UploadService } from '../../common/services/upload.service';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UserProfileController, AdminProfileController],
  providers: [
    UserProfileService, 
    AdminProfileService, 
    UploadService,
    {
      provide: UserProfile,
      useFactory: (userProfileModel: Model<UserProfile>) => userProfileModel,
      inject: [getModelToken(UserProfile.name)],
    },
  ],
  exports: [
    UserProfileService, 
    AdminProfileService,
    UserProfile,
  ],
})
export class UserProfileModule {}
