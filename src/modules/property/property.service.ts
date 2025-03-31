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

    async create(createPropertyDto: CreatePropertyDto, userId: string): Promise<Property> {
        const createdProperty = new this.propertyModel({
            ...createPropertyDto,
            user_id: userId
        });
        return createdProperty.save();
    }

    async findAll(
        paginationDto: PaginationDto,
        filters: { propertyType?: string; city?: string; sort?: string },
        userId: string,
    ): Promise<{ data: Property[]; total: number; page: number; limit: number }> {
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

        const data = await this.propertyModel
            .find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .exec();

        const total = await this.propertyModel.countDocuments(query).exec();

        return {
            data,
            total,
            page,
            limit,
        };
    }


    async findOne(id: string, userId: string, include?: string): Promise<Property> {
        let query = this.propertyModel.findOne({ _id: id, user_id: userId });

        if (include) {
            const includes = include.split(',');
            if (includes.includes('ical_connections')) {
                // Note: In a real implementation, you would populate related collections
                // This is a placeholder for the concept
                // query = query.populate('icalConnections');
            }
        }

        const property = await query.exec();

        if (!property) {
            throw new NotFoundException(`Property with ID ${id} not found`);
        }

        return property;
    }

    async update(id: string, updatePropertyDto: UpdatePropertyDto, userId: string): Promise<Property> {
        const updatedProperty = await this.propertyModel
            .findOneAndUpdate(
                { _id: id, user_id: userId },
                updatePropertyDto,
                { new: true }
            )
            .exec();

        if (!updatedProperty) {
            throw new NotFoundException(`Property with ID ${id} not found`);
        }

        return updatedProperty;
    }

    async remove(id: string, userId: string, preserveHistory = false): Promise<Property> {
        if (preserveHistory) {
            const property = await this.propertyModel
                .findOneAndUpdate({ _id: id, user_id: userId }, { is_active: false }, { new: true })
                .exec();

            if (!property) {
                throw new NotFoundException(`Property with ID ${id} not found`);
            }
            return property;
        } else {
            const property = await this.propertyModel.findOneAndDelete({ _id: id, user_id: userId }).exec();
            if (!property) {
                throw new NotFoundException(`Property with ID ${id} not found`);
            }
            return property;
        }
    }
}
