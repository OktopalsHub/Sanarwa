import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { Logger } from 'nestjs-pino';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { initializeSentry } from './common/config/sentry.config';
import { configureCORS } from './common/middleware/security.middleware';
import { createSwaggerConfig } from './config/swagger.config';
import { EnvironmentValidationService } from './modules/configuration/services/environment-validation.service';

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Initialize Sentry for error tracking (before app creation)
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    initializeSentry(sentryDsn, nodeEnv);
  }

  // Configure NestJS logging based on environment
  const nestLogLevel = process.env.NEST_LOG_LEVEL || 'warn';
  const logLevels =
    nodeEnv === 'production'
      ? ['error', 'warn']
      : nestLogLevel === 'verbose'
        ? ['error', 'warn', 'log', 'debug', 'verbose']
        : nestLogLevel === 'debug'
          ? ['error', 'warn', 'log', 'debug']
          : nestLogLevel === 'log'
            ? ['error', 'warn', 'log']
            : ['error', 'warn'];

  const nestOptions = {
    bufferLogs: true,
    bodyParser: false,
    logger: logLevels as (
      | 'error'
      | 'warn'
      | 'log'
      | 'debug'
      | 'verbose'
      | 'fatal'
    )[],
  };

  const app = await NestFactory.create(AppModule, nestOptions);
  const logger = app.get(Logger);
  app.useLogger(logger);

  try {
    const configService = app.get(ConfigService);

    const envValidationService = app.get(EnvironmentValidationService);
    envValidationService.validateOrThrow();

    // Configure security middleware (Helmet + Morgan)
    // FIXME: blocking authentication
    // configureSecurityMiddleware(app, configService, logger);

    // Configure CORS
    configureCORS(app, configService);

    // Add body parser and cookie parser middleware (bodyParser is disabled in NestFactory options)
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Set global prefix
    app.setGlobalPrefix('api/v1', {
      exclude: [
        {
          path: '/',
          method: RequestMethod.GET,
        },
        { path: '/health', method: RequestMethod.GET },
        { path: '/csrf/token', method: RequestMethod.GET },
        { path: '/metrics', method: RequestMethod.GET },
        { path: '/docs', method: RequestMethod.GET },
      ],
    });

    //  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

    // Setup Swagger
    const config = createSwaggerConfig();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);


    const port = configService.get<number>('app.port') || 3000;
    await app.listen(port);

    logger.log(`🚀 Application is running on: http://localhost:${port}}`);
  } catch (error) {
    logger.error('Failed to start application:', error.message);
    process.exit(1);
  }
}
bootstrap();
