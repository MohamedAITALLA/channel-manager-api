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
    Logger,
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
    private readonly logger = new Logger(PropertyController.name);

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
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Name of the property"
                  },
                  desc: {
                    type: "string",
                    description: "Description of the property"
                  },
                  property_type: {
                    type: "string",
                    enum: ["APARTMENT", "HOUSE", "ROOM", "HOTEL", "CABIN", "VILLA"],
                    description: "Type of the property"
                  },
                  address: {
                    type: "object",
                    properties: {
                      street: {
                        type: "string"
                      },
                      city: {
                        type: "string"
                      },
                      state_province: {
                        type: "string"
                      },
                      postal_code: {
                        type: "string"
                      },
                      country: {
                        type: "string"
                      },
                      coordinates: {
                        type: "object",
                        properties: {
                          latitude: {
                            type: "number"
                          },
                          longitude: {
                            type: "number"
                          }
                        }
                      }
                    },
                    required: ["street", "city", "state_province", "postal_code", "country"]
                  },
                  accommodates: {
                    type: "number",
                    minimum: 1,
                    description: "Number of people the property can accommodate"
                  },
                  bedrooms: {
                    type: "number",
                    minimum: 0,
                    description: "Number of bedrooms"
                  },
                  beds: {
                    type: "number",
                    minimum: 0,
                    description: "Number of beds"
                  },
                  bathrooms: {
                    type: "number",
                    minimum: 0,
                    description: "Number of bathrooms"
                  },
                  amenities: {
                    type: "object",
                    properties: {
                      wifi: {
                        type: "boolean",
                        default: false
                      },
                      kitchen: {
                        type: "boolean",
                        default: false
                      },
                      ac: {
                        type: "boolean",
                        default: false
                      },
                      heating: {
                        type: "boolean",
                        default: false
                      },
                      tv: {
                        type: "boolean",
                        default: false
                      },
                      washer: {
                        type: "boolean",
                        default: false
                      },
                      dryer: {
                        type: "boolean",
                        default: false
                      },
                      parking: {
                        type: "boolean",
                        default: false
                      },
                      elevator: {
                        type: "boolean",
                        default: false
                      },
                      pool: {
                        type: "boolean",
                        default: false
                      }
                    }
                  },
                  policies: {
                    type: "object",
                    properties: {
                      check_in_time: {
                        type: "string",
                        pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
                        default: "15:00"
                      },
                      check_out_time: {
                        type: "string",
                        pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
                        default: "11:00"
                      },
                      minimum_stay: {
                        type: "number",
                        minimum: 1,
                        default: 1
                      },
                      pets_allowed: {
                        type: "boolean",
                        default: false
                      },
                      smoking_allowed: {
                        type: "boolean",
                        default: false
                      }
                    }
                  }
                },
                required: ["name", "desc", "property_type", "address", "accommodates", "bedrooms", "beds", "bathrooms"],
                description: "JSON string of the property data"
              },
          images: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary',
            },
            description: 'Images to upload (optional)',
          },
        },
        required: ['property'], // Only property is required
      },
    })
    @UseInterceptors(FilesInterceptor('images', 10, {
      storage: memoryStorage(),
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
      @UploadedFiles() images?: Array<Express.Multer.File>,
    ) {
      try {
        // Parse the property data from string to object
        const createPropertyDto: CreatePropertyDto = JSON.parse(propertyString);
        const userId = req.user.userId;
        return this.propertyService.create(createPropertyDto, userId, images || []);
      } catch (error) {
        throw new BadRequestException(`Failed to process create request: ${error.message}`);
      }
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
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Name of the property"
                  },
                  desc: {
                    type: "string",
                    description: "Description of the property"
                  },
                  property_type: {
                    type: "string",
                    enum: ["APARTMENT", "HOUSE", "ROOM", "HOTEL", "CABIN", "VILLA"],
                    description: "Type of the property"
                  },
                  address: {
                    type: "object",
                    properties: {
                      street: {
                        type: "string"
                      },
                      city: {
                        type: "string"
                      },
                      state_province: {
                        type: "string"
                      },
                      postal_code: {
                        type: "string"
                      },
                      country: {
                        type: "string"
                      },
                      coordinates: {
                        type: "object",
                        properties: {
                          latitude: {
                            type: "number"
                          },
                          longitude: {
                            type: "number"
                          }
                        }
                      }
                    },
                    required: ["street", "city", "state_province", "postal_code", "country"]
                  },
                  accommodates: {
                    type: "number",
                    minimum: 1,
                    description: "Number of people the property can accommodate"
                  },
                  bedrooms: {
                    type: "number",
                    minimum: 0,
                    description: "Number of bedrooms"
                  },
                  beds: {
                    type: "number",
                    minimum: 0,
                    description: "Number of beds"
                  },
                  bathrooms: {
                    type: "number",
                    minimum: 0,
                    description: "Number of bathrooms"
                  },
                  amenities: {
                    type: "object",
                    properties: {
                      wifi: {
                        type: "boolean",
                        default: false
                      },
                      kitchen: {
                        type: "boolean",
                        default: false
                      },
                      ac: {
                        type: "boolean",
                        default: false
                      },
                      heating: {
                        type: "boolean",
                        default: false
                      },
                      tv: {
                        type: "boolean",
                        default: false
                      },
                      washer: {
                        type: "boolean",
                        default: false
                      },
                      dryer: {
                        type: "boolean",
                        default: false
                      },
                      parking: {
                        type: "boolean",
                        default: false
                      },
                      elevator: {
                        type: "boolean",
                        default: false
                      },
                      pool: {
                        type: "boolean",
                        default: false
                      }
                    }
                  },
                  policies: {
                    type: "object",
                    properties: {
                      check_in_time: {
                        type: "string",
                        pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
                        default: "15:00"
                      },
                      check_out_time: {
                        type: "string",
                        pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
                        default: "11:00"
                      },
                      minimum_stay: {
                        type: "number",
                        minimum: 1,
                        default: 1
                      },
                      pets_allowed: {
                        type: "boolean",
                        default: false
                      },
                      smoking_allowed: {
                        type: "boolean",
                        default: false
                      }
                    }
                  }
                },
                required: ["name", "desc", "property_type", "address", "accommodates", "bedrooms", "beds", "bathrooms"],
                description: "JSON string of the property data"
              },
          images: {
            type: 'array',
            items: {
              type: 'string',
              format: 'binary',
            },
            description: 'New images to upload (optional)',
          },
          deleteImages: {
            type: 'string',
            description: 'JSON array of image URLs to delete (optional)',
          },
        },
        required: ['property'], // Only property is required
      },
    })
    @UseInterceptors(FilesInterceptor('images', 10, {
      storage: memoryStorage(),
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
      @Body('deleteImages') deleteImagesString?: string,
      @UploadedFiles() images?: Array<Express.Multer.File>,
    ) {
      try {
        // Parse the property data from string to object
        const updatePropertyDto: UpdatePropertyDto = propertyString ? JSON.parse(propertyString) : {};
        this.logger.debug(` [CONTROLLER] IMAGES TO DELETE: ${deleteImagesString}`);

        // Parse the deleteImages array if provided, otherwise use empty array
        let deleteImages: string[] = [];
        
        if (deleteImagesString) {
          this.logger.debug(` [CONTROLLER] INSIDE THE IF BLOCK: ${deleteImagesString}`);
          try {
            deleteImages = JSON.parse(deleteImagesString);
            if (!Array.isArray(deleteImages)) {
              this.logger.debug(` [CONTROLLER] IRESET TO EMPTY BLOCK: ${deleteImagesString}`);
              deleteImages = []; // Reset to empty array if not valid
            }
          } catch (error) {
            this.logger.debug(` [CONTROLLER] CATCH ERROR BLOCK: ${error.message}`);

            // If parsing fails, just use empty array
            deleteImages = [];
          }
        }
        
        const userId = req.user.userId;
        return this.propertyService.update(id, updatePropertyDto, userId, images || [], deleteImages);
      } catch (error) {
        throw new BadRequestException(`Failed to process update request: ${error.message}`);
      }
    }
    
    @Delete(':id')
    @ApiOperation({ summary: 'Remove a property from the system (with option to preserve historical data)' })
    @ApiQuery({ name: 'preserve_history', required: false, type: Boolean })
    async remove(@Req() req: any, @Param('id') id: string, @Query('preserve_history') preserveHistory?: boolean) {
      const userId = req.user.userId;
      return this.propertyService.remove(id, userId, preserveHistory);
    }
  }
  