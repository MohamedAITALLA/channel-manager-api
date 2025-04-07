// src/modules/property/admin-property.service.ts
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from './schemas/property.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminPropertyService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @Inject(forwardRef(() => AuditService))
    private readonly auditService: AuditService,
  ) {}

  async getAllProperties(
    page: number = 1,
    limit: number = 10,
    userId?: string,
    propertyType?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (userId) query.user_id = userId;
    if (propertyType) query.property_type = propertyType;
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { desc: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.country': { $regex: search, $options: 'i' } },
      ];
    }

    const properties = await this.propertyModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 })
      .exec();

    const total = await this.propertyModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: properties,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: properties.length > 0
        ? `Successfully retrieved ${properties.length} properties`
        : 'No properties found matching the criteria',
    };
  }

  async getPropertyById(propertyId: string) {
    const property = await this.propertyModel.findById(propertyId).exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return {
      success: true,
      data: property,
      message: 'Property retrieved successfully',
    };
  }

  async updateProperty(propertyId: string, updatePropertyDto: any, adminId: string) {
    const property = await this.propertyModel.findById(propertyId).exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: 'UPDATE',
      entity_type: 'Property',
      entity_id: propertyId,
      user_id: adminId,
      property_id: propertyId,
      details: {
        before: property.toObject(),
        changes: updatePropertyDto,
      },
    });

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(propertyId, updatePropertyDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedProperty,
      message: 'Property updated successfully',
    };
  }

  async deleteProperty(propertyId: string, adminId: string) {
    const property = await this.propertyModel.findById(propertyId).exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Create audit entry before deletion
    await this.auditService.createAuditEntry({
      action: 'DELETE',
      entity_type: 'Property',
      entity_id: propertyId,
      user_id: adminId,
      property_id: propertyId,
      details: {
        deleted_property: property.toObject(),
      },
    });

    await this.propertyModel.findByIdAndDelete(propertyId).exec();

    return {
      success: true,
      message: 'Property deleted successfully',
    };
  }

  async setPropertyActiveStatus(propertyId: string, isActive: boolean, adminId: string) {
    const property = await this.propertyModel.findById(propertyId).exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity_type: 'Property',
      entity_id: propertyId,
      user_id: adminId,
      property_id: propertyId,
      details: {
        before: { is_active: property.is_active },
        after: { is_active: isActive },
      },
    });

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(propertyId, { is_active: isActive }, { new: true })
      .exec();

    return {
      success: true,
      data: updatedProperty,
      message: `Property ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}