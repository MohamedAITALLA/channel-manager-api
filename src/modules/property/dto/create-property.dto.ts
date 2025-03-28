import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsNumber,
  Min,
  ValidateNested,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUrl,
  Matches,
} from 'class-validator';
import { PropertyType } from '../../../common/types';

class CoordinatesDto {
  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;
}

class AddressDto {
  @ApiProperty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  state_province: string;

  @ApiProperty()
  @IsString()
  postal_code: string;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;
}

class AmenitiesDto {
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  wifi?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  kitchen?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  ac?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  heating?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  tv?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  washer?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  dryer?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  parking?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  elevator?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  pool?: boolean;
}

class PoliciesDto {
  @ApiProperty({ required: false, default: '15:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Check-in time must be in 24h format (e.g., 15:00)',
  })
  check_in_time?: string;

  @ApiProperty({ required: false, default: '11:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Check-out time must be in 24h format (e.g., 11:00)',
  })
  check_out_time?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimum_stay?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  pets_allowed?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  smoking_allowed?: boolean;
}

export class CreatePropertyDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  property_type: PropertyType;

  @ApiProperty()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  accommodates: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  bedrooms: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  beds: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  bathrooms: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AmenitiesDto)
  amenities?: AmenitiesDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PoliciesDto)
  policies?: PoliciesDto;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[];
}
