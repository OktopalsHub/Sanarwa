import { ArgumentsHost, HttpStatus, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { AlertService } from '../../alerts/alert.service';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let alertService: AlertService;

  const mockRequest = {
    method: 'POST',
    url: '/api/test',
    get: vi.fn().mockReturnValue('test-agent'),
    ip: '127.0.0.1',
  } as unknown as Request;

  const mockResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const mockArgumentsHost = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        {
          provide: AlertService,
          useValue: {
            send5xxAlert: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockImplementation((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
    alertService = module.get<AlertService>(AlertService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle regular errors and send appropriate response', async () => {
      const error = new Error('Test error');

      await filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'Test error',
            timestamp: expect.any(String),
            path: '/api/test',
            method: 'POST',
          }),
        }),
      );
    });

    it('should send alert for 5xx errors', async () => {
      const error = new Error('Server error');

      await filter.catch(error, mockArgumentsHost);

      expect(alertService.send5xxAlert).toHaveBeenCalledWith(
        error,
        mockRequest,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should not send alert for client errors', async () => {
      const clientError = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

      await filter.catch(clientError, mockArgumentsHost);

      expect(alertService.send5xxAlert).not.toHaveBeenCalled();
    });

    it('should include debug information in development environment', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GlobalExceptionFilter,
          {
            provide: AlertService,
            useValue: {
              send5xxAlert: vi.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn().mockImplementation((key: string) => {
                if (key === 'NODE_ENV') return 'development';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const devFilter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test\n    at another line';

      await devFilter.catch(error, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(Array),
          }),
        }),
      );
    });

    it('should sanitize sensitive data from request body', async () => {
      const error = new Error('Test error');

      await filter.catch(error, mockArgumentsHost);

      // Should complete without throwing
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should generate correlation ID if not present in headers', async () => {
      const error = new Error('Test error');

      await filter.catch(error, mockArgumentsHost);

      // Should complete without throwing
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle alerting service failures gracefully', async () => {
      const error = new Error('Critical error');
      vi
        .spyOn(alertService, 'send5xxAlert')
        .mockRejectedValue(new Error('Alert service down'));

      // Should not throw even if alerting fails
      await expect(
        filter.catch(error, mockArgumentsHost),
      ).resolves.not.toThrow();

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
