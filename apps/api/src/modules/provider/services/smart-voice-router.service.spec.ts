import { Test, TestingModule } from '@nestjs/testing';
import { SmartVoiceRouterService } from './smart-voice-router.service';

describe('SmartVoiceRouterService', () => {
  let service: SmartVoiceRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SmartVoiceRouterService],
    }).compile();

    service = module.get<SmartVoiceRouterService>(SmartVoiceRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('selectVoiceProvider', () => {
    it('should select AWS Polly for US voice calls', async () => {
      const result = await service.selectVoiceProvider('+1234567890', 'voice_call');
      
      expect(result.providerId).toBe('aws_polly');
      expect(result.region).toBe('North America');
      expect(result.costPerMinute).toBe(4.0);
      expect(result.voiceOptions.language).toBe('en-US');
      expect(result.voiceOptions.recommendedVoices).toContain('Joanna');
    });

    it('should select AWS Polly for UK TTS', async () => {
      const result = await service.selectVoiceProvider('+447123456789', 'tts');
      
      expect(result.providerId).toBe('aws_polly');
      expect(result.region).toBe('Europe');
      expect(result.costPerMinute).toBe(4.2);
      expect(result.costPerCharacter).toBe(0.000004);
      expect(result.voiceOptions.language).toBe('en-GB');
      expect(result.voiceOptions.recommendedVoices).toContain('Amy');
    });

    it('should select AWS Polly for Australian voice notifications', async () => {
      const result = await service.selectVoiceProvider('+61412345678', 'voice_notification');
      
      expect(result.providerId).toBe('aws_polly');
      expect(result.region).toBe('Asia Pacific');
      expect(result.costPerMinute).toBe(4.5);
      expect(result.voiceOptions.language).toBe('en-AU');
      expect(result.voiceOptions.recommendedVoices).toContain('Nicole');
    });

    it('should use global fallback for unsupported countries', async () => {
      const result = await service.selectVoiceProvider('+8801234567890'); // Bangladesh
      
      expect(result.providerId).toBe('aws_polly');
      expect(result.region).toBe('Global');
      expect(result.costPerMinute).toBe(5.0); // Max pricing
      expect(result.voiceOptions.language).toBe('en-US');
    });

    it('should work without phone number for TTS-only', async () => {
      const result = await service.selectVoiceProvider(undefined, 'tts', 'en-US');
      
      expect(result.providerId).toBe('aws_polly');
      expect(result.voiceOptions.language).toBe('en-US');
      expect(result.costPerCharacter).toBe(0.000004);
    });
  });

  describe('getVoiceCostEstimate', () => {
    it('should calculate cost for voice call', async () => {
      const result = await service.getVoiceCostEstimate(2, undefined, '+1234567890', 'voice_call');
      
      expect(result.costPerMinute).toBe(4.0);
      expect(result.totalCost).toBe(8.0); // 2 minutes * $4/minute
      expect(result.provider).toBe('AWS Polly');
      expect(result.breakdown.voiceCallCost).toBe(8.0);
      expect(result.breakdown.totalMinutes).toBe(2);
    });

    it('should calculate cost for TTS', async () => {
      const result = await service.getVoiceCostEstimate(undefined, 1000, '+1234567890', 'tts');
      
      expect(result.costPerCharacter).toBe(0.000004);
      expect(result.totalCost).toBe(0.004); // 1000 chars * $0.000004/char
      expect(result.breakdown.ttsCost).toBe(0.004);
      expect(result.breakdown.totalCharacters).toBe(1000);
    });

    it('should calculate combined cost for voice notification with TTS', async () => {
      const result = await service.getVoiceCostEstimate(1, 500, '+1234567890', 'voice_notification');
      
      expect(result.totalCost).toBe(4.002); // $4 voice + $0.002 TTS
      expect(result.breakdown.voiceCallCost).toBe(4.0);
      expect(result.breakdown.ttsCost).toBe(0.002);
    });

    it('should show higher cost for APAC region', async () => {
      const result = await service.getVoiceCostEstimate(1, undefined, '+61412345678', 'voice_call');
      
      expect(result.costPerMinute).toBe(4.5); // Higher for APAC
      expect(result.totalCost).toBe(4.5);
    });
  });

  describe('getAvailableVoices', () => {
    it('should return AWS Polly voices for US English', async () => {
      const result = await service.getAvailableVoices('en-US', 'aws_polly');
      
      expect(result.language).toBe('en-US');
      expect(result.voices).toHaveLength(4);
      expect(result.voices.find(v => v.id === 'Joanna')).toBeDefined();
      expect(result.voices.find(v => v.id === 'Matthew')).toBeDefined();
      expect(result.voices.every(v => v.quality === 'standard')).toBe(true);
    });

    it('should return AWS Polly voices for British English', async () => {
      const result = await service.getAvailableVoices('en-GB', 'aws_polly');
      
      expect(result.language).toBe('en-GB');
      expect(result.voices.find(v => v.id === 'Amy')).toBeDefined();
      expect(result.voices.find(v => v.id === 'Brian')).toBeDefined();
    });

    it('should return Inworld TTS voices for fallback', async () => {
      const result = await service.getAvailableVoices('en-US', 'inworld_tts');
      
      expect(result.language).toBe('en-US');
      expect(result.voices.find(v => v.id === 'inworld_sarah')).toBeDefined();
      expect(result.voices.find(v => v.id === 'inworld_david')).toBeDefined();
    });
  });

  describe('pricing validation', () => {
    it('should keep all voice call costs within $4-5 range', async () => {
      const testNumbers = [
        '+1234567890',    // US
        '+447123456789',  // UK
        '+61412345678',   // Australia
        '+8801234567890', // Global fallback
      ];

      for (const number of testNumbers) {
        const result = await service.selectVoiceProvider(number, 'voice_call');
        expect(result.costPerMinute).toBeGreaterThanOrEqual(4.0);
        expect(result.costPerMinute).toBeLessThanOrEqual(5.0);
      }
    });

    it('should use standard quality voices to stay within budget', async () => {
      const result = await service.selectVoiceProvider('+1234567890', 'tts');
      
      expect(result.voiceOptions.quality).toBe('standard');
      expect(result.costPerCharacter).toBe(0.000004); // AWS Polly standard rate
    });
  });

  describe('real-world scenarios', () => {
    it('should handle voice notification for security alert', async () => {
      const securityMessage = "Your account has been accessed from a new device. If this wasn't you, please contact support immediately.";
      const messageLength = securityMessage.length; // ~120 characters
      
      const result = await service.getVoiceCostEstimate(0.5, messageLength, '+1234567890', 'voice_notification');
      
      expect(result.totalCost).toBeLessThan(3.0); // Should be affordable
      expect(result.breakdown.voiceCallCost).toBe(2.0); // 0.5 min * $4
      expect(result.breakdown.ttsCost).toBe(messageLength * 0.000004);
    });

    it('should handle TTS for long content', async () => {
      const longContent = "A".repeat(10000); // 10k characters
      
      const result = await service.getVoiceCostEstimate(undefined, longContent.length, undefined, 'tts');
      
      expect(result.totalCost).toBe(0.04); // 10k * $0.000004
      expect(result.totalCost).toBeLessThan(0.1); // Very affordable for TTS
    });

    it('should demonstrate cost efficiency vs premium voices', async () => {
      // Standard voice cost (our implementation)
      const standardCost = await service.getVoiceCostEstimate(1, 1000, '+1234567890');
      
      // Simulated premium voice cost (what we're avoiding)
      const premiumCostPerMinute = 15.0; // Premium neural voices
      const premiumCostPerChar = 0.000016; // 4x more expensive
      const premiumTotalCost = (1 * premiumCostPerMinute) + (1000 * premiumCostPerChar);
      
      const savings = ((premiumTotalCost - standardCost.totalCost) / premiumTotalCost) * 100;
      
      expect(savings).toBeGreaterThan(70); // Should save >70% vs premium
      expect(standardCost.totalCost).toBeLessThan(5.0); // Within budget
      
      console.log(`Standard voice cost: $${standardCost.totalCost.toFixed(3)}`);
      console.log(`Premium voice cost: $${premiumTotalCost.toFixed(3)}`);
      console.log(`Savings: ${savings.toFixed(1)}%`);
    });
  });

  describe('performance metrics', () => {
    it('should provide voice routing performance metrics', async () => {
      const metrics = await service.getVoicePerformanceMetrics();
      
      expect(metrics.routingStats.totalRules).toBeGreaterThan(0);
      expect(metrics.routingStats.averageRoutingTime).toBeLessThan(50); // Should be fast
      expect(metrics.costOptimization.averageCostPerMinute).toBeGreaterThanOrEqual(4.0);
      expect(metrics.costOptimization.averageCostPerMinute).toBeLessThanOrEqual(5.0);
      expect(metrics.qualityMetrics.primaryProviderUptime).toBeGreaterThan(0.95);
    });
  });
});