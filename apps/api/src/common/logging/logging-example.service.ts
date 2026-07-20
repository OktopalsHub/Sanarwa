import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from './structured-logger.service';

@Injectable()
export class LoggingExampleService {
  constructor(private readonly logger: StructuredLoggerService) {}

  async exampleUserAction(userId: string, action: string) {
    // Log user actions for analytics
    this.logger.logUserAction(action, userId, {
      correlationId: 'req-123',
      metadata: { source: 'web' },
    });

    try {
      // Simulate some business logic
      const result = await this.performBusinessLogic();
      
      // Log successful business events
      this.logger.logBusinessEvent('user_profile_updated', {
        userId,
        correlationId: 'req-123',
      });

      return result;
    } catch (error) {
      // Structured error logging
      this.logger.error('Failed to update user profile', error.stack, {
        userId,
        correlationId: 'req-123',
        operation: 'update_profile',
      });
      throw error;
    }
  }

  async exampleDatabaseOperation() {
    const startTime = Date.now();
    
    try {
      // Simulate database query
      const query = 'SELECT * FROM users WHERE active = true';
      const result = await this.simulateDbQuery();
      
      // Log database performance
      this.logger.logDatabaseQuery(query, Date.now() - startTime, {
        correlationId: 'req-123',
        rowCount: result.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Database query failed', error.stack, {
        correlationId: 'req-123',
        operation: 'fetch_active_users',
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async exampleSecurityEvent(userId: string, ipAddress: string) {
    // Log security events for monitoring
    this.logger.logSecurityEvent('suspicious_login_attempt', 'medium', {
      userId,
      ipAddress,
      correlationId: 'req-123',
      userAgent: 'Mozilla/5.0...',
    });
  }

  async exampleApiCall(endpoint: string, method: string) {
    const startTime = Date.now();
    
    try {
      // Simulate API call
      const response = await this.simulateApiCall();
      
      // Log API performance
      this.logger.logApiCall(method, endpoint, Date.now() - startTime, {
        correlationId: 'req-123',
        statusCode: 200,
        responseSize: JSON.stringify(response).length,
      });

      return response;
    } catch (error) {
      this.logger.error('External API call failed', error.stack, {
        correlationId: 'req-123',
        endpoint,
        method,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  private async performBusinessLogic() {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  private async simulateDbQuery() {
    await new Promise(resolve => setTimeout(resolve, 50));
    return [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
  }

  private async simulateApiCall() {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { data: 'response' };
  }
}