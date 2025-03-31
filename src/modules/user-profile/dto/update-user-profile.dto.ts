import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class PreferencesDto {
  @ApiProperty({ required: false, description: 'User interface theme preference' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({ required: false, description: 'User interface language preference' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false, description: 'User timezone preference' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false, description: 'Date format preference' })
  @IsOptional()
  @IsString()
  date_format?: string;

  @ApiProperty({ required: false, description: 'Time format preference' })
  @IsOptional()
  @IsString()
  time_format?: string;

  @ApiProperty({ required: false, description: 'Currency preference' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false, description: 'Enable or disable notifications' })
  @IsOptional()
  @IsBoolean()
  notifications_enabled?: boolean;
}

class ContactInfoDto {
  @ApiProperty({ required: false, description: 'User phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, description: 'User address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, description: 'User city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false, description: 'User state/province' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ required: false, description: 'User country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false, description: 'User postal code' })
  @IsOptional()
  @IsString()
  postal_code?: string;
}

export class UpdateUserProfileDto {
  @ApiProperty({ required: false, type: PreferencesDto, description: 'User preferences settings' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;

  @ApiProperty({ required: false, type: ContactInfoDto, description: 'User contact information' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contact_info?: ContactInfoDto;

  @ApiProperty({ required: false, description: 'Whether user has completed onboarding' })
  @IsOptional()
  @IsBoolean()
  onboarding_completed?: boolean;
}