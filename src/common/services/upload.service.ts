import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { writeFile, existsSync, unlinkSync, mkdirSync } from 'fs-extra';
import { join } from 'path';

@Injectable()
export class UploadService {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly propertyImagesDir = join(this.uploadDir, 'property-images');

  constructor() {
    // Ensure upload directories exist
    this.ensureDirectoryExists(this.uploadDir);
    this.ensureDirectoryExists(this.propertyImagesDir);
  }

  private ensureDirectoryExists(directory: string): void {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
  }

  async savePropertyImage(file: Express.Multer.File, propertyId: string): Promise<string> {
    // Create directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'property-images', propertyId);
    console.log("UPLOAD DIR ====> ", uploadDir);
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
      console.log("UPLOAD DIR created ====> ", existsSync(uploadDir));
    }
    
    // Extract the original file extension
    const originalName = file.originalname;
    console.log("ORIGINAL FILE NAME ====> ", originalName);
  
    const fileExtension = originalName.substring(originalName.lastIndexOf('.') || 0);
    console.log("FILE EXTENTION ====> ", fileExtension);
  
    // Generate a unique ID for the filename
    const fileId = createHash('md5').update(Date.now().toString()).digest('hex');
    console.log("UNIQUE ID ====> ", fileId);
  
    // Create filename with original extension
    const filename = `${fileId}${fileExtension}`;
    console.log("FILE NAME ====> ", filename);
    const filepath = join(uploadDir, filename);
    console.log("FILE PATH ====> ", filepath);
  
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
  
    // Write file to disk
    await writeFile(filepath, fileData);
  
    // Return only the relative path - no server-specific parts
    const relativePath = `/property-images/${propertyId}/${filename}`;
    console.log("RELATIVE PATH ====> ", relativePath);
    
    return relativePath;
  }

  deletePropertyImage(imageUrl: string): boolean {
    try {
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
    } catch (error) {
      console.error(`Failed to delete image: ${error.message}`);
      return false;
    }
  }
}
