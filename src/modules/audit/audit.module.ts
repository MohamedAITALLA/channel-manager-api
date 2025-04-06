// src/modules/audit/audit.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditController } from './admin-audit.controller';
import { AuditEntry, AuditEntrySchema } from './schemas/audit-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditEntry.name, schema: AuditEntrySchema },
    ]),
  ],
  controllers: [AdminAuditController],
  providers: [AuditService, AdminAuditService],
  exports: [AuditService, AdminAuditService],
})
export class AuditModule {}
