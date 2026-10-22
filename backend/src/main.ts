import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS with whitelist configuration
  const nodeEnv = process.env.NODE_ENV || 'development';
  const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS;

  let corsOrigin: boolean | string | string[];

  if (allowedOriginsEnv) {
    corsOrigin = allowedOriginsEnv
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
    logger.log(`CORS whitelist configured: ${Array.isArray(corsOrigin) ? corsOrigin.join(', ') : corsOrigin}`);
  } else if (nodeEnv === 'production') {
    logger.warn('WARNING: CORS_ALLOWED_ORIGINS is not set in production. Restricting CORS access.');
    corsOrigin = false;
  } else {
    corsOrigin = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ];
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('UTAAS API')
    .setDescription(
      'University Teachers\' Administrative Automation System API (Faculty of Engineering, University of Ruhuna)',
    )
    .setVersion('1.0')
    .addTag('Health', 'System health and status endpoints')
    .addTag('Authentication & Identity', 'SSO, persona authentication, and session management')
    .addTag('Requests', 'Workflow request creation, tracking, and actions')
    .addTag('Paper Marking', 'Paper setting and marking payment claim processing')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'UTAAS API Documentation',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`UTAAS Backend is running on: http://localhost:${port}/api/v1`);
  logger.log(`Swagger OpenAPI Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
