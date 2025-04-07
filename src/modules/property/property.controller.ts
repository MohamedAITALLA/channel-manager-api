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
          this.logger.debug(` [CONTROLLER] PROCESSING DELETE IMAGES: ${deleteImagesString}`);
          try {
            // Try to parse the string
            const parsedData = JSON.parse(deleteImagesString);
            
            // Check if it's already an array
            if (Array.isArray(parsedData)) {
              deleteImages = parsedData;
              this.logger.debug(` [CONTROLLER] VALID ARRAY WITH ${deleteImages.length} ITEMS`);
            } 
            // Check if it's a string that needs to be parsed again (double-encoded JSON)
            else if (typeof parsedData === 'string') {
              try {
                const reParsed = JSON.parse(parsedData);
                if (Array.isArray(reParsed)) {
                  deleteImages = reParsed;
                  this.logger.debug(` [CONTROLLER] DOUBLE-ENCODED JSON ARRAY WITH ${deleteImages.length} ITEMS`);
                }
              } catch {
                // If re-parsing fails, treat the original parsed data as a single URL
                deleteImages = [parsedData];
                this.logger.debug(` [CONTROLLER] TREATING AS SINGLE URL`);
              }
            }
            // If it's neither an array nor a string that can be parsed as an array,
            // but it's a string that looks like a URL, treat it as a single URL
            else if (typeof parsedData === 'string' && parsedData.startsWith('http')) {
              deleteImages = [parsedData];
              this.logger.debug(` [CONTROLLER] TREATING AS SINGLE URL STRING`);
            }
            // Otherwise, keep it empty
            else {
              this.logger.debug(` [CONTROLLER] INVALID FORMAT, USING EMPTY ARRAY`);
              deleteImages = [];
            }
          } catch (error) {
            this.logger.debug(` [CONTROLLER] PARSE ERROR: ${error.message}`);
            
            // If parsing fails but the string looks like a URL, treat it as a single URL
            if (deleteImagesString.includes('http') && deleteImagesString.includes('blob.vercel-storage.com')) {
              // Try to clean up the string if it has extra quotes or escapes
              const cleanedString = deleteImagesString.replace(/^"|"$/g, '').replace(/\\/g, '');
              deleteImages = [cleanedString];
              this.logger.debug(` [CONTROLLER] TREATING RAW STRING AS URL`);
            } else {
              deleteImages = [];
            }
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
  