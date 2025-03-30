# Multi-Platform Property Management API

A RESTful API that integrates with multiple booking platforms (Airbnb, Booking, Expedia, TripAdvisor, Vrbo) exclusively via publicly available iCalendar URLs, using standardized attributes common across all platforms for consistent property management.

## Features

- **iCal-Based Integration**: Synchronizes calendars from multiple booking platforms using only iCal URLs
- **Standardized Property Management**: Centralized property data storage with standardized cross-platform attributes
- **Event Monitoring**: Comprehensive monitoring system for calendar events across platforms
- **Conflict Detection**: Automatically detects booking conflicts between different platforms
- **Notification System**: Real-time notifications for bookings, changes, and conflicts

## Tech Stack

- **Framework**: NestJS
- **Database**: MongoDB
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator and class-transformer

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB (v4+)
- npm or yarn

### Installation

1. Clone the repository
