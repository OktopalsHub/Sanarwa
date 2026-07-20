import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AlertingService } from '../services/alerting.service';
import { LoggingService } from '../services/logging.service';
import { ErrorAlertingInterceptor } from './error-alerting.interceptor';

describe('ErrorAlertingInterceptor', () => {
  let interceptor: ErrorAlertingInterceptor;
  let mockAlertingService: any;
  let mockLoggingService: any;
  let mockExecutionContext: any;
  let mockCallHandler: any;

  beforeEach(async () => {
    mockAlertingService = {
      sendAlert: vi.fn(),
    };

    mockLoggingService = {
      error: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorAlertingInterceptor,
        {
          provide: AlertingService,
          useValue: mockAlertingService,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    interceptor = module.get<ErrorAlertingInterceptor>(
      ErrorAlertingInterceptor,
    );

    mockExecutionContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: 'GET',
          url: '/api/test',
          headers: { 'user-agent': 'test-agent', 'x-tenant-id': 'test-tenant' },
          ip: '127.0.0.1',
          user: { tenantId: 'test-tenant' },
        }),
        getResponse: vi.fn().mockReturnValue({}),
      }),
    };

    mockCallHandler = {
      handle: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('intercept', () => {
    it('should pass through successful requests without intervention', (done) => {
      const testData = { success: true };
      mockCallHandler.handle.mockReturnValue(of(testData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toEqual(testData);
          expect(mockAlertingService.sendAlert).not.toHaveBeenCalled();
          expect(mockLoggingService.error).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should send alert for 5xx errors', (done) => {
      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(mockAlertingService.sendAlert).toHaveBeenCalledWith({
            type: 'system_error',
            severity: 'critical',
            title: 'Critical Error: 500',
            message:
              'A critical error occurred in the notification platform: Internal Server Error',
            metadata: expect.objectContaining({
              statusCode: 500,
              method: 'GET',
              url: '/api/test',
              errorName: 'HttpException',
              tenantId: 'test-tenant',
            }),
          });
          expect(mockLoggingService.error).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should not send alert for 4xx errors', (done) => {
      const error = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(mockAlertingService.sendAlert).not.toHaveBeenCalled();
          expect(mockLoggingService.error).toHaveBeenCalledWith(
            'Request error',
            error,
            expect.objectContaining({
              method: 'GET',
              url: '/api/test',
              statusCode: 400,
            }),
          );
          done();
        },
      });
    });

    it('should treat unknown errors as 5xx and send alerts', (done) => {
      const error = new Error('Unknown error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(mockAlertingService.sendAlert).toHaveBeenCalledWith({
            type: 'system_error',
            severity: 'critical',
            title: 'Critical Error: 500',
            message:
              'A critical error occurred in the notification platform: Unknown error',
            metadata: expect.objectContaining({
              statusCode: 500,
              errorName: 'Error',
            }),
          });
          done();
        },
      });
    });

    it('should handle alerting service failures gracefully', (done) => {
      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      const alertError = new Error('Alerting failed');

      mockCallHandler.handle.mockReturnValue(throwError(() => error));
      mockAlertingService.sendAlert.mockRejectedValue(alertError);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          // The interceptor logs the original error, not the alerting error
          expect(mockLoggingService.error).toHaveBeenCalledWith(
            'Request error',
            error,
            expect.objectContaining({
              method: 'GET',
              url: '/api/test',
              statusCode: 500,
            }),
          );
          done();
        },
      });
    });

    it('should extract tenant ID from headers when user is not available', (done) => {
      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      mockExecutionContext.switchToHttp().getRequest.mockReturnValue({
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test-agent', 'x-tenant-id': 'header-tenant' },
        ip: '127.0.0.1',
        user: undefined,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(mockAlertingService.sendAlert).toHaveBeenCalledWith(
            expect.objectContaining({
              metadata: expect.objectContaining({
                tenantId: 'header-tenant',
              }),
            }),
          );
          done();
        },
      });
    });

    it('should use unknown tenant when no tenant info is available', (done) => {
      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      mockExecutionContext.switchToHttp().getRequest.mockReturnValue({
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1',
        user: undefined,
      });

      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(mockAlertingService.sendAlert).toHaveBeenCalledWith(
            expect.objectContaining({
              metadata: expect.objectContaining({
                tenantId: 'unknown',
              }),
            }),
          );
          done();
        },
      });
    });

    it('should include stack trace in alert metadata', (done) => {
      const error = new Error('Test error with stack');
      error.stack =
        'Error: Test error\n    at test.js:1:1\n    at test.js:2:2\n    at test.js:3:3\n    at test.js:4:4\n    at test.js:5:5\n    at test.js:6:6';

      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(mockAlertingService.sendAlert).toHaveBeenCalledWith(
            expect.objectContaining({
              metadata: expect.objectContaining({
                stack: expect.stringContaining('Error: Test error'),
              }),
            }),
          );
          done();
        },
      });
    });
  });
});
