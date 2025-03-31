import { Controller, Get, Put, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('User Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get user profile settings' })
  async getProfile(@Req() req: any) {
    const userId = req.user.userId;
    return this.userProfileService.getProfile(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update user profile settings' })
  async updateProfile(@Req() req: any, @Body() updateProfileDto: UpdateUserProfileDto) {
    const userId = req.user.userId;
    return this.userProfileService.updateProfile(userId, updateProfileDto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset user profile to default settings' })
  async resetProfile(@Req() req: any) {
    const userId = req.user.userId;
    return this.userProfileService.resetProfile(userId);
  }
}