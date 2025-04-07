// src/modules/calendar/admin-conflict.service.ts
import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conflict } from './schemas/conflict.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminConflictService {
  constructor(
    @InjectModel(Conflict.name) private conflictModel: Model<Conflict>,
    @Inject(forwardRef(() => AuditService))
    private readonly auditService: AuditService,
  ) {}

  async getAllConflicts(
    page: number = 1,
    limit: number = 10,
    propertyId?: string,
    status?: string,
    conflictType?: string,
    severity?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (propertyId) query.property_id = propertyId;
    if (status) query.status = status;
    if (conflictType) query.conflict_type = conflictType;
    if (severity) query.severity = severity;

    const conflicts = await this.conflictModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 })
      .exec();

    const total = await this.conflictModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: conflicts,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: conflicts.length > 0
        ? `Successfully retrieved ${conflicts.length} conflicts`
        : 'No conflicts found matching the criteria',
    };
  }

  async getConflictById(conflictId: string) {
    const conflict = await this.conflictModel.findById(conflictId).exec();

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    return {
      success: true,
      data: conflict,
      message: 'Conflict retrieved successfully',
    };
  }

  async updateConflict(conflictId: string, updateConflictDto: any, adminId: string) {
    const conflict = await this.conflictModel.findById(conflictId).exec();

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: 'UPDATE',
      entity_type: 'Conflict',
      entity_id: conflictId,
      user_id: adminId,
      property_id: conflict.property_id.toString(),
      details: {
        before: conflict.toObject(),
        changes: updateConflictDto,
      },
    });

    const updatedConflict = await this.conflictModel
      .findByIdAndUpdate(conflictId, updateConflictDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedConflict,
      message: 'Conflict updated successfully',
    };
  }

  async deleteConflict(conflictId: string, adminId: string) {
    const conflict = await this.conflictModel.findById(conflictId).exec();

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    // Create audit entry before deletion
    await this.auditService.createAuditEntry({
      action: 'DELETE',
      entity_type: 'Conflict',
      entity_id: conflictId,
      user_id: adminId,
      property_id: conflict.property_id.toString(),
      details: {
        deleted_conflict: conflict.toObject(),
      },
    });

    await this.conflictModel.findByIdAndDelete(conflictId).exec();

    return {
      success: true,
      message: 'Conflict deleted successfully',
    };
  }

  async setConflictActiveStatus(conflictId: string, isActive: boolean, adminId: string) {
    const conflict = await this.conflictModel.findById(conflictId).exec();

    if (!conflict) {
      throw new NotFoundException('Conflict not found');
    }

    // Create audit entry before update
    await this.auditService.createAuditEntry({
      action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
      entity_type: 'Conflict',
      entity_id: conflictId,
      user_id: adminId,
      property_id: conflict.property_id.toString(),
      details: {
        before: { is_active: conflict.is_active },
        after: { is_active: isActive },
      },
    });

    const updatedConflict = await this.conflictModel
      .findByIdAndUpdate(conflictId, { is_active: isActive }, { new: true })
      .exec();

    return {
      success: true,
      data: updatedConflict,
      message: `Conflict ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }
}