import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { writeFile, existsSync, unlinkSync, mkdirSync } from 'fs-extra';
import { join } from 'path';
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

  async savePropertyImage(file: Express.Multer.File, propertyId: string): Promise<string> {
    // Extract the original file extension
    const originalName = file.originalname;
    console.log("ORIGINAL FILE NAME ====> ", originalName);
  
    const fileExtension = originalName.substring(originalName.lastIndexOf('.') || 0);
    console.log("FILE EXTENSION ====> ", fileExtension);
  
    // Generate a unique ID for the filename
    const fileId = createHash('md5').update(Date.now().toString()).digest('hex');
    console.log("UNIQUE ID ====> ", fileId);
  
    // Create filename with original extension
    const filename = `${fileId}${fileExtension}`;
    console.log("FILE NAME ====> ", filename);
    
    // Determine the file data source (buffer or path)
    let fileData;
    if (file.buffer) {
      console.log("Using file.buffer");
      fileData = file.buffer;
    } else if (file.path) {
      console.log("Using file from disk path:", file.path);
      // If using disk storage, read from the temp path
      const fs = require('fs');
      fileData = fs.readFileSync(file.path);
    } else {
      throw new Error("No file data available in either buffer or path");
    }
  
    // Relative path for the image
    const relativePath = `/property-images/${propertyId}/${filename}`;
    
    if (this.isVercel) {
      // In Vercel, use Blob Storage
      console.log("Using Vercel Blob Storage");
      // The path in Vercel Blob should not start with a slash
      const blobPath = `property-images/${propertyId}/${filename}`;
      
      try {
        const blob = await put(blobPath, fileData, {
          contentType: file.mimetype,
          access: 'public',
        });
        
        console.log("Image uploaded to Vercel Blob:", blob.url);
        return blob.url;
      } catch (error) {
        console.error("Error uploading to Vercel Blob:", error);
        throw error;
      }
    } else {
      // In local development, save to filesystem
      console.log("Using local filesystem storage");
      const uploadDir = join(this.propertyImagesDir, propertyId);
      console.log("UPLOAD DIR ====> ", uploadDir);
      
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
        console.log("UPLOAD DIR created ====> ", existsSync(uploadDir));
      }
      
      const filepath = join(uploadDir, filename);
      console.log("FILE PATH ====> ", filepath);
      
      // Write file to disk
      await writeFile(filepath, fileData);
      console.log("RELATIVE PATH ====> ", relativePath);
      
      return relativePath;
    }
  }

  async deletePropertyImage(imageUrl: string): Promise<boolean> {
    try {
      if (this.isVercel) {
        // For Vercel Blob Storage
        console.log("Deleting from Vercel Blob Storage:", imageUrl);
        
        // Check if it's a full URL or just a path
        if (imageUrl.startsWith('http')) {
          // It's a full URL, extract the path part
          const url = new URL(imageUrl);
          // Remove the leading slash if present
          const pathname = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
          await del(pathname);
        } else {
          // It's a relative path, remove the leading slash if present
          const blobPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
          await del(blobPath);
        }
        
        console.log("Successfully deleted image from Vercel Blob");
        return true;
      } else {
        // For local filesystem
        // imageUrl format: /property-images/{propertyId}/{filename}
        // Need to map this to the physical path: uploads/property-images/{propertyId}/{filename}
        
        // Convert URL path to filesystem path
        const imagePath = join(process.cwd(), 'uploads', imageUrl.substring(1));
        console.log("Attempting to delete image at:", imagePath);
        
        if (existsSync(imagePath)) {
          unlinkSync(imagePath);
          console.log("Successfully deleted image");
          return true;
        }
        console.log("Image file not found");
        return false;
      }
    } catch (error) {
      console.error(`Failed to delete image: ${error.message}`);
      return false;
    }
  }

  async saveProfileImage(file: Express.Multer.File, userId: string): Promise<string> {
    // Extract the original file extension
    const originalName = file.originalname;
    console.log("ORIGINAL FILE NAME ====> ", originalName);

    const fileExtension = originalName.substring(originalName.lastIndexOf('.') || 0);
    console.log("FILE EXTENSION ====> ", fileExtension);

    // Generate a unique ID for the filename
    const fileId = createHash('md5').update(Date.now().toString()).digest('hex');
    console.log("UNIQUE ID ====> ", fileId);

    // Create filename with original extension
    const filename = `${fileId}${fileExtension}`;
    console.log("FILE NAME ====> ", filename);
    
    // Determine the file data source (buffer or path)
    let fileData;
    if (file.buffer) {
      console.log("Using file.buffer");
      fileData = file.buffer;
    } else if (file.path) {
      console.log("Using file from disk path:", file.path);
      // If using disk storage, read from the temp path
      const fs = require('fs');
      fileData = fs.readFileSync(file.path);
    } else {
      throw new Error("No file data available in either buffer or path");
    }

    // Relative path for the image
    const relativePath = `/profile-images/${filename}`;
    
    if (this.isVercel) {
      // In Vercel, use Blob Storage
      console.log("Using Vercel Blob Storage");
      // The path in Vercel Blob should not start with a slash
      const blobPath = `profile-images/${filename}`;
      
      try {
        const blob = await put(blobPath, fileData, {
          contentType: file.mimetype,
          access: 'public',
        });
        
        console.log("Image uploaded to Vercel Blob:", blob.url);
        return blob.url;
      } catch (error) {
        console.error("Error uploading to Vercel Blob:", error);
        throw error;
      }
    } else {
      // In local development, save to filesystem
      console.log("Using local filesystem storage");
      const uploadDir = this.profileImagesDir;
      console.log("UPLOAD DIR ====> ", uploadDir);
      
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
        console.log("UPLOAD DIR created ====> ", existsSync(uploadDir));
      }
      
      const filepath = join(uploadDir, filename);
      console.log("FILE PATH ====> ", filepath);
      
      // Write file to disk
      await writeFile(filepath, fileData);
      console.log("RELATIVE PATH ====> ", relativePath);
      
      return relativePath;
    }
  }

  async deleteProfileImage(imageUrl: string): Promise<boolean> {
    try {
      if (this.isVercel) {
        // For Vercel Blob Storage
        console.log("Deleting from Vercel Blob Storage:", imageUrl);
        
        // Check if it's a full URL or just a path
        if (imageUrl.startsWith('http')) {
          // It's a full URL, extract the path part
          const url = new URL(imageUrl);
          // Remove the leading slash if present
          const pathname = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
          await del(pathname);
        } else {
          // It's a relative path, remove the leading slash if present
          const blobPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
          await del(blobPath);
        }
        
        console.log("Successfully deleted image from Vercel Blob");
        return true;
      } else {
        // For local filesystem
        // imageUrl format: /profile-images/{filename}
        // Need to map this to the physical path: uploads/profile-images/{filename}
        
        // Convert URL path to filesystem path
        const imagePath = join(process.cwd(), 'uploads', imageUrl.substring(1));
        console.log("Attempting to delete image at:", imagePath);
        
        if (existsSync(imagePath)) {
          unlinkSync(imagePath);
          console.log("Successfully deleted image");
          return true;
        }
        console.log("Image file not found");
        return false;
      }
    } catch (error) {
      console.error(`Failed to delete image: ${error.message}`);
      return false;
    }
  }
}
