// src/modules/auth/admin.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Get()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllUsers(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    const adminId = req.user.userId;
    return this.adminService.getAllUsers(adminId, page, limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async getUserById(@Req() req: any, @Param('id') userId: string) {
    const adminId = req.user.userId;
    return this.adminService.getUserById(adminId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user (admin only)' })
  async createUser(@Req() req: any, @Body() createUserDto: RegisterDto) {
    const adminId = req.user.userId;
    return this.adminService.createUser(adminId, createUserDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async updateUser(
    @Req() req: any,
    @Param('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const adminId = req.user.userId;
    return this.adminService.updateUser(adminId, userId, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
  async deleteUser(@Req() req: any, @Param('id') userId: string, @Query('preserve_history') preserveHistory?: boolean) {
    const adminId = req.user.userId;
    return this.adminService.deleteUser(adminId, userId, preserveHistory);
  }

  @Put(':id/promote')
  @ApiOperation({ summary: 'Promote user to admin (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async promoteToAdmin(@Req() req: any, @Param('id') userId: string) {
    const adminId = req.user.userId;
    return this.adminService.promoteToAdmin(adminId, userId);
  }

  @Put(':id/demote')
  @ApiOperation({ summary: 'Demote user from admin (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async demoteFromAdmin(@Req() req: any, @Param('id') userId: string) {
    const adminId = req.user.userId;
    return this.adminService.demoteFromAdmin(adminId, userId);
  }
}
