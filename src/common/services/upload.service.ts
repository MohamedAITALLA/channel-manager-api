import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { writeFile, existsSync, unlinkSync, mkdirSync, createWriteStream } from 'fs-extra';
import path, { join } from 'path';
import { put, del } from '@vercel/blob'; // Make sure to install @vercel/blob

@Injectable()
export class UploadService {
  private readonly isVercel: boolean;
  private readonly uploadDir: string;
  private readonly propertyImagesDir: string;
  private readonly profileImagesDir: string;
  private readonly baseUrl: string;

  constructor() {
    // Check if running in Vercel
    this.isVercel = process.env.VERCEL === '1';
    console.log(`UploadService initialized. Running in Vercel: ${this.isVercel}`);
    // Set base URL for generating image URLs
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Set up directories for local development
    this.uploadDir = join(process.cwd(), 'uploads');
    this.propertyImagesDir = join(this.uploadDir, 'property-images');
    this.profileImagesDir = join(this.uploadDir, 'profile-images');
    
    // Only create directories if not in Vercel
    if (!this.isVercel) {
      this.ensureDirectoryExists(this.uploadDir);
      this.ensureDirectoryExists(this.propertyImagesDir);
      this.ensureDirectoryExists(this.profileImagesDir);
    }
  }

  private ensureDirectoryExists(directory: string): void {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
  }
/**
   * Saves a profile image to either local filesystem or Vercel Blob Storage
   * @param file The uploaded file
   * @param userId The user ID to associate with the image
   * @returns Promise<string> The URL or path to the saved image
   */
async saveProfileImage(file: Express.Multer.File, userId: string): Promise<string> {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Saving profile image for user ${userId}`);

    if (this.isVercel) {
      // For Vercel Blob Storage
      console.log("Saving to Vercel Blob Storage");
      
      // Generate a unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      
      // Define the blob path
      const blobPath = `profile-images/${userId}/${uniqueFilename}`;
      
      // Upload to Vercel Blob
      const blob = await put(blobPath, file.buffer, {
        access: 'public',
        contentType: file.mimetype
      });
      
      console.log(`Successfully uploaded to Vercel Blob: ${blob.url}`);
      return blob.url;
    } else {
      // For local filesystem
      console.log("Saving to local filesystem");
      
      // Ensure the directory exists
      const uploadDir = join(process.cwd(), 'uploads', 'profile-images', userId);
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      
      // Generate a unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePath = join(uploadDir, uniqueFilename);
      
      // Write the file
      return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        writeStream.write(file.buffer);
        writeStream.end();
        
        writeStream.on('finish', () => {
          console.log(`Successfully saved file to: ${filePath}`);
          // Return a URL-like path that can be used in the application
          const relativePath = `profile-images/${userId}/${uniqueFilename}`;
          resolve(relativePath);
        });
        
        writeStream.on('error', (error) => {
          console.error(`Error saving file: ${error.message}`);
          reject(error);
        });
      });
    }
  } catch (error) {
    console.error(`Failed to save profile image: ${error.message}`);
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
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Saving property image for property ${propertyId}`);

    if (this.isVercel) {
      // For Vercel Blob Storage
      console.log("Saving to Vercel Blob Storage");
      
      // Generate a unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      
      // Define the blob path
      const blobPath = `property-images/${propertyId}/${uniqueFilename}`;
      
      // Upload to Vercel Blob
      const blob = await put(blobPath, file.buffer, {
        access: 'public',
        contentType: file.mimetype
      });
      
      console.log(`Successfully uploaded to Vercel Blob: ${blob.url}`);
      return blob.url;
    } else {
      // For local filesystem
      console.log("Saving to local filesystem");
      
      // Ensure the directory exists
      const uploadDir = join(process.cwd(), 'uploads', 'property-images', propertyId);
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      
      // Generate a unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePath = join(uploadDir, uniqueFilename);
      
      // Write the file
      return new Promise((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        writeStream.write(file.buffer);
        writeStream.end();
        
        writeStream.on('finish', () => {
          console.log(`Successfully saved file to: ${filePath}`);
          // Return a URL-like path that can be used in the application
          const relativePath = `property-images/${propertyId}/${uniqueFilename}`;
          resolve(relativePath);
        });
        
        writeStream.on('error', (error) => {
          console.error(`Error saving file: ${error.message}`);
          reject(error);
        });
      });
    }
  } catch (error) {
    console.error(`Failed to save property image: ${error.message}`);
    throw error;
  }
}

/**
 * Deletes a property image from either local filesystem or Vercel Blob Storage
 * @param imageUrl The URL or path of the image to delete
 * @returns Promise<boolean> indicating success or failure
 */
async deletePropertyImage(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl) {
      console.warn('Received empty image URL for deletion');
      return false;
    }

    console.log(`Attempting to delete property image: ${imageUrl}`);

    if (this.isVercel) {
      // For Vercel Blob Storage
      console.log("Deleting from Vercel Blob Storage");
      
      // Check if it's a full URL or just a path
      if (imageUrl.startsWith('http')) {
        // Extract the blob path from the URL
        // Example: https://viahfpn0v0vwvach.public.blob.vercel-storage.com/property-images/67f3f43cbed5143aee1fc38e/image.jpg
        
        try {
          // First try: Extract path after .com/
          const pathMatch = imageUrl.match(/\.com\/(.+)$/);
          if (pathMatch && pathMatch[1]) {
            const blobPath = pathMatch[1];
            console.log(`Extracted blob path: ${blobPath}`);
            
            try {
              await del(blobPath);
              console.log(`Successfully deleted blob at path: ${blobPath}`);
              return true;
            } catch (error) {
              console.log(`Failed with path extraction, trying full URL: ${error.message}`);
              // Fall through to try the full URL
            }
          }
          
          // Second try: Use the full URL directly
          await del(imageUrl);
          console.log(`Successfully deleted blob using full URL`);
          return true;
        } catch (error) {
          console.error(`Failed to delete from Vercel Blob: ${error.message}`);
          return false;
        }
      } else {
        // It's already a path, use it directly
        try {
          const blobPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
          await del(blobPath);
          console.log(`Successfully deleted blob at path: ${blobPath}`);
          return true;
        } catch (error) {
          console.error(`Failed to delete from Vercel Blob: ${error.message}`);
          return false;
        }
      }
    } else {
      // For local filesystem
      let localPath = imageUrl;
      
      // Handle full URLs (in case they're passed in local development)
      if (localPath.startsWith('http')) {
        const urlObj = new URL(localPath);
        localPath = urlObj.pathname;
      }
      
      // Remove leading slash if present
      if (localPath.startsWith('/')) {
        localPath = localPath.substring(1);
      }
      
      // Handle different path formats
      if (!localPath.startsWith('uploads/')) {
        if (localPath.startsWith('property-images/')) {
          localPath = `uploads/${localPath}`;
        } else {
          localPath = `uploads/property-images/${localPath}`;
        }
      }
      
      const fullPath = join(process.cwd(), localPath);
      console.log(`Attempting to delete local file: ${fullPath}`);
      
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
        console.log(`Successfully deleted local file: ${fullPath}`);
        return true;
      } else {
        console.log(`File not found at path: ${fullPath}, trying alternative paths`);
        
        // Try alternative paths
        const alternativePaths = [
          join(process.cwd(), 'uploads', localPath),
          join(process.cwd(), localPath),
          join(process.cwd(), 'uploads', 'property-images', localPath.split('/').pop() || '')
        ];
        
        for (const path of alternativePaths) {
          console.log(`Trying alternative path: ${path}`);
          if (existsSync(path)) {
            unlinkSync(path);
            console.log(`Successfully deleted local file: ${path}`);
            return true;
          }
        }
        
        console.log(`File not found after trying all alternative paths`);
        return false;
      }
    }
  } catch (error) {
    console.error(`Failed to delete property image: ${error.message}`);
    return false;
  }
}

/**
 * Deletes a profile image from either local filesystem or Vercel Blob Storage
 * @param imageUrl The URL or path of the image to delete
 * @returns Promise<boolean> indicating success or failure
 */
async deleteProfileImage(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl) {
      console.warn('Received empty image URL for deletion');
      return false;
    }

    console.log(`Attempting to delete profile image: ${imageUrl}`);

    if (this.isVercel) {
      // For Vercel Blob Storage
      console.log("Deleting from Vercel Blob Storage");
      
      // Check if it's a full URL or just a path
      if (imageUrl.startsWith('http')) {
        // Extract the blob path from the URL
        // Example: https://viahfpn0v0vwvach.public.blob.vercel-storage.com/profile-images/67f3f43cbed5143aee1fc38e/avatar.jpg
        
        try {
          // First try: Extract path after .com/
          const pathMatch = imageUrl.match(/\.com\/(.+)$/);
          if (pathMatch && pathMatch[1]) {
            const blobPath = pathMatch[1];
            console.log(`Extracted blob path: ${blobPath}`);
            
            try {
              await del(blobPath);
              console.log(`Successfully deleted blob at path: ${blobPath}`);
              return true;
            } catch (error) {
              console.log(`Failed with path extraction, trying full URL: ${error.message}`);
              // Fall through to try the full URL
            }
          }
          
          // Second try: Use the full URL directly
          await del(imageUrl);
          console.log(`Successfully deleted blob using full URL`);
          return true;
        } catch (error) {
          console.error(`Failed to delete from Vercel Blob: ${error.message}`);
          return false;
        }
      } else {
        // It's already a path, use it directly
        try {
          const blobPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
          await del(blobPath);
          console.log(`Successfully deleted blob at path: ${blobPath}`);
          return true;
        } catch (error) {
          console.error(`Failed to delete from Vercel Blob: ${error.message}`);
          return false;
        }
      }
    } else {
      // For local filesystem
      let localPath = imageUrl;
      
      // Handle full URLs (in case they're passed in local development)
      if (localPath.startsWith('http')) {
        const urlObj = new URL(localPath);
        localPath = urlObj.pathname;
      }
      
      // Remove leading slash if present
      if (localPath.startsWith('/')) {
        localPath = localPath.substring(1);
      }
      
      // Handle different path formats
      if (!localPath.startsWith('uploads/')) {
        if (localPath.startsWith('profile-images/')) {
          localPath = `uploads/${localPath}`;
        } else {
          localPath = `uploads/profile-images/${localPath}`;
        }
      }
      
      const fullPath = join(process.cwd(), localPath);
      console.log(`Attempting to delete local file: ${fullPath}`);
      
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
        console.log(`Successfully deleted local file: ${fullPath}`);
        return true;
      } else {
        console.log(`File not found at path: ${fullPath}, trying alternative paths`);
        
        // Try alternative paths
        const alternativePaths = [
          join(process.cwd(), 'uploads', localPath),
          join(process.cwd(), localPath),
          join(process.cwd(), 'uploads', 'profile-images', localPath.split('/').pop() || '')
        ];
        
        for (const path of alternativePaths) {
          console.log(`Trying alternative path: ${path}`);
          if (existsSync(path)) {
            unlinkSync(path);
            console.log(`Successfully deleted local file: ${path}`);
            return true;
          }
        }
        
        console.log(`File not found after trying all alternative paths`);
        return false;
      }
    }
  } catch (error) {
    console.error(`Failed to delete profile image: ${error.message}`);
    return false;
  }
}
}
function uuidv4() {
  throw new Error('Function not implemented.');
}

