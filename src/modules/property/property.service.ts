import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from './schemas/property.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class PropertyService {
    constructor(
        @InjectModel(Property.name) private propertyModel: Model<Property>,
    ) { }

    async create(createPropertyDto: CreatePropertyDto, userId: string): Promise<any> {
        try {
            const createdProperty = new this.propertyModel({
                ...createPropertyDto,
                user_id: userId,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true
            });
            
            const savedProperty = await createdProperty.save();
            
            return {
                success: true,
                data: {
                    property: savedProperty,
                    meta: {
                        property_id: savedProperty._id,
                        created_at: savedProperty.created_at,
                        property_type: savedProperty.property_type,
                        location: savedProperty.address ? 
                            `${savedProperty.address.city}, ${savedProperty.address.country}` : 
                            'Location not specified'
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

            console.log("USER ID ===>",userId)
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

                console.log("DATA ===>",data)
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

            return {
                success: true,
                data: {
                    properties: data.map(property => ({
                        ...property.toObject(),
                        id: property._id,
                        location: property.address ? 
                            `${property.address.city}, ${property.address.country}` : 
                            'Location not specified',
                        days_since_creation: this.calculateDaysSinceCreation(property.created_at)
                    })),
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
                    ? `Retrieved ${data.length} properties (${total} total matches)`
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
            const includedRelations:any[] = [];

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

            return {
                success: true,
                data: {
                    property: {
                        ...property.toObject(),
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
                        last_updated: property.updated_at || property.created_at
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

    async update(id: string, updatePropertyDto: UpdatePropertyDto, userId: string): Promise<any> {
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
            
            // Add updated_at timestamp
            const updatedPropertyData = {
                ...updatePropertyDto,
                updated_at: new Date()
            };
            
            const updatedProperty = await this.propertyModel
                .findOneAndUpdate(
                    { _id: id, user_id: userId },
                    updatedPropertyData,
                    { new: true }
                )
                .exec();

            return {
                success: true,
                data: {
                    property: {
                        ...updatedProperty?.toObject(),
                        id: updatedProperty?._id
                    },
                    meta: {
                        property_id: updatedProperty,
                        updated_fields: updatedFields,
                        update_time: updatedProperty?.updated_at,
                        changes_count: updatedFields.length
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
                            'Location not specified'
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
}
