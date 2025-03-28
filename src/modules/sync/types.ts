import { Types } from 'mongoose';
import { EventStatus } from 'src/common/types';

// Define interfaces for the result objects
export interface SyncResult {
    property_id: Types.ObjectId | string;
    platform: string;
    success: boolean;
    events_synced?: number;
    error?: string;
}

export interface PropertySyncResult {
    platform: string;
    success: boolean;
    events_synced?: number;
    error?: string;
}

// Define interface for calendar event data
export interface CalendarEventData {
    ical_uid: string;
    summary: string;
    description?: string;
    start_date: Date;
    end_date: Date;
    status: EventStatus;
    event_type?: string;
    [key: string]: any; // For any additional properties
}
