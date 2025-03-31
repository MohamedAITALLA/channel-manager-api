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
    Req,
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
      @Req() req: any,
      @Query() paginationDto: PaginationDto,
      @Query('property_type') propertyType?: string,
      @Query('city') city?: string,
      @Query('sort') sort?: string,
    ) {
      const userId = req.user.userId;
      return this.propertyService.findAll(paginationDto, { propertyType, city, sort }, userId);
    }
  
    @Post()
    @ApiOperation({ summary: 'Create a new property with standardized attributes' })
    async create(@Req() req: any, @Body() createPropertyDto: CreatePropertyDto) {
      const userId = req.user.userId;
      return this.propertyService.create(createPropertyDto, userId);
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Retrieve a specific property by ID with optional inclusion of related data' })
    @ApiQuery({ name: 'include', required: false })
    async findOne(@Req() req: any, @Param('id') id: string, @Query('include') include?: string) {
      const userId = req.user.userId;
      return this.propertyService.findOne(id, userId, include);
    }
  
    @Put(':id')
    @ApiOperation({ summary: "Update a property's standardized information" })
    async update(@Req() req: any, @Param('id') id: string, @Body() updatePropertyDto: UpdatePropertyDto) {
      const userId = req.user.userId;
      return this.propertyService.update(id, updatePropertyDto, userId);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Remove a property from the system (with option to preserve historical data)' })
    @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
    async remove(@Req() req: any, @Param('id') id: string, @Query('preserve_history') preserveHistory?: boolean) {
      const userId = req.user.userId;
      return this.propertyService.remove(id, userId, preserveHistory);
    }
  }
  