import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SMSRoutingService } from './sms-routing.service';

describe('SMSRoutingService', () => {
  let service: SMSRoutingService;
  let configService: ConfigService;

  const mockConfigService = {
    get: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SMSRoutingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SMSRoutingService>(SMSRoutingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProviderForCountry', () => {
    beforeEach(() => {
      // Register mock providers
      const mockTermiiProvider = {
        isCountrySupported: vi.fn((country) => ['NG', 'GH', 'KE', 'ZA'].includes(country)),
        getSupportedCountries: vi.fn(() => ['NG', 'GH', 'KE', 'ZA']),
      };
      
      const mockAsiaProvider = {
        isCountrySupported: vi.fn((country) => ['IN', 'CN', 'JP', 'SG'].includes(country)),
        getSupportedCountries: vi.fn(() => ['IN', 'CN', 'JP', 'SG']),
      };
      
      const mockAwsProvider = {
        isCountrySupported: vi.fn((country) => ['US', 'CA', 'GB', 'AU'].includes(country)),
        getSupportedCountries: vi.fn(() => ['US', 'CA', 'GB', 'AU']),
      };

      service.registerProvider('termii', mockTermiiProvider as any);
      service.registerProvider('asia_sms', mockAsiaProvider as any);
      service.registerProvider('aws_sns', mockAwsProvider as any);
    });

    it('should return Termii provider for African countries', () => {
      const result = service.getProviderForCountry('NG'); // Nigeria
      expect(result).toBeDefined();
      expect(result?.getSupportedCountries()).toContain('NG');
    });

    it('should return Asia provider for Asian countries', () => {
      const result = service.getProviderForCountry('IN'); // India
      expect(result).toBeDefined();
      expect(result?.getSupportedCountries()).toContain('IN');
    });

    it('should return AWS SNS for North American countries', () => {
      const result = service.getProviderForCountry('US'); // United States
      expect(result).toBeDefined();
      expect(result?.getSupportedCountries()).toContain('US');
    });

    it('should return null for unmapped countries', () => {
      const result = service.getProviderForCountry('BR'); // Brazil (not mapped)
      expect(result).toBeNull();
    });

    it('should handle case-insensitive country codes', () => {
      const result = service.getProviderForCountry('ng'); // lowercase
      expect(result).toBeDefined();
      expect(result?.getSupportedCountries()).toContain('NG');
    });
  });

  describe('extractCountryCodeFromPhone', () => {
    it('should extract country code from Nigerian phone number', () => {
      const result = service.extractCountryCodeFromPhone('+2348123456789');
      expect(result).toBe('NG');
    });

    it('should extract country code from Indian phone number', () => {
      const result = service.extractCountryCodeFromPhone('+919876543210');
      expect(result).toBe('IN');
    });

    it('should extract country code from US phone number', () => {
      const result = service.extractCountryCodeFromPhone('+15551234567');
      expect(result).toBe('US');
    });

    it('should return null for phone numbers without country code', () => {
      const result = service.extractCountryCodeFromPhone('5551234567');
      expect(result).toBeNull();
    });

    it('should return null for invalid phone numbers', () => {
      const result = service.extractCountryCodeFromPhone('invalid');
      expect(result).toBeNull();
    });

    it('should extract country code from UK phone number', () => {
      const result = service.extractCountryCodeFromPhone('+447700900123');
      expect(result).toBe('GB');
    });

    it('should extract country code from Chinese phone number', () => {
      const result = service.extractCountryCodeFromPhone('+8613800138000');
      expect(result).toBe('CN');
    });
  });

  describe('getAllProviders', () => {
    it('should return all available SMS providers', () => {
      // Register some mock providers first
      const mockProvider1 = {
        isCountrySupported: vi.fn(),
        getSupportedCountries: vi.fn(() => ['NG']),
      };
      
      const mockProvider2 = {
        isCountrySupported: vi.fn(),
        getSupportedCountries: vi.fn(() => ['US']),
      };

      service.registerProvider('provider1', mockProvider1 as any);
      service.registerProvider('provider2', mockProvider2 as any);

      const providers = service.getAllProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]).toBe(mockProvider1);
      expect(providers[1]).toBe(mockProvider2);
    });
  });

  describe('getRoutingStats', () => {
    it('should return routing statistics', () => {
      const stats = service.getRoutingStats();
      expect(stats).toHaveProperty('totalProviders');
      expect(stats).toHaveProperty('totalCountriesWithRules');
      expect(stats).toHaveProperty('providerCoverage');
      expect(stats).toHaveProperty('countryCoverage');
    });
  });

  describe('getProvidersForCountry', () => {
    it('should return all providers that support a country', () => {
      // First register some mock providers
      const mockProvider = {
        isCountrySupported: vi.fn().mockReturnValue(true),
        getSupportedCountries: vi.fn().mockReturnValue(['NG', 'GH']),
      };
      
      service.registerProvider('test-provider', mockProvider as any);
      
      const providers = service.getProvidersForCountry('NG');
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider);
    });

    it('should return empty array for unsupported country', () => {
      const providers = service.getProvidersForCountry('XX');
      expect(providers).toHaveLength(0);
    });
  });

  describe('validateRouting', () => {
    it('should validate routing configuration', () => {
      const result = service.validateRouting();
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });



  describe('setupDefaultRouting', () => {
    it('should setup default routing rules', () => {
      service.setupDefaultRouting();
      // Just verify it doesn't throw an error
      expect(service).toBeDefined();
    });
  });

  describe('getProvider', () => {
    it('should return provider by ID', () => {
      const mockProvider = {
        isCountrySupported: vi.fn(),
        getSupportedCountries: vi.fn().mockReturnValue(['NG']),
      };
      
      service.registerProvider('test-provider', mockProvider as any);
      
      const provider = service.getProvider('test-provider');
      expect(provider).toBe(mockProvider);
    });

    it('should return null for unknown provider', () => {
      const provider = service.getProvider('unknown');
      expect(provider).toBeNull();
    });
  });
});
