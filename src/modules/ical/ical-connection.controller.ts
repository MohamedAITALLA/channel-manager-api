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
    constructor(private readonly icalConnectionService: ICalConnectionService) {}
  
    @Get()
    @ApiOperation({ summary: 'List all iCal connections for a property' })
    async findAll(@Param('propertyId') propertyId: string) {
      return this.icalConnectionService.findAllByProperty(propertyId);
    }
  
    @Post()
    @ApiOperation({ summary: 'Add a new iCal URL for a platform with validation' })
    async create(
      @Param('propertyId') propertyId: string,
      @Body() createICalConnectionDto: CreateICalConnectionDto,
    ) {
      return this.icalConnectionService.create(propertyId, createICalConnectionDto);
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
    async remove(
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
      @Query('preserve_history') preserveHistory?: boolean
    ) {
      return this.icalConnectionService.remove(propertyId,connectionId,preserveHistory);
    }
  
    @Post(':connectionId/test')
    @ApiOperation({ summary: 'Test an iCal connection for validity' })
    async test(
      @Param('propertyId') propertyId: string,
      @Param('connectionId') connectionId: string,
    ) {
      return this.icalConnectionService.testConnection(propertyId, connectionId);
    }
  }
  