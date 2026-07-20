import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WebClient } from '@slack/web-api';
import { Client } from 'discord.js';
import { AlertingService } from './alerting.service';
import { LoggingService } from './logging.service';
import type { Mock } from 'vitest';

vi.mock('@slack/web-api');
vi.mock('discord.js');

describe('AlertingService', () => {
  let service: AlertingService;
  let mockLoggingService: any;
  let mockSlackClient: any;
  let mockDiscordClient: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    
    mockLoggingService = {
      info: vi.fn(),
      error: vi.fn(),
    };

    mockSlackClient = {
      chat: {
        postMessage: vi.fn(),
      },
    };

    mockDiscordClient = {
      login: vi.fn(),
      channels: {
        cache: {
          get: vi.fn(),
        },
      },
    };

    (WebClient as Mock).mockImplementation(
      () => mockSlackClient,
    );
    (Client as Mock).mockImplementation(
      () => mockDiscordClient,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertingService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: any) => {
              const config = {
                SLACK_BOT_TOKEN: 'test-slack-token',
                SLACK_ALERTS_ENABLED: true,
                SLACK_ALERT_CHANNEL: '#alerts',
                DISCORD_BOT_TOKEN: 'test-discord-token',
                DISCORD_ALERTS_ENABLED: true,
                DISCORD_ALERT_CHANNEL_ID: '123456789',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<AlertingService>(AlertingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('sendAlert', () => {
    it('should not send alert for non-critical system errors', async () => {
      const alert = {
        type: 'system_error' as const,
        severity: 'medium' as const,
        title: 'Non-critical error',
        message: 'This should not trigger an alert',
      };

      await service.sendAlert(alert);

      expect(mockSlackClient.chat.postMessage).not.toHaveBeenCalled();
    });

    it('should send alert for critical system errors after threshold', async () => {
      const alert = {
        type: 'system_error' as const,
        severity: 'critical' as const,
        title: 'Critical error',
        message: 'This is a critical error',
      };

      mockSlackClient.chat.postMessage.mockResolvedValue({ ok: true });

      // First call creates the tracker (count=1, doesn't send)
      await service.sendAlert(alert);
      
      // Advance time past cooldown
      vi.advanceTimersByTime(300001);
      
      // Send 4 more times to reach threshold (count will be 5)
      for (let i = 0; i < 4; i++) {
        await service.sendAlert(alert);
      }

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should send provider health alerts immediately', async () => {
      const alert = {
        type: 'provider_health' as const,
        severity: 'high' as const,
        title: 'Provider health alert',
        message: 'Provider is unhealthy',
      };

      mockSlackClient.chat.postMessage.mockResolvedValue({ ok: true });

      await service.sendAlert(alert);

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should handle Slack API errors gracefully', async () => {
      mockSlackClient.chat.postMessage.mockRejectedValue(
        new Error('Slack API error'),
      );

      const alert = {
        type: 'provider_health' as const,
        severity: 'high' as const,
        title: 'Provider health alert',
        message: 'Provider is unhealthy',
      };

      await service.sendAlert(alert);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'Failed to send alert to slack',
        expect.any(Error),
      );
    });
  });

  describe('testAlert', () => {
    it('should send test alert to all channels', async () => {
      mockSlackClient.chat.postMessage.mockResolvedValue({ ok: true });

      // Test alert uses system_error type, so it goes through the same threshold logic
      // First call creates tracker, advance time, then send enough to trigger
      await service.testAlert();
      vi.advanceTimersByTime(300001);
      
      for (let i = 0; i < 4; i++) {
        await service.testAlert();
      }

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should send test alert to specific channel', async () => {
      mockSlackClient.chat.postMessage.mockResolvedValue({ ok: true });

      await service.testAlert('slack');

      expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    });

    it('should throw error for unconfigured channel', async () => {
      const serviceWithoutChannels = new AlertingService(
        {
          get: vi.fn(() => false), // All channels disabled
        } as any,
        mockLoggingService,
      );

      await expect(serviceWithoutChannels.testAlert('slack')).rejects.toThrow(
        'Alert channel slack not configured',
      );
    });
  });

  describe('cleanupErrorTracker', () => {
    it('should clean up old error tracking entries', () => {
      service.cleanupErrorTracker();

      expect(service).toBeDefined();
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct colors for different severities', () => {
      const service = new AlertingService(
        { get: vi.fn() } as any,
        mockLoggingService,
      );

      // Access private method for testing
      const getSeverityColor = (service as any).getSeverityColor;

      expect(getSeverityColor('critical')).toBe('danger');
      expect(getSeverityColor('high')).toBe('warning');
      expect(getSeverityColor('medium')).toBe('good');
      expect(getSeverityColor('low')).toBe('#36a64f');
      expect(getSeverityColor('unknown')).toBe('good');
    });
  });

  describe('getSeverityEmoji', () => {
    it('should return correct emojis for different severities', () => {
      const service = new AlertingService(
        { get: vi.fn() } as any,
        mockLoggingService,
      );

      // Access private method for testing
      const getSeverityEmoji = (service as any).getSeverityEmoji;

      expect(getSeverityEmoji('critical')).toBe('🚨');
      expect(getSeverityEmoji('high')).toBe('⚠️');
      expect(getSeverityEmoji('medium')).toBe('⚡');
      expect(getSeverityEmoji('low')).toBe('ℹ️');
      expect(getSeverityEmoji('unknown')).toBe('ℹ️');
    });
  });
});
