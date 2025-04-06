// src/modules/ical/admin-ical-connection.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICalConnection } from './schemas/ical-connection.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminICalConnectionService {
  constructor(
    @InjectModel(ICalConnection.name) private icalConnectionModel: Model<ICalConnection>,
    private readonly auditService: AuditService,
  ) {}

  async getAllConnections(
    page: number = 1,
    limit: number = 10,
    propertyId?: string,
    userId?: string,
    platform?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (propertyId) query.property_id = propertyId;
    if (userId) query.user_id = userId;
    if (platform) query.platform = platform;
    if (status) query.status = status;

    const connections = await this.icalConnectionModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 })
      .exec();

    const total = await this.icalConnectionModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: connections,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: connections.length > 0
        ? `Successfully retrieved ${connections.length} iCal connections`
        : 'No iCal connections found matching the criteria',
    };
  }

  async getConnectionById(connectionId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('iCal connection not found');
    }

    return {
      success: true,
      data: connection,
      message: 'iCal connection retrieved successfully',
    };
  }

  async updateConnection(connectionId: string, updateConnectionDto: any, adminId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('iCal connection not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: 'UPDATE',
      entity_type: 'ICalConnection',
      entity_id: connectionId,
      user_id: adminId,
      property_id: connection.property_id.toString(),
      details: {
        before: connection.toObject(),
        changes: updateConnectionDto,
      },
    });

    const updatedConnection = await this.icalConnectionModel
      .findByIdAndUpdate(connectionId, updateConnectionDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedConnection,
      message: 'iCal connection updated successfully',
    };
  }

  async deleteConnection(connectionId: string, adminId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('iCal connection not found');
    }

    // Create audit entry before deletion
    await this.auditService.createAuditEntry({
      action: 'DELETE',
      entity_type: 'ICalConnection',
      entity_id: connectionId,
      user_id: adminId,
      property_id: connection.property_id.toString(),
      details: {
        deleted_connection: connection.toObject(),
      },
    });

    await this.icalConnectionModel.findByIdAndDelete(connectionId).exec();

    return {
      success: true,
      message: 'iCal connection deleted successfully',
    };
  }

  async setConnectionActiveStatus(connectionId: string, isActive: boolean, adminId: string) {
    const connection = await this.icalConnectionModel.findById(connectionId).exec();

    if (!connection) {
      throw new NotFoundException('iCal connection not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity_type: 'ICalConnection',
      entity_id: connectionId,
      user_id: adminId,
      property_id: connection.property_id.toString(),
      details: {
        before: { is_active: connection.is_active },
        after: { is_active: isActive },
      },
    });

    const updatedConnection = await this.icalConnectionModel
      .findByIdAndUpdate(connectionId, { is_active: isActive }, { new: true })
      .exec();

    return {
      success: true,
      data: updatedConnection,
      message: `iCal connection ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}