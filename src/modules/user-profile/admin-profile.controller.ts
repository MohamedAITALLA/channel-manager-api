// src/modules/user-profile/admin-profile.controller.ts
import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, Req, UploadedFile, BadRequestException, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AdminProfileService } from './admin-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Admin User Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/user-profiles')
export class AdminProfileController {
  constructor(private readonly adminProfileService: AdminProfileService) { }

  @Get()
  @ApiOperation({ summary: 'Get all user profiles (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllProfiles(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const adminId = req.user.userId;
    return this.adminProfileService.getAllProfiles(adminId, page, limit);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user profile by user ID (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getProfileByUserId(@Req() req: any, @Param('userId') userId: string) {
    const adminId = req.user.userId;
    return this.adminProfileService.getProfileByUserId(adminId, userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update user profile (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async updateProfile(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ) {
    const adminId = req.user.userId;
    return this.adminProfileService.updateProfile(adminId, userId, updateProfileDto);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Reset user profile to default settings (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async resetProfile(@Req() req: any, @Param('userId') userId: string) {
    const adminId = req.user.userId;
    return this.adminProfileService.resetProfile(adminId, userId);
  }

  @Post(':userId/upload-image')
  @ApiOperation({ summary: 'Upload user profile image (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (req, file, callback) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return callback(new BadRequestException('Only image files are allowed!'), false);
      }
      callback(null, true);
    },
    limits: {
      fileSize: 1024 * 1024 * 5, // 5MB
    },
  }))
  async uploadUserProfileImage(
    @Req() req: any,
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const adminId = req.user.userId;
    return this.adminProfileService.uploadUserProfileImage(adminId, userId, file);
  }

  @Delete(':userId/image')
  @ApiOperation({ summary: 'Delete user profile image (admin only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async deleteUserProfileImage(
    @Req() req: any,
    @Param('userId') userId: string,
  ) {
    const adminId = req.user.userId;
    return this.adminProfileService.deleteUserProfileImage(adminId, userId);
  }
}
