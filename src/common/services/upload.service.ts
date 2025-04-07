import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { writeFile, existsSync, unlinkSync, mkdirSync, createWriteStream } from 'fs-extra';
import path, { join } from 'path';
import { put, del } from '@vercel/blob'; // Make sure to install @vercel/blob
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

@Injectable()
export class UploadService {
  private readonly isVercel: boolean;
  private readonly uploadDir: string;
  private readonly propertyImagesDir: string;
  private readonly profileImagesDir: string;
  private readonly baseUrl: string;
  private readonly logPrefix = '[UploadService]';

  constructor() {
    // Check if running in Vercel
    this.isVercel = process.env.VERCEL === '1';
    this.log('info', `Service initialized. Environment: ${this.isVercel ? 'Vercel' : 'Local'}`);

    // Set base URL for generating image URLs
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.log('debug', `Base URL set to: ${this.baseUrl}`);

    // Set up directories for local development
    this.uploadDir = join(process.cwd(), 'uploads');
    this.propertyImagesDir = join(this.uploadDir, 'property-images');
    this.profileImagesDir = join(this.uploadDir, 'profile-images');
    this.log('debug', `Upload directories configured: ${this.uploadDir}`);

    // Only create directories if not in Vercel
    if (!this.isVercel) {
      this.ensureDirectoryExists(this.uploadDir);
      this.ensureDirectoryExists(this.propertyImagesDir);
      this.ensureDirectoryExists(this.profileImagesDir);
      this.log('debug', 'Local directories created/verified');
    }
  }
  private readonly logger = new Logger(UploadService.name);

  /**
   * Ensures a directory exists, creating it if necessary
   * @param directory The directory path to check/create
   */
  private ensureDirectoryExists(directory: string): void {
    try {
      if (!existsSync(directory)) {
        this.log('debug', `Creating directory: ${directory}`);
        mkdirSync(directory, { recursive: true });
      } else {
        this.log('debug', `Directory already exists: ${directory}`);
      }
    } catch (error) {
      this.log('error', `Failed to create directory: ${directory}`, error);
      throw error;
    }
  }

  /**
   * Structured logging helper
   * @param level Log level: 'debug', 'info', 'warn', 'error'
   * @param message The message to log
   * @param error Optional error object for error logs
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `${this.logPrefix} [${timestamp}] [${level.toUpperCase()}] ${message}`;

    switch (level) {
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          //   console.debug(logMessage);
          this.logger.debug(logMessage);
        }
        break;
      case 'info':
        //  console.log(logMessage);
        this.logger.log(logMessage);
        break;
      case 'warn':
        // console.warn(logMessage);
        this.logger.warn(logMessage);
        break;
      case 'error':
        //  console.error(logMessage);
        this.logger.error(logMessage);
        if (error) {
          /*  console.error(`${this.logPrefix} Error details:`, error instanceof Error ? {
              message: error.message,
              stack: error.stack,
              name: error.name
            } : error);*/

          this.logger.error(`${this.logPrefix} Error details:`, error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : error);
        }
        break;
    }
  }
  /**
     * Saves a profile image to either local filesystem or Vercel Blob Storage
     * @param file The uploaded file
     * @param userId The user ID to associate with the image
     * @returns Promise<string> The URL or path to the saved image
     */
  async saveProfileImage(file: Express.Multer.File, userId: string): Promise<string> {
    const startTime = performance.now();
    const fileSize = file?.buffer?.length || 0;
    const fileType = file?.mimetype || 'unknown';
    const fileName = file?.originalname || 'unknown';

    try {
      if (!file) {
        this.log('error', `No file provided for user ${userId}`);
        throw new Error('No file provided');
      }

      this.log('info', `Saving profile image for user ${userId}`, {
        fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
        fileType,
        fileName
      });

      if (this.isVercel) {
        // For Vercel Blob Storage
        this.log('info', `Using Vercel Blob Storage for user ${userId}`);

        // Generate a unique filename
        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;

        // Define the blob path
        const blobPath = `profile-images/${userId}/${uniqueFilename}`;
        this.log('debug', `Generated blob path: ${blobPath}`);

        // Upload to Vercel Blob
        const blobStartTime = performance.now();
        const blob = await put(blobPath, file.buffer, {
          access: 'public',
          contentType: file.mimetype
        });
        const blobUploadTime = performance.now() - blobStartTime;

        this.log('info', `Successfully uploaded to Vercel Blob`, {
          url: blob.url,
          uploadTimeMs: blobUploadTime.toFixed(2),
          fileSize: `${(fileSize / 1024).toFixed(2)} KB`
        });

        const totalTime = performance.now() - startTime;
        this.log('debug', `Total profile image upload process took ${totalTime.toFixed(2)}ms`);
        return blob.url;
      } else {
        // For local filesystem
        this.log('info', `Using local filesystem for user ${userId}`);

        // Ensure the directory exists
        const uploadDir = join(process.cwd(), 'uploads', 'profile-images', userId);
        if (!existsSync(uploadDir)) {
          this.log('debug', `Creating user upload directory: ${uploadDir}`);
          mkdirSync(uploadDir, { recursive: true });
        }

        // Generate a unique filename
        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const filePath = join(uploadDir, uniqueFilename);
        this.log('debug', `Generated file path: ${filePath}`);

        // Write the file
        return new Promise((resolve, reject) => {
          const writeStartTime = performance.now();
          const writeStream = createWriteStream(filePath);
          writeStream.write(file.buffer);
          writeStream.end();

          writeStream.on('finish', () => {
            const writeTime = performance.now() - writeStartTime;
            this.log('info', `Successfully saved file to local filesystem`, {
              path: filePath,
              writeTimeMs: writeTime.toFixed(2),
              fileSize: `${(fileSize / 1024).toFixed(2)} KB`
            });

            // Return a URL-like path that can be used in the application
            const relativePath = `profile-images/${userId}/${uniqueFilename}`;
            const totalTime = performance.now() - startTime;
            this.log('debug', `Total profile image upload process took ${totalTime.toFixed(2)}ms`);
            resolve(relativePath);
          });

          writeStream.on('error', (error) => {
            this.log('error', `Error saving file to local filesystem: ${filePath}`, error);
            reject(error);
          });
        });
      }
    } catch (error) {
      const totalTime = performance.now() - startTime;
      this.log('error', `Failed to save profile image for user ${userId} after ${totalTime.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Saves a property image to either local filesystem or Vercel Blob Storage
   * @param file The uploaded file
   * @param propertyId The property ID to associate with the image
   * @returns Promise<string> The URL or path to the saved image
   */
  async savePropertyImage(file: Express.Multer.File, propertyId: string): Promise<string> {
    const startTime = performance.now();
    const fileSize = file?.buffer?.length || 0;
    const fileType = file?.mimetype || 'unknown';
    const fileName = file?.originalname || 'unknown';

    try {
      if (!file) {
        this.log('error', `No file provided for property ${propertyId}`);
        throw new Error('No file provided');
      }

      this.log('info', `Saving property image for property ${propertyId}`, {
        fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
        fileType,
        fileName
      });

      if (this.isVercel) {
        // For Vercel Blob Storage
        this.log('info', `Using Vercel Blob Storage for property ${propertyId}`);

        // Generate a unique filename
        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;

        // Define the blob path
        const blobPath = `property-images/${propertyId}/${uniqueFilename}`;
        this.log('debug', `Generated blob path: ${blobPath}`);

        // Upload to Vercel Blob
        const blobStartTime = performance.now();
        const blob = await put(blobPath, file.buffer, {
          access: 'public',
          contentType: file.mimetype
        });
        const blobUploadTime = performance.now() - blobStartTime;

        this.log('info', `Successfully uploaded to Vercel Blob`, {
          url: blob.url,
          uploadTimeMs: blobUploadTime.toFixed(2),
          fileSize: `${(fileSize / 1024).toFixed(2)} KB`
        });

        const totalTime = performance.now() - startTime;
        this.log('debug', `Total property image upload process took ${totalTime.toFixed(2)}ms`);
        return blob.url;
      } else {
        // For local filesystem
        this.log('info', `Using local filesystem for property ${propertyId}`);

        // Ensure the directory exists
        const uploadDir = join(process.cwd(), 'uploads', 'property-images', propertyId);
        if (!existsSync(uploadDir)) {
          this.log('debug', `Creating property upload directory: ${uploadDir}`);
          mkdirSync(uploadDir, { recursive: true });
        }

        // Generate a unique filename
        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const filePath = join(uploadDir, uniqueFilename);
        this.log('debug', `Generated file path: ${filePath}`);

        // Write the file
        return new Promise((resolve, reject) => {
          const writeStartTime = performance.now();
          const writeStream = createWriteStream(filePath);
          writeStream.write(file.buffer);
          writeStream.end();

          writeStream.on('finish', () => {
            const writeTime = performance.now() - writeStartTime;
            this.log('info', `Successfully saved file to local filesystem`, {
              path: filePath,
              writeTimeMs: writeTime.toFixed(2),
              fileSize: `${(fileSize / 1024).toFixed(2)} KB`
            });

            // Return a URL-like path that can be used in the application
            const relativePath = `property-images/${propertyId}/${uniqueFilename}`;
            const totalTime = performance.now() - startTime;
            this.log('debug', `Total property image upload process took ${totalTime.toFixed(2)}ms`);
            resolve(relativePath);
          });

          writeStream.on('error', (error) => {
            this.log('error', `Error saving file to local filesystem: ${filePath}`, error);
            reject(error);
          });
        });
      }
    } catch (error) {
      const totalTime = performance.now() - startTime;
      this.log('error', `Failed to save property image for property ${propertyId} after ${totalTime.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Deletes a property image from either local filesystem or Vercel Blob Storage
   * @param imageUrl The URL or path of the image to delete
   * @returns Promise<boolean> indicating success or failure
   */
  async deletePropertyImage(imageUrl: string): Promise<boolean> {
    const startTime = performance.now();

    try {
      if (!imageUrl) {
        this.log('warn', 'Received empty image URL for property image deletion');
        return false;
      }

      this.log('info', `Attempting to delete property image: ${imageUrl}`);

      if (this.isVercel) {
        // For Vercel Blob Storage
        this.log('info', 'Using Vercel Blob Storage for deletion');

        // Check if it's a full URL or just a path
        if (imageUrl.startsWith('http')) {
          // Extract the blob path from the URL
          // Example: https://viahfpn0v0vwvach.public.blob.vercel-storage.com/property-images/67f3f43cbed5143aee1fc38e/image.jpg

          try {
            // First try: Extract path after .com/
            const pathMatch = imageUrl.match(/\.com\/(.+)$/);
            if (pathMatch && pathMatch[1]) {
              const blobPath = pathMatch[1];
              this.log('debug', `Extracted blob path: ${blobPath}`);

              try {
                const delStartTime = performance.now();
                await del(blobPath);
                const delTime = performance.now() - delStartTime;

                this.log('info', `Successfully deleted blob at path`, {
                  path: blobPath,
                  deleteTimeMs: delTime.toFixed(2)
                });

                const totalTime = performance.now() - startTime;
                this.log('debug', `Total property image deletion process took ${totalTime.toFixed(2)}ms`);
                return true;
              } catch (error) {
                this.log('warn', `Failed with path extraction, trying full URL`, error);
                // Fall through to try the full URL
              }
            }

            // Second try: Use the full URL directly
            const delStartTime = performance.now();
            await del(imageUrl);
            const delTime = performance.now() - delStartTime;

            this.log('info', `Successfully deleted blob using full URL`, {
              url: imageUrl,
              deleteTimeMs: delTime.toFixed(2)
            });

            const totalTime = performance.now() - startTime;
            this.log('debug', `Total property image deletion process took ${totalTime.toFixed(2)}ms`);
            return true;
          } catch (error) {
            this.log('error', `Failed to delete from Vercel Blob`, {
              url: imageUrl,
              error: error.message
            });
            return false;
          }
        } else {
          // It's already a path, use it directly
          try {
            const blobPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            this.log('debug', `Using direct blob path: ${blobPath}`);

            const delStartTime = performance.now();
            await del(blobPath);
            const delTime = performance.now() - delStartTime;

            this.log('info', `Successfully deleted blob at path`, {
              path: blobPath,
              deleteTimeMs: delTime.toFixed(2)
            });

            const totalTime = performance.now() - startTime;
            this.log('debug', `Total property image deletion process took ${totalTime.toFixed(2)}ms`);
            return true;
          } catch (error) {
            this.log('error', `Failed to delete from Vercel Blob`, {
              path: imageUrl,
              error: error.message
            });
            return false;
          }
        }
      } else {
        // For local filesystem
        this.log('info', 'Using local filesystem for deletion');
        let localPath = imageUrl;

        // Handle full URLs (in case they're passed in local development)
        if (localPath.startsWith('http')) {
          const urlObj = new URL(localPath);
          localPath = urlObj.pathname;
          this.log('debug', `Converted URL to path: ${localPath}`);
        }

        // Remove leading slash if present
        if (localPath.startsWith('/')) {
          localPath = localPath.substring(1);
          this.log('debug', `Removed leading slash: ${localPath}`);
        }

        // Handle different path formats
        if (!localPath.startsWith('uploads/')) {
          if (localPath.startsWith('property-images/')) {
            localPath = `uploads/${localPath}`;
          } else {
            localPath = `uploads/property-images/${localPath}`;
          }
          this.log('debug', `Adjusted path format: ${localPath}`);
        }

        const fullPath = join(process.cwd(), localPath);
        this.log('debug', `Attempting to delete local file: ${fullPath}`);

        if (existsSync(fullPath)) {
          const delStartTime = performance.now();
          unlinkSync(fullPath);
          const delTime = performance.now() - delStartTime;

          this.log('info', `Successfully deleted local file`, {
            path: fullPath,
            deleteTimeMs: delTime.toFixed(2)
          });

          const totalTime = performance.now() - startTime;
          this.log('debug', `Total property image deletion process took ${totalTime.toFixed(2)}ms`);
          return true;
        } else {
          this.log('warn', `File not found at path: ${fullPath}, trying alternative paths`);

          // Try alternative paths
          const alternativePaths = [
            join(process.cwd(), 'uploads', localPath),
            join(process.cwd(), localPath),
            join(process.cwd(), 'uploads', 'property-images', localPath.split('/').pop() || '')
          ];

          for (const path of alternativePaths) {
            this.log('debug', `Trying alternative path: ${path}`);
            if (existsSync(path)) {
              const delStartTime = performance.now();
              unlinkSync(path);
              const delTime = performance.now() - delStartTime;

              this.log('info', `Successfully deleted local file from alternative path`, {
                path,
                deleteTimeMs: delTime.toFixed(2)
              });

              const totalTime = performance.now() - startTime;
              this.log('debug', `Total property image deletion process took ${totalTime.toFixed(2)}ms`);
              return true;
            }
          }

          this.log('warn', `File not found after trying all alternative paths`);
          const totalTime = performance.now() - startTime;
          this.log('debug', `Failed property image deletion process took ${totalTime.toFixed(2)}ms`);
          return false;
        }
      }
    } catch (error) {
      const totalTime = performance.now() - startTime;
      this.log('error', `Failed to delete property image: ${imageUrl} after ${totalTime.toFixed(2)}ms`, error);
      return false;
    }
  }

  /**
   * Deletes a profile image from either local filesystem or Vercel Blob Storage
   * @param imageUrl The URL or path of the image to delete
   * @returns Promise<boolean> indicating success or failure
   */
  async deleteProfileImage(imageUrl: string): Promise<boolean> {
    const startTime = performance.now();

    try {
      if (!imageUrl) {
        this.log('warn', 'Received empty image URL for profile image deletion');
        return false;
      }

      this.log('info', `Attempting to delete profile image: ${imageUrl}`);

      if (this.isVercel) {
        // For Vercel Blob Storage
        this.log('info', 'Using Vercel Blob Storage for deletion');

        // Check if it's a full URL or just a path
        if (imageUrl.startsWith('http')) {
          // Extract the blob path from the URL
          // Example: https://viahfpn0v0vwvach.public.blob.vercel-storage.com/profile-images/67f3f43cbed5143aee1fc38e/avatar.jpg

          try {
            // First try: Extract path after .com/
            const pathMatch = imageUrl.match(/\.com\/(.+)$/);
            if (pathMatch && pathMatch[1]) {
              const blobPath = pathMatch[1];
              this.log('debug', `Extracted blob path: ${blobPath}`);

              try {
                const delStartTime = performance.now();
                await del(blobPath);
                const delTime = performance.now() - delStartTime;

                this.log('info', `Successfully deleted blob at path`, {
                  path: blobPath,
                  deleteTimeMs: delTime.toFixed(2)
                });

                const totalTime = performance.now() - startTime;
                this.log('debug', `Total profile image deletion process took ${totalTime.toFixed(2)}ms`);
                return true;
              } catch (error) {
                this.log('warn', `Failed with path extraction, trying full URL`, error);
                // Fall through to try the full URL
              }
            }

            // Second try: Use the full URL directly
            const delStartTime = performance.now();
            await del(imageUrl);
            const delTime = performance.now() - delStartTime;

            this.log('info', `Successfully deleted blob using full URL`, {
              url: imageUrl,
              deleteTimeMs: delTime.toFixed(2)
            });

            const totalTime = performance.now() - startTime;
            this.log('debug', `Total profile image deletion process took ${totalTime.toFixed(2)}ms`);
            return true;
          } catch (error) {
            this.log('error', `Failed to delete from Vercel Blob`, {
              url: imageUrl,
              error: error.message
            });
            return false;
          }
        } else {
          // It's already a path, use it directly
          try {
            const blobPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            this.log('debug', `Using direct blob path: ${blobPath}`);

            const delStartTime = performance.now();
            await del(blobPath);
            const delTime = performance.now() - delStartTime;

            this.log('info', `Successfully deleted blob at path`, {
              path: blobPath,
              deleteTimeMs: delTime.toFixed(2)
            });

            const totalTime = performance.now() - startTime;
            this.log('debug', `Total profile image deletion process took ${totalTime.toFixed(2)}ms`);
            return true;
          } catch (error) {
            this.log('error', `Failed to delete from Vercel Blob`, {
              path: imageUrl,
              error: error.message
            });
            return false;
          }
        }
      } else {
        // For local filesystem
        this.log('info', 'Using local filesystem for deletion');
        let localPath = imageUrl;

        // Handle full URLs (in case they're passed in local development)
        if (localPath.startsWith('http')) {
          const urlObj = new URL(localPath);
          localPath = urlObj.pathname;
          this.log('debug', `Converted URL to path: ${localPath}`);
        }

        // Remove leading slash if present
        if (localPath.startsWith('/')) {
          localPath = localPath.substring(1);
          this.log('debug', `Removed leading slash: ${localPath}`);
        }

        // Handle different path formats
        if (!localPath.startsWith('uploads/')) {
          if (localPath.startsWith('profile-images/')) {
            localPath = `uploads/${localPath}`;
          } else {
            localPath = `uploads/profile-images/${localPath}`;
          }
          this.log('debug', `Adjusted path format: ${localPath}`);
        }

        const fullPath = join(process.cwd(), localPath);
        this.log('debug', `Attempting to delete local file: ${fullPath}`);

        if (existsSync(fullPath)) {
          const delStartTime = performance.now();
          unlinkSync(fullPath);
          const delTime = performance.now() - delStartTime;

          this.log('info', `Successfully deleted local file`, {
            path: fullPath,
            deleteTimeMs: delTime.toFixed(2)
          });

          const totalTime = performance.now() - startTime;
          this.log('debug', `Total profile image deletion process took ${totalTime.toFixed(2)}ms`);
          return true;
        } else {
          this.log('warn', `File not found at path: ${fullPath}, trying alternative paths`);

          // Try alternative paths
          const alternativePaths = [
            join(process.cwd(), 'uploads', localPath),
            join(process.cwd(), localPath),
            join(process.cwd(), 'uploads', 'profile-images', localPath.split('/').pop() || '')
          ];

          for (const path of alternativePaths) {
            this.log('debug', `Trying alternative path: ${path}`);
            if (existsSync(path)) {
              const delStartTime = performance.now();
              unlinkSync(path);
              const delTime = performance.now() - delStartTime;

              this.log('info', `Successfully deleted local file from alternative path`, {
                path,
                deleteTimeMs: delTime.toFixed(2)
              });

              const totalTime = performance.now() - startTime;
              this.log('debug', `Total profile image deletion process took ${totalTime.toFixed(2)}ms`);
              return true;
            }
          }

          this.log('warn', `File not found after trying all alternative paths`);
          const totalTime = performance.now() - startTime;
          this.log('debug', `Failed profile image deletion process took ${totalTime.toFixed(2)}ms`);
          return false;
        }
      }
    } catch (error) {
      const totalTime = performance.now() - startTime;
      this.log('error', `Failed to delete profile image: ${imageUrl} after ${totalTime.toFixed(2)}ms`, error);
      return false;
    }
  }
}
