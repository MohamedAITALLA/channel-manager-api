// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from '../email/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('confirm-email')
  @ApiOperation({ summary: 'Confirm user email address' })
  async confirmEmail(@Query('token') token: string) {
    return this.authService.confirmEmail(token);
  }

  @Post('resend-confirmation')
  @ApiOperation({ summary: 'Resend confirmation email' })
  async resendConfirmation(@Body() { email }: { email: string }) {
    return this.authService.resendConfirmationEmail(email);
  }

  @Get('test-email')
  @ApiOperation({ summary: 'Test email configuration' })
  async testEmail() {
    const result = await this.emailService.testEmailConfiguration();
    return {
      success: result,
      message: result ? 'Test email sent successfully' : 'Failed to send test email',
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token, 
      resetPasswordDto.newPassword
    );
  }

  @Get('validate-reset-token/:token')
  @ApiOperation({ summary: 'Validate password reset token' })
  async validateResetToken(@Param('token') token: string) {
    return this.authService.validateResetToken(token);
  }
}
