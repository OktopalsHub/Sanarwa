import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
const morgan = require("morgan");

export function configureSecurityMiddleware(
  app: INestApplication,
  configService: ConfigService,
  logger: Logger,
) {
  const nodeEnv = process.env.NODE_ENV || "development";

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/v1/auth/reference")) {
      return next();
    }

    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "https:", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "blob:"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })(req, res, next);
  });

  if (nodeEnv === "production") {
    app.use(
      morgan("combined", {
        stream: {
          write: (message: string) => {
            logger.log(message.trim());
          },
        },
        skip: (req) => {
          return req.url?.includes("/metrics");
        },
      }),
    );
  } else {
    app.use(
      morgan("dev", {
        stream: {
          write: (message: string) => {
            logger.log(message.trim());
          },
        },
        skip: (req) => {
          return req.url?.includes("/metrics");
        },
      }),
    );
  }
}

export function configureCORS(app: INestApplication, configService: ConfigService) {
  const corsOrigins = process.env.CORS_ORIGIN?.split(",") || [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (corsOrigins.includes(origin) || corsOrigins.includes("*")) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV === "development") {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Tenant-ID",
      "X-API-Key",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  });
}
