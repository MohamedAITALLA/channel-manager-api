// src/modules/audit/audit.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEntry } from './schemas/audit-entry.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditEntry.name) private auditEntryModel: Model<AuditEntry>,
  ) {}
  
  async createAuditEntry(data: {
    action: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    property_id?: string;
    details?: Record<string, any>;
  }): Promise<AuditEntry> {
    const newEntry = new this.auditEntryModel({
      ...data,
      created_at: new Date(),
    });
    
    return newEntry.save();
  }
  
  async getAuditTrail(
    filters: {
      entity_type?: string;
      entity_id?: string;
      user_id?: string;
      property_id?: string;
      action?: string;
      start_date?: Date;
      end_date?: Date;
    },
    page = 1,
    limit = 20
  ): Promise<{ entries: AuditEntry[]; total: number; page: number; limit: number }> {
    const query: Record<string, any> = {};
    
    if (filters.entity_type) query.entity_type = filters.entity_type;
    if (filters.entity_id) query.entity_id = filters.entity_id;
    if (filters.user_id) query.user_id = filters.user_id;
    if (filters.property_id) query.property_id = filters.property_id;
    if (filters.action) query.action = filters.action;
    
    if (filters.start_date || filters.end_date) {
      query.created_at = {};
      if (filters.start_date) query.created_at.$gte = filters.start_date;
      if (filters.end_date) query.created_at.$lte = filters.end_date;
    }
    
    const skip = (page - 1) * limit;
    
    const [entries, total] = await Promise.all([
      this.auditEntryModel
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditEntryModel.countDocuments(query).exec(),
    ]);
    
    return {
      entries,
      total,
      page,
      limit,
    };
  }
}
