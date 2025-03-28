import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICalConnection } from './schemas/ical-connection.schema';
import { CreateICalConnectionDto } from './dto/create-ical-connection.dto';
import { UpdateICalConnectionDto } from './dto/update-ical-connection.dto';
import { IcalService } from './ical.service';
import { ConnectionStatus } from '../../common/types';

@Injectable()
export class ICalConnectionService {
  constructor(
    @InjectModel(ICalConnection.name) private icalConnectionModel: Model<ICalConnection>,
    private readonly icalService: IcalService,
  ) {}

  async create(
    propertyId: string,
    createICalConnectionDto: CreateICalConnectionDto,
  ): Promise<ICalConnection> {
    // Check if connection with this platform already exists for the property
    const existingConnection = await this.icalConnectionModel.findOne({
      property_id: propertyId,
      platform: createICalConnectionDto.platform,
    });

    if (existingConnection) {
      throw new BadRequestException(
        `A connection for ${createICalConnectionDto.platform} already exists for this property`,
      );
    }

    // Validate the iCal URL
    try {
      await this.icalService.validateICalUrl(createICalConnectionDto.ical_url);
    } catch (error) {
      throw new BadRequestException(`Invalid iCal URL: ${error.message}`);
    }

    const newConnection = new this.icalConnectionModel({
      property_id: propertyId,
      ...createICalConnectionDto,
    });

    return newConnection.save();
  }

  async findAllByProperty(propertyId: string): Promise<ICalConnection[]> {
    return this.icalConnectionModel.find({ property_id: propertyId }).exec();
  }

  async findOne(propertyId: string, connectionId: string): Promise<ICalConnection> {
    const connection = await this.icalConnectionModel
      .findOne({
        _id: connectionId,
        property_id: propertyId,
      })
      .exec();

    if (!connection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }

    return connection;
  }

  async update(
    propertyId: string,
    connectionId: string,
    updateICalConnectionDto: UpdateICalConnectionDto,
  ): Promise<ICalConnection> {
    // If URL is being updated, validate it
    if (updateICalConnectionDto.ical_url) {
      try {
        await this.icalService.validateICalUrl(updateICalConnectionDto.ical_url);
      } catch (error) {
        throw new BadRequestException(`Invalid iCal URL: ${error.message}`);
      }
    }

    const updatedConnection = await this.icalConnectionModel
      .findOneAndUpdate(
        {
          _id: connectionId,
          property_id: propertyId,
        },
        updateICalConnectionDto,
        { new: true },
      )
      .exec();

    if (!updatedConnection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }

    return updatedConnection;
  }

  async remove(propertyId: string, connectionId: string): Promise<void> {
    const result = await this.icalConnectionModel
      .deleteOne({
        _id: connectionId,
        property_id: propertyId,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }
  }

  async testConnection(propertyId: string, connectionId: string): Promise<{ valid: boolean; message: string }> {
    const connection = await this.findOne(propertyId, connectionId);
  
    try {
      await this.icalService.validateICalUrl(connection.ical_url);
      
      // Update connection status
      await this.icalConnectionModel
        .updateOne(
          { _id: connectionId },
          { 
            status: ConnectionStatus.ACTIVE,
            error_message: null
          }
        )
        .exec();
      
      return {
        valid: true,
        message: 'iCal URL is valid and accessible',
      };
    } catch (error) {
      // Update connection status
      await this.icalConnectionModel
        .updateOne(
          { _id: connectionId },
          { 
            status: ConnectionStatus.ERROR,
            error_message: error.message
          }
        )
        .exec();
      
      return {
        valid: false,
        message: `Error validating iCal URL: ${error.message}`,
      };
    }
  }
}  