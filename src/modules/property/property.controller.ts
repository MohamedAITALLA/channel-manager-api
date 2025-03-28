import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Put,
    Delete,
    Query,
    UseGuards,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
  import { PropertyService } from './property.service';
  import { CreatePropertyDto } from './dto/create-property.dto';
  import { UpdatePropertyDto } from './dto/update-property.dto';
  import { PaginationDto } from '../../common/dto/pagination.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @ApiTags('Properties')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Controller('properties')
  export class PropertyController {
    constructor(private readonly propertyService: PropertyService) {}
  
    @Get()
    @ApiOperation({ summary: 'Retrieve all properties with pagination, filtering, and sorting options' })
    @ApiQuery({ name: 'property_type', required: false })
    @ApiQuery({ name: 'city', required: false })
    @ApiQuery({ name: 'sort', required: false })
    async findAll(
      @Query() paginationDto: PaginationDto,
      @Query('property_type') propertyType?: string,
      @Query('city') city?: string,
      @Query('sort') sort?: string,
    ) {
      return this.propertyService.findAll(paginationDto, { propertyType, city, sort });
    }
  
    @Post()
    @ApiOperation({ summary: 'Create a new property with standardized attributes' })
    async create(@Body() createPropertyDto: CreatePropertyDto) {
      return this.propertyService.create(createPropertyDto);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Retrieve a specific property by ID with optional inclusion of related data' })
    @ApiQuery({ name: 'include', required: false })
    async findOne(@Param('id') id: string, @Query('include') include?: string) {
      return this.propertyService.findOne(id, include);
    }
  
    @Put(':id')
    @ApiOperation({ summary: "Update a property's standardized information" })
    async update(@Param('id') id: string, @Body() updatePropertyDto: UpdatePropertyDto) {
      return this.propertyService.update(id, updatePropertyDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Remove a property from the system (with option to preserve historical data)' })
    @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
    async remove(@Param('id') id: string, @Query('preserve_history') preserveHistory?: boolean) {
      return this.propertyService.remove(id, preserveHistory);
    }
  }
  