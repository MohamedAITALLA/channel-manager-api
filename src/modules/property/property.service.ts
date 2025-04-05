import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from './schemas/property.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UploadService } from 'src/common/services/upload.service';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs-extra';
import { Logger } from '@nestjs/common';


@Injectable()
export class PropertyService {
    constructor(
        @InjectModel(Property.name) private propertyModel: Model<Property>,
        private readonly uploadService: UploadService,
    ) {

        // Log the current working directory to help with debugging
        console.log(`Current working directory: ${process.cwd()}`);
        console.log(`Uploads directory: ${join(process.cwd(), 'uploads')}`);

    }

    private readonly logger = new Logger(PropertyService.name);

    async create(
        createPropertyDto: CreatePropertyDto,
        userId: string,
        images: Array<Express.Multer.File>=[],
    ): Promise<any> {
        try {
            // First create the property to get an ID
            const createdProperty = new this.propertyModel({
                ...createPropertyDto,
                user_id: userId,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true,
                images: [], // Initialize with empty array
            });

            const savedProperty = await createdProperty.save();

            // If images are provided, save them and update the property
            if (images && images.length > 0) {
                try {
                    const imageUrls = await Promise.all(
                        images.map(async (image) => {
                            try {
                                return await this.uploadService.savePropertyImage(image, savedProperty._id!.toString());
                            } catch (err) {
                                console.error(`Failed to save individual image: ${err.message}`);
                                return null;
                            }
                        })
                    );

                    // Filter out any null values from failed uploads
                    const validImageUrls = imageUrls.filter(url => url !== null) as string[];

                    // Update the property with image URLs
                    savedProperty.images = validImageUrls;
                    await savedProperty.save();
                } catch (imageError) {
                    console.error(`Error processing images: ${imageError.message}`);
                    // Continue with the property creation even if image processing fails
                }
            }

            // Transform the property object for response
            const propertyObj = savedProperty.toObject();

            // Transform image URLs to be ready for display
            if (propertyObj.images && propertyObj.images.length > 0) {
                propertyObj.images = this.transformImageUrls(propertyObj.images);
            }

            return {
                success: true,
                data: {
                    property: {
                        ...propertyObj,
                        id: savedProperty._id
                    },
                    meta: {
                        property_id: savedProperty._id,
                        created_at: savedProperty.created_at,
                        property_type: savedProperty.property_type,
                        location: savedProperty.address ?
                            `${savedProperty.address.city}, ${savedProperty.address.country}` :
                            'Location not specified',
                        images_count: savedProperty.images.length,
                    }
                },
                message: `Property "${savedProperty.name}" created successfully`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to create property',
                details: {
                    message: error.message,
                    property_name: createPropertyDto.name,
                    property_type: createPropertyDto.property_type
                },
                timestamp: new Date().toISOString()
            };
        }
    }



    async findAll(
        paginationDto: PaginationDto,
        filters: { propertyType?: string; city?: string; sort?: string },
        userId: string,
    ): Promise<any> {
        try {
            // Convert page and limit to numbers and provide defaults
            const page = Number(paginationDto.page) || 1;
            const limit = Number(paginationDto.limit) || 10;
            const skip = (page - 1) * limit;

            // Build query
            const query: Record<string, any> = { user_id: userId, is_active: true };

            if (filters.propertyType) {
                query.property_type = filters.propertyType;
            }

            if (filters.city) {
                query['address.city'] = { $regex: new RegExp(filters.city, 'i') };
            }

            // Build sort
            let sortOptions: Record<string, 1 | -1> = {};
            if (filters.sort) {
                const [field, order] = filters.sort.split(':');
                sortOptions[field] = order === 'desc' ? -1 : 1;
            } else {
                sortOptions = { created_at: -1 };
            }

            // Execute query
            const data = await this.propertyModel
                .find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await this.propertyModel.countDocuments(query).exec();

            // Get property type counts for summary
            const propertyTypeCounts = await this.propertyModel.aggregate([
                { $match: { user_id: userId, is_active: true } },
                { $group: { _id: "$property_type", count: { $sum: 1 } } }
            ]).exec();

            const propertyTypeCountsMap = propertyTypeCounts.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {});

            // Get city counts for summary
            const cityCounts = await this.propertyModel.aggregate([
                { $match: { user_id: userId, is_active: true } },
                { $group: { _id: "$address.city", count: { $sum: 1 } } }
            ]).exec();

            const cityCountsMap = cityCounts.reduce((acc, curr) => {
                if (curr._id) {
                    acc[curr._id] = curr.count;
                }
                return acc;
            }, {});

            // Transform properties with image URLs
            const transformedProperties = data.map(property => {
                const propertyObj = property.toObject();

                // Transform image URLs to be ready for display
                if (propertyObj.images && propertyObj.images.length > 0) {
                    propertyObj.images = this.transformImageUrls(propertyObj.images);
                }

                return {
                    ...propertyObj,
                    id: propertyObj._id,
                    location: propertyObj.address ?
                        `${propertyObj.address.city}, ${propertyObj.address.country}` :
                        'Location not specified',
                    days_since_creation: this.calculateDaysSinceCreation(propertyObj.created_at)
                };
            });

            return {
                success: true,
                data: {
                    properties: transformedProperties,
                    pagination: {
                        total,
                        page,
                        limit,
                        pages: Math.ceil(total / limit),
                        has_next_page: page * limit < total,
                        has_previous_page: page > 1
                    },
                    summary: {
                        total_properties: total,
                        by_property_type: propertyTypeCountsMap,
                        by_city: cityCountsMap,
                        applied_filters: {
                            property_type: filters.propertyType || 'All',
                            city: filters.city || 'All',
                            sort: filters.sort || 'created_at:desc'
                        }
                    }
                },
                message: total > 0
                    ? `Retrieved ${transformedProperties.length} properties (${total} total matches)`
                    : 'No properties found matching the criteria',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to fetch properties',
                details: {
                    message: error.message,
                    filters: filters,
                    pagination: paginationDto
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    private calculateDaysSinceCreation(createdAt: Date): number {
        if (!createdAt) return 0;
        const now = new Date();
        const diffMs = now.getTime() - new Date(createdAt).getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    async findOne(id: string, userId: string, include?: string): Promise<any> {
        try {
            let query = this.propertyModel.findOne({ _id: id, user_id: userId });

            // Track what's being included for metadata
            const includedRelations: any[] = [];

            if (include) {
                const includes = include.split(',');
                if (includes.includes('ical_connections')) {
                    // Note: In a real implementation, you would populate related collections
                    // This is a placeholder for the concept
                    // query = query.populate('icalConnections');
                    includedRelations.push('ical_connections');
                }
            }

            const property = await query.exec();

            if (!property) {
                return {
                    success: false,
                    error: 'Property not found',
                    details: {
                        property_id: id,
                        user_id: userId
                    },
                    timestamp: new Date().toISOString()
                };
            }

            const propertyObj = property.toObject();

            // Transform image URLs to be ready for display
            if (propertyObj.images && propertyObj.images.length > 0) {
                propertyObj.images = this.transformImageUrls(propertyObj.images);
            }

            return {
                success: true,
                data: {
                    property: {
                        ...propertyObj,
                        id: property._id,
                        location: property.address ?
                            `${property.address.city}, ${property.address.country}` :
                            'Location not specified',
                        days_since_creation: this.calculateDaysSinceCreation(property.created_at)
                    },
                    meta: {
                        included_relations: includedRelations,
                        property_id: property._id,
                        property_type: property.property_type,
                        last_updated: property.updated_at || property.created_at,
                        images_count: propertyObj.images?.length || 0
                    }
                },
                message: `Property "${property.name}" retrieved successfully`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to retrieve property',
                details: {
                    message: error.message,
                    property_id: id,
                    include: include
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    async update(
        id: string,
        updatePropertyDto: UpdatePropertyDto,
        userId: string,
        images: Array<Express.Multer.File>=[],
        deleteImages: string[]=[],
    ): Promise<any> {
        try {
            // Find the property first to get the original state
            const originalProperty = await this.propertyModel.findOne({ _id: id, user_id: userId }).exec();

            if (!originalProperty) {
                return {
                    success: false,
                    error: 'Property not found',
                    details: {
                        property_id: id,
                        user_id: userId
                    },
                    timestamp: new Date().toISOString()
                };
            }

            // Track which fields are being updated
            const updatedFields = Object.keys(updatePropertyDto).filter(
                key => JSON.stringify(originalProperty[key]) !== JSON.stringify(updatePropertyDto[key])
            );

            // Handle image deletions if specified
            if (deleteImages && deleteImages.length > 0) {
                // Filter out the images to be deleted
                originalProperty.images = originalProperty.images.filter(url => !deleteImages.includes(url));
                updatedFields.push('images');

                // Delete the actual files from the file system
                deleteImages.forEach(imageUrl => {
                    try {
                        if (!imageUrl) {
                            console.warn('Skipping undefined image URL');
                            return;
                        }

                        // Normalize path handling based on how imageUrl is stored
                        let imagePath;
                        if (imageUrl.startsWith('/uploads/')) {
                            // If URL starts with /uploads/, remove the leading slash
                            imagePath = join(process.cwd(), imageUrl.substring(1));
                        } else if (imageUrl.startsWith('uploads/')) {
                            // If URL starts with uploads/ (no leading slash)
                            imagePath = join(process.cwd(), imageUrl);
                        } else {
                            // If URL is just the filename or another format
                            imagePath = join(process.cwd(), 'uploads', imageUrl);
                        }

                        console.log(`Attempting to delete file: ${imagePath}`);

                        if (existsSync(imagePath)) {
                            unlinkSync(imagePath);
                            console.log(`Successfully deleted file: ${imagePath}`);
                        } else {
                            console.warn(`File not found: ${imagePath}`);
                        }
                    } catch (err) {
                        console.error(`Failed to delete image file: ${err.message}`);
                    }
                });
            }



            // Handle new image uploads if provided
            if (images && images.length > 0) {
                const newImageUrls = await Promise.all(
                    images.map(image =>
                        this.uploadService.savePropertyImage(image, id)
                    )
                );

                // Add new image URLs to the existing ones
                originalProperty.images = [...originalProperty.images, ...newImageUrls];
                if (!updatedFields.includes('images')) {
                    updatedFields.push('images');
                }
            }

            // Add updated_at timestamp
            const updatedPropertyData = {
                ...updatePropertyDto,
                images: originalProperty.images,
                updated_at: new Date()
            };

            const updatedProperty = await this.propertyModel
                .findOneAndUpdate(
                    { _id: id, user_id: userId },
                    updatedPropertyData,
                    { new: true }
                )
                .exec();

            // Transform the property object for response
            const propertyObj = updatedProperty?.toObject();

            // Transform image URLs to be ready for display
            if (propertyObj?.images && propertyObj.images.length > 0) {
                propertyObj.images = this.transformImageUrls(propertyObj.images);
            }

            return {
                success: true,
                data: {
                    property: {
                        ...propertyObj,
                        id: updatedProperty?._id
                    },
                    meta: {
                        property_id: updatedProperty?._id,
                        updated_fields: updatedFields,
                        update_time: updatedProperty?.updated_at,
                        changes_count: updatedFields.length,
                        images_count: updatedProperty?.images?.length || 0,
                        images_added: images?.length || 0,
                        images_deleted: deleteImages?.length || 0
                    }
                },
                message: updatedFields.length > 0
                    ? `Property "${updatedProperty?.name}" updated successfully (${updatedFields.join(', ')})`
                    : `No changes made to property "${updatedProperty?.name}"`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to update property',
                details: {
                    message: error.message,
                    property_id: id,
                    attempted_updates: Object.keys(updatePropertyDto)
                },
                timestamp: new Date().toISOString()
            };
        }
    }


    async remove(id: string, userId: string, preserveHistory = false): Promise<any> {
        try {
            let property;
            let action;

            if (preserveHistory) {
                property = await this.propertyModel
                    .findOneAndUpdate(
                        { _id: id, user_id: userId },
                        {
                            is_active: false,
                            deactivated_at: new Date(),
                            updated_at: new Date()
                        },
                        { new: true }
                    )
                    .exec();
                action = 'deactivated';
            } else {
                property = await this.propertyModel
                    .findOneAndDelete({ _id: id, user_id: userId })
                    .exec();

                // Delete all property images if permanently deleting the property
                if (property) {
                    await this.deletePropertyImages(id);
                }

                action = 'deleted';
            }

            if (!property) {
                return {
                    success: false,
                    error: 'Property not found',
                    details: {
                        property_id: id,
                        user_id: userId,
                        preserve_history: preserveHistory
                    },
                    timestamp: new Date().toISOString()
                };
            }

            return {
                success: true,
                data: {
                    property: {
                        id: property._id,
                        name: property.name,
                        property_type: property.property_type,
                        location: property.address ?
                            `${property.address.city}, ${property.address.country}` :
                            'Location not specified',
                        images_count: property.images?.length || 0
                    },
                    meta: {
                        action: preserveHistory ? 'deactivate' : 'delete',
                        preserve_history: preserveHistory,
                        property_id: property._id.toString(),
                        action_time: new Date()
                    }
                },
                message: `Property "${property.name}" ${action} successfully`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to ${preserveHistory ? 'deactivate' : 'delete'} property`,
                details: {
                    message: error.message,
                    property_id: id,
                    preserve_history: preserveHistory
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    private async deletePropertyImages(propertyId: string): Promise<void> {
        try {
            // Get the property to access its images
            const property = await this.propertyModel.findById(propertyId).exec();
            if (!property || !property.images || property.images.length === 0) {
                console.log(`No images to delete for property ${propertyId}`);
                return;
            }

            console.log(`Deleting ${property.images.length} images for property ${propertyId}`);

            // Delete each image file
            for (const imageUrl of property.images) {
                try {
                    if (!imageUrl) {
                        console.warn('Skipping undefined image URL');
                        continue;
                    }

                    // Normalize path handling based on how imageUrl is stored
                    let imagePath;
                    if (imageUrl.startsWith('/uploads/')) {
                        // If URL starts with /uploads/, remove the leading slash
                        imagePath = join(process.cwd(), imageUrl.substring(1));
                    } else if (imageUrl.startsWith('uploads/')) {
                        // If URL starts with uploads/ (no leading slash)
                        imagePath = join(process.cwd(), imageUrl);
                    } else {
                        // If URL is just the filename or another format
                        imagePath = join(process.cwd(), 'uploads', imageUrl);
                    }

                    console.log(`Attempting to delete file: ${imagePath}`);

                    if (existsSync(imagePath)) {
                        unlinkSync(imagePath);
                        console.log(`Successfully deleted file: ${imagePath}`);
                    } else {
                        console.warn(`File not found: ${imagePath}`);
                    }
                } catch (err) {
                    console.error(`Failed to delete image file: ${err.message}`);
                }
            }

            // Optionally, try to remove the property directory
            try {
                const propertyDir = join(process.cwd(), 'uploads', 'property-images', propertyId);
                if (existsSync(propertyDir)) {
                    // Use rimraf or fs-extra to delete directory with content
                    const fs = require('fs-extra');
                    fs.removeSync(propertyDir);
                    console.log(`Successfully deleted property directory: ${propertyDir}`);
                } else {
                    console.log(`Property directory not found: ${propertyDir}`);
                }
            } catch (err) {
                console.error(`Failed to delete property image directory: ${err.message}`);
            }
        } catch (error) {
            console.error(`Error deleting property images: ${error.message}`);
        }
    }

    private transformImageUrls(images: string[] | undefined): string[] {
        this.logger.debug(`Transforming image URLs: ${JSON.stringify(images)}`);
        if (!images || !Array.isArray(images) || images.length === 0) {
            return [];
        }

        return images.map(imageUrl => {
            if (!imageUrl) {
                console.warn('Skipping undefined image URL in transformation');
                return '';
            }

            // Ensure the URL starts with a slash for consistency
            return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        }).filter(url => url);
    }

}
