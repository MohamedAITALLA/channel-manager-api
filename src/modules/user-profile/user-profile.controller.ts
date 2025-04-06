// src/modules/user-profile/user-profile.controller.ts
import { Controller, Get, Put, Post, Body, UseGuards, Req, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

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

  @Post('upload-image')
  @ApiOperation({ summary: 'Upload user profile image' })
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
  async uploadProfileImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    
    const userId = req.user.userId;
    return this.userProfileService.uploadProfileImage(userId, file);
  }

  @Post('delete-image')
  @ApiOperation({ summary: 'Delete user profile image' })
  async deleteProfileImage(@Req() req: any) {
    const userId = req.user.userId;
    return this.userProfileService.deleteProfileImage(userId);
  }
}
