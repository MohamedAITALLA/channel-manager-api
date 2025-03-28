import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ICalConnectionController } from './ical-connection.controller';
import { ICalConnectionService } from './ical-connection.service';
import { IcalService } from './ical.service';
import { ICalConnection, ICalConnectionSchema } from './schemas/ical-connection.schema';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    MongooseModule.forFeature([
      { name: ICalConnection.name, schema: ICalConnectionSchema },
    ]),
  ],
  controllers: [ICalConnectionController],
  providers: [ICalConnectionService, IcalService],
  exports: [ICalConnectionService, IcalService],
})
export class IcalModule {}
