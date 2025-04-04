import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { Property, PropertySchema } from './schemas/property.schema';
import { UploadService } from '../../common/services/upload.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
    ]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [PropertyController],
  providers: [PropertyService, UploadService],
  exports: [PropertyService],
})
export class PropertyModule {}
