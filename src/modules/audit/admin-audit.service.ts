// src/modules/audit/admin-audit.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEntry } from './schemas/audit-entry.schema';

@Injectable()
export class AdminAuditService {
  constructor(
    @InjectModel(AuditEntry.name) private auditEntryModel: Model<AuditEntry>,
  ) {}

  async getAllAuditEntries(
    page: number = 1,
    limit: number = 10,
    userId?: string,
    propertyId?: string,
    entityType?: string,
    entityId?: string,
    action?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (userId) query.user_id = userId;
    if (propertyId) query.property_id = propertyId;
    if (entityType) query.entity_type = entityType;
    if (entityId) query.entity_id = entityId;
    if (action) query.action = action;
    
    // Date range filter
    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }

    const auditEntries = await this.auditEntryModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ created_at: -1 })
      .exec();

    const total = await this.auditEntryModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: auditEntries,
      meta: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: auditEntries.length > 0
        ? `Successfully retrieved ${auditEntries.length} audit entries`
        : 'No audit entries found matching the criteria',
    };
  }

  async getAuditEntryById(auditEntryId: string) {
    const auditEntry = await this.auditEntryModel.findById(auditEntryId).exec();

    if (!auditEntry) {
      throw new NotFoundException('Audit entry not found');
    }

    return {
      success: true,
      data: auditEntry,
      message: 'Audit entry retrieved successfully',
    };
  }

  async updateAuditEntry(auditEntryId: string, updateAuditEntryDto: any, adminId: string) {
    const auditEntry = await this.auditEntryModel.findById(auditEntryId).exec();

    if (!auditEntry) {
      throw new NotFoundException('Audit entry not found');
    }

    // Create a meta-audit entry for this audit update
    const metaAudit = new this.auditEntryModel({
      action: 'UPDATE_AUDIT',
      entity_type: 'AuditEntry',
      entity_id: auditEntryId,
      user_id: adminId,
      property_id: auditEntry.property_id,
      details: {
        before: auditEntry.toObject(),
        changes: updateAuditEntryDto,
      },
      created_at: new Date(),
    });
    await metaAudit.save();

    const updatedAuditEntry = await this.auditEntryModel
      .findByIdAndUpdate(auditEntryId, updateAuditEntryDto, { new: true })
      .exec();

    return {
      success: true,
      data: updatedAuditEntry,
      message: 'Audit entry updated successfully',
    };
  }

  async deleteAuditEntry(auditEntryId: string, adminId: string) {
    const auditEntry = await this.auditEntryModel.findById(auditEntryId).exec();

    if (!auditEntry) {
      throw new NotFoundException('Audit entry not found');
    }

    // Create a meta-audit entry for this audit deletion
    const metaAudit = new this.auditEntryModel({
      action: 'DELETE_AUDIT',
      entity_type: 'AuditEntry',
      entity_id: auditEntryId,
      user_id: adminId,
      property_id: auditEntry.property_id,
      details: {
        deleted_audit_entry: auditEntry.toObject(),
      },
      created_at: new Date(),
    });
    await metaAudit.save();

    await this.auditEntryModel.findByIdAndDelete(auditEntryId).exec();

    return {
      success: true,
      message: 'Audit entry deleted successfully',
    };
  }
}