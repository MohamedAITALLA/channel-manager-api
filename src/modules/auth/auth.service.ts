import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from './schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.userModel.findOne({ email }).exec();
      
      if (user && await bcrypt.compare(password, user.password)) {
        const { password, ...result } = user.toObject();
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('User validation error:', error);
      return null;
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid credentials',
          timestamp: new Date().toISOString(),
          error: {
            code: 'INVALID_CREDENTIALS',
            details: 'The provided email or password is incorrect'
          }
        };
      }

      // Check if user is active
      if (user.is_active === false) {
        return {
          success: false,
          message: 'Account is inactive',
          timestamp: new Date().toISOString(),
          error: {
            code: 'INACTIVE_ACCOUNT',
            details: 'This account has been deactivated'
          }
        };
      }
      
      const payload = { 
        email: user.email, 
        sub: user._id,
        is_admin: user.is_admin
      };
      
      const token = this.jwtService.sign(payload);
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Assuming 24h token validity
      
      // Update last login time
      await this.userModel.findByIdAndUpdate(user._id, { 
        $set: { last_login: new Date() } 
      });
      
      return {
        success: true,
        data: {
          access_token: token,
          token_type: 'Bearer',
          expires_at: tokenExpiry.toISOString(),
          user: {
            id: user._id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: `${user.first_name} ${user.last_name}`.trim(),
            is_admin: user.is_admin,
            created_at: user.created_at,
            updated_at: user.updated_at
          }
        },
        message: 'Login successful',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new UnauthorizedException({
        success: false,
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
        error: {
          code: 'AUTH_ERROR',
          details: 'An error occurred during authentication'
        }
      });
    }
  }

  async register(registerDto: RegisterDto, createdById?: string) {
    try {
      const { email, password, first_name, last_name} = registerDto;
      
      // Input validation
      if (!email || !password || !first_name) {
        return {
          success: false,
          message: 'Missing required fields',
          timestamp: new Date().toISOString(),
          error: {
            code: 'VALIDATION_ERROR',
            details: 'Email, password, and first name are required'
          }
        };
      }
      
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          message: 'Invalid email format',
          timestamp: new Date().toISOString(),
          error: {
            code: 'INVALID_EMAIL',
            details: 'Please provide a valid email address'
          }
        };
      }
      
      // Password strength validation
      if (password.length < 8) {
        return {
          success: false,
          message: 'Password too weak',
          timestamp: new Date().toISOString(),
          error: {
            code: 'WEAK_PASSWORD',
            details: 'Password must be at least 8 characters long'
          }
        };
      }
      
      // Check if user already exists
      const existingUser = await this.userModel.findOne({ email }).exec();
      
      if (existingUser) {
        return {
          success: false,
          message: 'Email already registered',
          timestamp: new Date().toISOString(),
          error: {
            code: 'EMAIL_EXISTS',
            details: 'This email address is already in use'
          }
        };
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create new user
      const newUser = new this.userModel({
        email,
        password: hashedPassword,
        first_name,
        last_name,
        created_by: createdById || null
      });
      
      const savedUser = await newUser.save();
      
      const { password: _, ...result } = savedUser.toObject();
      
      // Generate token for auto-login
      const payload = { 
        email: result.email, 
        sub: result._id,
        is_admin: result.is_admin
      };
      
      const token = this.jwtService.sign(payload);
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Assuming 24h token validity
      
      return {
        success: true,
        data: {
          user: {
            id: result._id,
            email: result.email,
            first_name: result.first_name,
            last_name: result.last_name,
            full_name: `${result.first_name} ${result.last_name}`.trim(),
            is_admin: result.is_admin,
            is_active: result.is_active,
            created_at: result.created_at,
            updated_at: result.updated_at,
            created_by: result.created_by
          },
          access_token: token,
          token_type: 'Bearer',
          expires_at: tokenExpiry.toISOString()
        },
        message: 'Registration successful',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw new BadRequestException({
        success: false,
        message: 'Registration failed',
        timestamp: new Date().toISOString(),
        error: {
          code: 'REGISTRATION_ERROR',
          details: 'An error occurred during registration'
        }
      });
    }
  }
  
  async verifyToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userModel.findById(decoded.sub).exec();
      
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
          error: {
            code: 'USER_NOT_FOUND',
            details: 'The user associated with this token no longer exists'
          }
        };
      }
      
      if (user.is_active === false) {
        return {
          success: false,
          message: 'Account is inactive',
          timestamp: new Date().toISOString(),
          error: {
            code: 'INACTIVE_ACCOUNT',
            details: 'This account has been deactivated'
          }
        };
      }
      
      const { password, ...result } = user.toObject();
      
      return {
        success: true,
        data: {
          user: {
            id: result._id,
            email: result.email,
            first_name: result.first_name,
            last_name: result.last_name,
            full_name: `${result.first_name} ${result.last_name}`.trim(),
            is_admin: result.is_admin,
            created_at: result.created_at,
            updated_at: result.updated_at
          },
          token_info: {
            issued_at: new Date(decoded.iat * 1000).toISOString(),
            expires_at: new Date(decoded.exp * 1000).toISOString(),
            is_valid: true
          }
        },
        message: 'Token is valid',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          message: 'Token expired',
          timestamp: new Date().toISOString(),
          error: {
            code: 'TOKEN_EXPIRED',
            details: 'The authentication token has expired'
          }
        };
      }
      
      return {
        success: false,
        message: 'Invalid token',
        timestamp: new Date().toISOString(),
        error: {
          code: 'INVALID_TOKEN',
          details: 'The authentication token is invalid or malformed'
        }
      };
    }
  }
  
  async refreshToken(oldToken: string) {
    try {
      const decoded = this.jwtService.verify(oldToken);
      const user = await this.userModel.findById(decoded.sub).exec();
      
      if (!user || user.is_active === false) {
        return {
          success: false,
          message: 'Invalid or inactive user',
          timestamp: new Date().toISOString(),
          error: {
            code: 'INVALID_USER',
            details: 'Cannot refresh token for invalid or inactive user'
          }
        };
      }
      
      const payload = { 
        email: user.email, 
        sub: user._id,
        is_admin: user.is_admin
      };
      
      const newToken = this.jwtService.sign(payload);
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Assuming 24h token validity
      
      return {
        success: true,
        data: {
          access_token: newToken,
          token_type: 'Bearer',
          expires_at: tokenExpiry.toISOString(),
          user: {
            id: user._id,
            email: user.email,
            is_admin: user.is_admin
          }
        },
        message: 'Token refreshed successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to refresh token',
        timestamp: new Date().toISOString(),
        error: {
          code: 'REFRESH_FAILED',
          details: 'The token could not be refreshed'
        }
      };
    }
  }
  
  async createAdminUser(registerDto: RegisterDto, creatorId?: string) {
    try {
      // Force is_admin to true for this method
      const adminData = {
        ...registerDto,
        is_admin: true
      };
      
      return this.register(adminData, creatorId);
    } catch (error) {
      console.error('Admin creation error:', error);
      throw new BadRequestException({
        success: false,
        message: 'Admin creation failed',
        timestamp: new Date().toISOString(),
        error: {
          code: 'ADMIN_CREATION_ERROR',
          details: 'An error occurred while creating admin user'
        }
      });
    }
  }
  
  async deactivateUser(userId: string, adminId: string) {
    try {
      // Check if admin exists and is really an admin
      const admin = await this.userModel.findById(adminId).exec();
      
      if (!admin || !admin.is_admin) {
        return {
          success: false,
          message: 'Unauthorized action',
          timestamp: new Date().toISOString(),
          error: {
            code: 'UNAUTHORIZED',
            details: 'Only administrators can deactivate users'
          }
        };
      }
      
      // Check if user exists
      const user = await this.userModel.findById(userId).exec();
      
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
          error: {
            code: 'USER_NOT_FOUND',
            details: 'The user to deactivate does not exist'
          }
        };
      }
      
      // Prevent deactivating yourself
      if (userId === adminId) {
        return {
          success: false,
          message: 'Self-deactivation not allowed',
          timestamp: new Date().toISOString(),
          error: {
            code: 'SELF_DEACTIVATION',
            details: 'Administrators cannot deactivate their own accounts'
          }
        };
      }
      
      // Deactivate user
      user.is_active = false;
      await user.save();
      
      return {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            is_active: false
          },
          deactivated_by: {
            id: admin._id,
            email: admin.email
          }
        },
        message: 'User deactivated successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('User deactivation error:', error);
      throw new BadRequestException({
        success: false,
        message: 'User deactivation failed',
        timestamp: new Date().toISOString(),
        error: {
          code: 'DEACTIVATION_ERROR',
          details: 'An error occurred while deactivating user'
        }
      });
    }
  }
  
  async activateUser(userId: string, adminId: string) {
    try {
      // Check if admin exists and is really an admin
      const admin = await this.userModel.findById(adminId).exec();
      
      if (!admin || !admin.is_admin) {
        return {
          success: false,
          message: 'Unauthorized action',
          timestamp: new Date().toISOString(),
          error: {
            code: 'UNAUTHORIZED',
            details: 'Only administrators can activate users'
          }
        };
      }
      
      // Check if user exists
      const user = await this.userModel.findById(userId).exec();
      
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
          error: {
            code: 'USER_NOT_FOUND',
            details: 'The user to activate does not exist'
          }
        };
      }
      
      // Activate user
      user.is_active = true;
      await user.save();
      
      return {
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            is_active: true
          },
          activated_by: {
            id: admin._id,
            email: admin.email
          }
        },
        message: 'User activated successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('User activation error:', error);
      throw new BadRequestException({
        success: false,
        message: 'User activation failed',
        timestamp: new Date().toISOString(),
        error: {
          code: 'ACTIVATION_ERROR',
          details: 'An error occurred while activating user'
        }
      });
    }
  }
}
