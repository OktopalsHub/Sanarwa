import { Injectable } from "@nestjs/common";
import { StructuredLoggerService } from "./structured-logger.service";

@Injectable()
export class LoggingExampleService {
  constructor(private readonly logger: StructuredLoggerService) {}

  async exampleUserAction(userId: string, action: string) {
    this.logger.logUserAction(action, userId, {
      correlationId: "req-123",
      metadata: { source: "web" },
    });

    try {
      const result = await this.performBusinessLogic();

      this.logger.logBusinessEvent("user_profile_updated", {
        userId,
        correlationId: "req-123",
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to update user profile", error.stack, {
        userId,
        correlationId: "req-123",
        operation: "update_profile",
      });
      throw error;
    }
  }

  async exampleDatabaseOperation() {
    const startTime = Date.now();

    try {
      const query = "SELECT * FROM users WHERE active = true";
      const result = await this.simulateDbQuery();

      this.logger.logDatabaseQuery(query, Date.now() - startTime, {
        correlationId: "req-123",
        rowCount: result.length,
      });

      return result;
    } catch (error) {
      this.logger.error("Database query failed", error.stack, {
        correlationId: "req-123",
        operation: "fetch_active_users",
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async exampleSecurityEvent(userId: string, ipAddress: string) {
    this.logger.logSecurityEvent("suspicious_login_attempt", "medium", {
      userId,
      ipAddress,
      correlationId: "req-123",
      userAgent: "Mozilla/5.0...",
    });
  }

  async exampleApiCall(endpoint: string, method: string) {
    const startTime = Date.now();

    try {
      const response = await this.simulateApiCall();

      this.logger.logApiCall(method, endpoint, Date.now() - startTime, {
        correlationId: "req-123",
        statusCode: 200,
        responseSize: JSON.stringify(response).length,
      });

      return response;
    } catch (error) {
      this.logger.error("External API call failed", error.stack, {
        correlationId: "req-123",
        endpoint,
        method,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  private async performBusinessLogic() {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true };
  }

  private async simulateDbQuery() {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
    ];
  }

  private async simulateApiCall() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { data: "response" };
  }
}
