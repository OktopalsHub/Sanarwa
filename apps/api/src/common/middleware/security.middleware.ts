import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
const morgan = require('morgan');

export function configureSecurityMiddleware(
  app: INestApplication,
  configService: ConfigService,
  logger: Logger,
) {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Enhanced Security middleware - Helmet (skip for API documentation routes)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/auth/reference')) {
      return next();
    }

    // Apply Helmet for all other routes
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:', 'https://api.sentry.io'],
          fontSrc: ["'self'", 'https:', 'data:', 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'blob:'],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })(req, res, next);
  });

  // HTTP request logging - Morgan
  if (nodeEnv === 'production') {
    app.use(
      morgan('combined', {
        stream: {
          write: (message: string) => {
            logger.log(message.trim());
          },
        },
        skip: (req) => {
          // Skip logging for health check endpoints
          return req.url?.includes('/health') || req.url?.includes('/metrics');
        },
      }),
    );
  } else {
    app.use(
      morgan('dev', {
        stream: {
          write: (message: string) => {
            logger.log(message.trim());
          },
        },
        skip: (req) => {
          // Skip logging for health check endpoints
          return req.url?.includes('/health') || req.url?.includes('/metrics');
        },
      }),
    );
  }
}

export function configureCORS(
  app: INestApplication,
  configService: ConfigService,
) {
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if the origin is in the allowed list
      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        return callback(null, true);
      }

      // In development, be more permissive
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tenant-ID',
      'X-API-Key',
    ],
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  });
}
