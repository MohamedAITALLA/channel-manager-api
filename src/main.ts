import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true, // Enable body parsing
  });

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Configure CORS
  app.enableCors();

  // Serve static files
  app.use('/property-images', express.static(join(process.cwd(), 'uploads', 'property-images')));


  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Property API')
    .setDescription('API for managing properties')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}
bootstrap();
