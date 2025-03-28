export default () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/property-management',
    },
    jwt: {
      // Fix: Add null coalescing for potentially undefined values
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    sync: {
      // Fix: Handle undefined before parsing
      defaultFrequency: parseInt(process.env.DEFAULT_SYNC_FREQUENCY || '60', 10),
    },
  });
  