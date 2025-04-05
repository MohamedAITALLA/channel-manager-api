// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from './schemas/user.schema';
import { UserProfile, UserProfileSchema } from '../user-profile/schemas/user-profile.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminGuard } from './guards/admin.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    EmailModule,
  ],
  controllers: [AuthController, AdminController],
  providers: [AuthService, AdminService, JwtStrategy, AdminGuard],
  exports: [AuthService, AdminService, JwtStrategy, AdminGuard],
})
export class AuthModule {}
