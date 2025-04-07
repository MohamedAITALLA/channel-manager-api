import { forwardRef, Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { AdminPropertyController } from './admin-property.controller';
import { AdminPropertyService } from './admin-property.service';
import { Property, PropertySchema } from './schemas/property.schema';
import { UploadService } from '../../common/services/upload.service';
import { MulterModule } from '@nestjs/platform-express';
import { Model } from'mongoose';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
    ]),
    MulterModule.register({
      dest: './uploads',
    }),
    forwardRef(() => AuditModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PropertyController, AdminPropertyController],
  providers: [PropertyService, AdminPropertyService, UploadService,  {
    provide: Property,
    useFactory: (propertyModel: Model<Property>) => propertyModel,
    inject: [getModelToken(Property.name)],
  },],
  exports: [PropertyService, AdminPropertyService, Property],
})
export class PropertyModule {}
