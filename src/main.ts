import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  
  // CORS setup
  app.enableCors();
  
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Multi-Platform Property Management API')
    .setDescription('RESTful API that integrates with multiple booking platforms via iCalendar URLs')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  await app.listen(3000);
}
bootstrap();
