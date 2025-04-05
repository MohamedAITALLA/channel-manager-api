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
    UploadedFiles,
    UseInterceptors,
    BadRequestException,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
  import { PropertyService } from './property.service';
  import { CreatePropertyDto } from './dto/create-property.dto';
  import { UpdatePropertyDto } from './dto/update-property.dto';
  import { PaginationDto } from '../../common/dto/pagination.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
  
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
    @ApiConsumes('multipart/form-data')
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          property: {
            type: 'string',
            description: 'JSON string of the property data',
          },
          images: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary',
            },
          },
        },
      },
    })
    @UseInterceptors(FilesInterceptor('images', 10, {
      storage: memoryStorage(), // This is crucial - use memory storage
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return callback(new BadRequestException('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }))
    async create(
      @Req() req: any,
      @Body('property') propertyString: string,
      @UploadedFiles() images: Array<Express.Multer.File>,
    ) {
      // Parse the property data from string to object
      const createPropertyDto: CreatePropertyDto = JSON.parse(propertyString);
      const userId = req.user.userId;
      return this.propertyService.create(createPropertyDto, userId, images);
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
    @ApiConsumes('multipart/form-data')
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          property: {
            type: 'string',
            description: 'JSON string of the property data to update',
          },
          images: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary',
            },
            description: 'New images to upload',
          },
          deleteImages: {
            type: 'string',
            description: 'JSON array of image URLs to delete',
          },
        },
        required: ['property'],
      },
    })
    @UseInterceptors(FilesInterceptor('images', 10, {
      storage: memoryStorage(), // This is crucial - use memory storage
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          return callback(new BadRequestException('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
    }))
    async update(
      @Req() req: any,
      @Param('id') id: string,
      @Body('property') propertyString: string,
      @Body('deleteImages') deleteImagesString: string,
      @UploadedFiles() images: Array<Express.Multer.File>,
    ) {
      // Parse the property data from string to object
      const updatePropertyDto: UpdatePropertyDto = propertyString ? JSON.parse(propertyString) : {};
      
      // Parse the deleteImages array if provided
      const deleteImages: string[] = deleteImagesString ? JSON.parse(deleteImagesString) : [];
      
      const userId = req.user.userId;
      return this.propertyService.update(id, updatePropertyDto, userId, images, deleteImages);
    }
    
  
    @Delete(':id')
    @ApiOperation({ summary: 'Remove a property from the system (with option to preserve historical data)' })
    @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
    async remove(@Req() req: any, @Param('id') id: string, @Query('preserve_history') preserveHistory?: boolean) {
      const userId = req.user.userId;
      return this.propertyService.remove(id, userId, preserveHistory);
    }
  }
  