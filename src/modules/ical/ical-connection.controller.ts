import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
    UseGuards,
    Query,
    Req,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
  import { ICalConnectionService } from './ical-connection.service';
  import { CreateICalConnectionDto } from './dto/create-ical-connection.dto';
  import { UpdateICalConnectionDto } from './dto/update-ical-connection.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @ApiTags('iCal Connections')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Controller('properties/:propertyId/ical-connections')
  export class ICalConnectionController {
    constructor(
      private readonly icalConnectionService: ICalConnectionService
    ) {}
  
    @Get()
    @ApiOperation({ summary: 'List all iCal connections for a property' })
    async findAll(@Param('propertyId') propertyId: string) {
      return this.icalConnectionService.findAllByProperty(propertyId);
    }
  
    @Post()
    @ApiOperation({ summary: 'Add a new iCal URL for a platform with validation' })
    async create(
      @Req() req: any,
      @Param('propertyId') propertyId: string,
      @Body() createICalConnectionDto: CreateICalConnectionDto,
    ) {
      const userId = req.user.userId;
      return this.icalConnectionService.create(propertyId, createICalConnectionDto ,userId);
    }
  
    @Get(':connectionId')
    @ApiOperation({ summary: 'Retrieve details of a specific iCal connection' })
    async findOne(
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
    ) {
      return this.icalConnectionService.findOne(propertyId, connectionId);
    }
  
    @Put(':connectionId')
    @ApiOperation({ summary: 'Update an iCal connection (URL, sync frequency, etc.)' })
    async update(
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
      @Body() updateICalConnectionDto: UpdateICalConnectionDto,
    ) {
      return this.icalConnectionService.update(
        propertyId,
        connectionId,
        updateICalConnectionDto,
      );
    }
  

    @Delete(':connectionId')
    @ApiOperation({ summary: 'Remove an iCal connection' })
    @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
    @ApiQuery({ 
      name: 'event_action', 
      required: false, 
      enum: ['delete', 'deactivate', 'convert', 'keep'],
      description: 'Action to take on associated events: delete, deactivate, convert to manual, or keep unchanged'
    })
    async remove(
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
      @Query('preserve_history') preserveHistory?: boolean,
      @Query('event_action') eventAction?: 'delete' | 'deactivate' | 'convert' | 'keep'
    ) {
      return this.icalConnectionService.remove(
        propertyId,
        connectionId,
        preserveHistory,
        eventAction || 'keep'
      );
    }
    @Post(':connectionId/test')
    @ApiOperation({ summary: 'Test an iCal connection for validity' })
    async test(
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
    ) {
      return this.icalConnectionService.testConnection(propertyId, connectionId);
    }

    @Post(':connectionId/sync')
    @ApiOperation({ summary: 'Sync a specific iCal connection' })
    async syncConnection(
      @Req() req: any,
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
    ) {
      const userId = req.user.userId;
      return this.icalConnectionService.syncSingleConnection(propertyId, connectionId, userId);
    }
  }
  