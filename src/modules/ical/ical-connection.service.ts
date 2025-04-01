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
    userId: string,
  ) {
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
      status: ConnectionStatus.ACTIVE, // Set initial status to active since validation passed
      ...createICalConnectionDto,
      user_id:userId
    });

    const savedConnection = await newConnection.save();
    
    return {
      success: true,
      data: savedConnection,
      meta: {
        property_id: propertyId,
        platform: savedConnection.platform,
        status: savedConnection.status,
        created_at: savedConnection.created_at || new Date(),
      },
      message: `Successfully created iCal connection for ${savedConnection.platform}`,
      timestamp: new Date().toISOString(),
    };
  }

  async findAllByProperty(propertyId: string) {
    const connections = await this.icalConnectionModel.find({ property_id: propertyId }).exec();
    
    // Group connections by status
    const statusCounts = connections.reduce((acc, conn) => {
      acc[conn.status] = (acc[conn.status] || 0) + 1;
      return acc;
    }, {});
    
    // Group connections by platform
    const platformCounts = connections.reduce((acc, conn) => {
      acc[conn.platform] = (acc[conn.platform] || 0) + 1;
      return acc;
    }, {});
    
    return {
      success: true,
      data: connections,
      meta: {
        property_id: propertyId,
        total: connections.length,
        status_breakdown: statusCounts,
        platform_breakdown: platformCounts,
        active_connections: connections.filter(c => c.status === ConnectionStatus.ACTIVE).length,
      },
      message: connections.length > 0 
        ? `Retrieved ${connections.length} iCal connections for property ${propertyId}` 
        : `No iCal connections found for property ${propertyId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async findOne(propertyId: string, connectionId: string) {
    const connection = await this.icalConnectionModel
      .findOne({
        _id: connectionId,
        property_id: propertyId,
      })
      .exec();

    if (!connection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }

    // Calculate days since last sync if applicable
    let daysSinceLastSync: number | undefined;
    if (connection.last_synced) {
      const lastSyncDate = new Date(connection.last_synced);
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate.getTime() - lastSyncDate.getTime());
      daysSinceLastSync = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      success: true,
      data: connection,
      meta: {
        property_id: propertyId,
        connection_id: connectionId,
        platform: connection.platform,
        status: connection.status,
        days_since_last_sync: daysSinceLastSync,
        is_active: connection.is_active !== false, // Default to true if not specified
      },
      message: `Successfully retrieved iCal connection for ${connection.platform}`,
      timestamp: new Date().toISOString(),
    };
  }

  async update(
    propertyId: string,
    connectionId: string,
    updateICalConnectionDto: UpdateICalConnectionDto,
  ) {
    // If URL is being updated, validate it
    if (updateICalConnectionDto.ical_url) {
      try {
        await this.icalService.validateICalUrl(updateICalConnectionDto.ical_url);
        // If URL validation passes, update status to active
        updateICalConnectionDto.status = ConnectionStatus.ACTIVE;
        updateICalConnectionDto.error_message = null;
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

    // Identify what fields were updated
    const updatedFields = Object.keys(updateICalConnectionDto);
    
    return {
      success: true,
      data: updatedConnection,
      meta: {
        property_id: propertyId,
        connection_id: connectionId,
        platform: updatedConnection.platform,
        status: updatedConnection.status,
        updated_fields: updatedFields,
        updated_at: new Date(),
      },
      message: `Successfully updated iCal connection for ${updatedConnection.platform}`,
      timestamp: new Date().toISOString(),
    };
  }
  
  async remove(propertyId: string, connectionId: string, preserve_history: boolean = false) {
    let connection;
    let actionTaken;
    
    if (preserve_history) {
      connection = await this.icalConnectionModel
        .findOneAndUpdate(
          { _id: connectionId, property_id: propertyId },
          { is_active: false },
          { new: true }
        )
        .exec();
      
      actionTaken = 'deactivated';
    } else {
      connection = await this.icalConnectionModel
        .findOneAndDelete({ _id: connectionId, property_id: propertyId })
        .exec();
      
      actionTaken = 'permanently deleted';
    }
    
    if (!connection) {
      throw new NotFoundException(`iCal connection with ID ${connectionId} not found`);
    }
    
    return {
      success: true,
      data: connection,
      meta: {
        property_id: propertyId,
        connection_id: connectionId,
        platform: connection.platform,
        preserve_history,
        action: actionTaken,
      },
      message: `iCal connection for ${connection.platform} has been ${actionTaken} successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  async testConnection(propertyId: string, connectionId: string) {
    const connectionResult = await this.findOne(propertyId, connectionId);
    const connection = connectionResult.data;
  
    try {
      await this.icalService.validateICalUrl(connection.ical_url);
      
      // Update connection status
      const updatedConnection = await this.icalConnectionModel
        .findOneAndUpdate(
          { _id: connectionId },
          { 
            status: ConnectionStatus.ACTIVE,
            error_message: null,
            last_sync_at: new Date()
          },
          { new: true }
        )
        .exec();
      
      return {
        success: true,
        data: {
          valid: true,
          connection: updatedConnection
        },
        meta: {
          property_id: propertyId,
          connection_id: connectionId,
          platform: connection.platform,
          status: ConnectionStatus.ACTIVE,
          tested_at: new Date(),
        },
        message: `iCal connection for ${connection.platform} is valid and accessible`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Update connection status
      const updatedConnection = await this.icalConnectionModel
        .findOneAndUpdate(
          { _id: connectionId },
          { 
            status: ConnectionStatus.ERROR,
            error_message: error.message,
            last_sync_at: new Date()
          },
          { new: true }
        )
        .exec();
      
      return {
        success: false,
        data: {
          valid: false,
          connection: updatedConnection,
          error: error.message
        },
        meta: {
          property_id: propertyId,
          connection_id: connectionId,
          platform: connection.platform,
          status: ConnectionStatus.ERROR,
          tested_at: new Date(),
        },
        message: `Error validating iCal connection for ${connection.platform}: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
