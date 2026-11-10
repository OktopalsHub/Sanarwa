import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let error = "INTERNAL_ERROR";
    let originalError: Error | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || message;
        error = responseObj.error || error;
      }
      originalError = exception;
    } else if (exception instanceof Error) {
      originalError = exception;
      if (this.configService.get("NODE_ENV") === "production") {
        message = "Internal server error";
      } else {
        message = exception.message;
      }
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error("Unknown exception", exception);
    }

    const errorResponse = {
      success: false,
      error: {
        code: error,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(this.configService.get("NODE_ENV") !== "production" &&
          originalError && {
            stack: originalError.stack?.split("\n").slice(0, 10),
          }),
      },
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      originalError?.stack,
    );

    response.status(status).json(errorResponse);
  }
}
