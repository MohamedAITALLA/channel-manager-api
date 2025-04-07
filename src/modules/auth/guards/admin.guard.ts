// src/modules/auth/guards/admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(User) private userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.is_admin) {
      throw new ForbiddenException('User is not an admin');
    }

    return true;
  }
}
