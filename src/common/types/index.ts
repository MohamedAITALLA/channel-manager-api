export enum PropertyType {
    APARTMENT = 'apartment',
    HOUSE = 'house',
    VILLA = 'villa',
    CONDO = 'condo',
    CABIN = 'cabin',
    OTHER = 'other',
  }
  
  export enum EventType {
    BOOKING = 'booking',
    BLOCKED = 'blocked',
    MAINTENANCE = 'maintenance',
  }
  
  export enum EventStatus {
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
    TENTATIVE = 'tentative',
  }
  
  export enum ConflictType {
    OVERLAP = 'overlap',
    ADJACENT = 'adjacent',
    TURNOVER = 'turnover',
  }
  
  export enum ConflictSeverity {
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low',
  }
  
  export enum ConflictStatus {
    NEW = 'new',
    ACKNOWLEDGED = 'acknowledged',
    RESOLVED = 'resolved',
  }
  
  export enum NotificationType {
    NEW_BOOKING = 'new_booking',
    MODIFIED_BOOKING = 'modified_booking',
    CANCELLED_BOOKING = 'cancelled_booking',
    BOOKING_CONFLICT = 'booking_conflict',
    SYNC_FAILURE = 'sync_failure',
  }
  
  export enum NotificationSeverity {
    CRITICAL = 'critical',
    WARNING = 'warning',
    INFO = 'info',
  }
  
  export enum Platform {
    AIRBNB = 'Airbnb',
    BOOKING = 'Booking',
    EXPEDIA = 'Expedia',
    TRIPADVISOR = 'TripAdvisor',
    VRBO = 'Vrbo',
    MANUAL = 'manual',
  }
  
  export enum ConnectionStatus {
    ACTIVE = 'active',
    ERROR = 'error',
    INACTIVE = 'inactive',
  }
  