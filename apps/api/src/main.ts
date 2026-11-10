import { ValidationPipe } from "@nestjs/common";
import { API_PREFIX, UNVERSIONED_PATHS } from "./common/http/api-prefix";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";

import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import { Logger } from "nestjs-pino";
import "reflect-metadata";
import { AppModule } from "./app.module";
import {
  configureCORS,
  configureSecurityMiddleware,
} from "./common/middleware/security.middleware";
import { createSwaggerConfig } from "./config/swagger.config";
import { betterAuthHandler } from "./modules/auth/better-auth";
import { EnvironmentValidationService } from "./modules/configuration/services/environment-validation.service";

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV || "development";

  const nestLogLevel = process.env.NEST_LOG_LEVEL || "warn";
  const logLevels =
    nodeEnv === "production"
      ? ["error", "warn"]
      : nestLogLevel === "verbose"
        ? ["error", "warn", "log", "debug", "verbose"]
        : nestLogLevel === "debug"
          ? ["error", "warn", "log", "debug"]
          : nestLogLevel === "log"
            ? ["error", "warn", "log"]
            : ["error", "warn"];

  const nestOptions = {
    bufferLogs: true,
    bodyParser: false,
    logger: logLevels as ("error" | "warn" | "log" | "debug" | "verbose" | "fatal")[],
  };

  const app = await NestFactory.create<NestExpressApplication>(AppModule, nestOptions);
  app.enableShutdownHooks(["SIGINT", "SIGTERM"]);
  const logger = app.get(Logger);
  app.useLogger(logger);

  try {
    const configService = app.get(ConfigService);

    const envValidationService = app.get(EnvironmentValidationService);
    envValidationService.validateOrThrow();

    app.set("trust proxy", process.env.TRUST_PROXY === "true");

    configureSecurityMiddleware(app, configService, logger);

    configureCORS(app, configService);

    app.use(compression());

    // better-auth owns /api/auth (unversioned) and parses its own request
    // bodies, so it must be mounted before the express.json body parser.
    app.use("/api/auth", betterAuthHandler);

    app.use(
      express.json({
        limit: "1mb",
        verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
          if (
            req.originalUrl?.includes("/billing/webhooks/") ||
            req.originalUrl?.includes("/webhooks/")
          ) {
            req.rawBody = buf;
          }
        },
      }),
    );
    app.use(express.urlencoded({ extended: true, limit: "1mb" }));
    app.use(cookieParser());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.setGlobalPrefix(API_PREFIX, { exclude: UNVERSIONED_PATHS });

    if (nodeEnv !== "production") {
      const config = createSwaggerConfig();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup("docs", app, document);
    }

    const port = configService.get<number>("app.port") || 3000;
    await app.listen(port);

    logger.log(`Application is running on: http://localhost:${port}`);
  } catch (error) {
    logger.error("Failed to start application:", error.message);
    process.exit(1);
  }
}
bootstrap();
