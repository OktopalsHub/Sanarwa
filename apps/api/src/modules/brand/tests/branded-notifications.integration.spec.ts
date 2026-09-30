import { Test, TestingModule } from "@nestjs/testing";
import { BrandService } from "../brand.service";
import { BRAND_REPO } from "../brand.tokens";
import { DnsVerificationService } from "../services/dns-verification.service";
import { SESVerificationService } from "../services/ses-verification.service";
import { ResendVerificationService } from "../services/resend-verification.service";
import { CloudflareDNSService } from "../services/cloudflare-dns.service";
import { BrandMessagingConfigService } from "../services/brand-messaging-config.service";
import { BrandSesService } from "../services/brand-ses.service";
import { BrandedPushService } from "../../provider/services/branded-push.service";
import { Brand } from "../entities/brand.entity";

describe("Branded Notifications Integration", () => {
  let brandService: BrandService;
  let brandMessagingConfigService: BrandMessagingConfigService;
  let brandSesService: BrandSesService;
  let brandRepository: {
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
  };
  let sesVerificationService: SESVerificationService;
  let brandedPushService: BrandedPushService;

  const mockBrand: Partial<Brand> = {
    id: "brand-123",
    name: "Test Company",
    domain: "testcompany.com",
    defaultFromEmail: "notifications@testcompany.com",
    defaultFromName: "Test Company",
    primaryColor: "#007bff",
    logo: "https://example.com/logo.png",
    whiteLabelConfig: {
      domains: {
        primary: "testcompany.com",
        sesVerified: true,
        sesVerifiedAt: new Date(),
        sesVerificationStatus: "Success",
      },
      dkim: {
        sesEnabled: true,
        sesVerified: true,
        sesDkimTokens: ["token1", "token2", "token3"],
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandService,
        BrandMessagingConfigService,
        BrandSesService,
        {
          provide: BRAND_REPO,
          useValue: {
            findById: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            find: vi.fn(),
          },
        },
        {
          provide: DnsVerificationService,
          useValue: {
            verifyDomainOwnership: vi.fn(),
            verifyDKIM: vi.fn(),
            verifyDMARC: vi.fn(),
            generateVerificationToken: vi.fn(),
            checkDomainHealth: vi.fn(),
          },
        },
        {
          provide: SESVerificationService,
          useValue: {
            startDomainVerification: vi.fn(),
            checkDomainVerificationStatus: vi.fn(),
            enableDKIM: vi.fn(),
            checkDKIMStatus: vi.fn(),
            validateSESConfiguration: vi.fn(),
            generateDomainVerificationInstructions: vi.fn(),
            generateDKIMInstructions: vi.fn(),
          },
        },
        {
          provide: ResendVerificationService,
          useValue: {},
        },
        {
          provide: CloudflareDNSService,
          useValue: {},
        },
        {
          provide: BrandedPushService,
          useValue: {
            enhancePushWithBrand: vi.fn(),
            getPushRecommendations: vi.fn(),
          },
        },
      ],
    }).compile();

    brandService = module.get<BrandService>(BrandService);
    brandMessagingConfigService = module.get<BrandMessagingConfigService>(
      BrandMessagingConfigService,
    );
    brandSesService = module.get<BrandSesService>(BrandSesService);
    brandRepository = module.get(BRAND_REPO);
    sesVerificationService = module.get<SESVerificationService>(SESVerificationService);
    brandedPushService = module.get<BrandedPushService>(BrandedPushService);
  });

  describe("Email Configuration", () => {
    it("should get brand email configuration successfully", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);

      const result = await brandMessagingConfigService.getBrandConfigForEmail(
        "tenant-123",
        "brand-123",
      );

      expect(result).toEqual({
        brandConfig: {
          defaultFromEmail: "notifications@testcompany.com",
          defaultFromName: "Test Company",
          domain: "testcompany.com",
          verified: true,
          dkimEnabled: true,
        },
        canSend: true,
        recommendations: ["Brand is properly configured for email sending"],
      });
    });

    it("should handle missing brand configuration gracefully", async () => {
      vi.spyOn(brandService, "getBrands").mockResolvedValue({
        records: [],
        totalItems: 0,
        page: 1,
        limit: 10,
        pageCount: 0,
        size: 0,
        name: "brands",
        previousPage: null,
        nextPage: null,
      });

      const result = await brandMessagingConfigService.getBrandConfigForEmail("tenant-123");

      expect(result).toEqual({
        canSend: true,
        reason: "No brand configured, using platform defaults",
        recommendations: ["Configure a brand for better email branding"],
      });
    });

    it("should provide email recommendations based on brand configuration", async () => {
      const incompleteBrand = {
        ...mockBrand,
        defaultFromEmail: undefined,
        whiteLabelConfig: {
          domains: { sesVerified: false },
          dkim: { sesEnabled: false },
        },
      };

      vi.spyOn(brandRepository, "findById").mockResolvedValue(incompleteBrand as Brand);

      const result = await brandMessagingConfigService.getEmailRecommendations(
        "tenant-123",
        "brand-123",
      );

      expect(result.status).toBe("poor");
      expect(result.score).toBeLessThan(50);
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          priority: "high",
          title: "Complete Email Configuration",
        }),
      );
    });
  });

  describe("SES Domain Verification", () => {
    it("should get SES domain verification instructions", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);
      vi.spyOn(sesVerificationService, "validateSESConfiguration").mockResolvedValue({
        configured: true,
        region: "us-east-1",
      });
      vi.spyOn(sesVerificationService, "checkDomainVerificationStatus").mockResolvedValue({
        verified: false,
        status: "NotStarted",
      });
      vi.spyOn(sesVerificationService, "startDomainVerification").mockResolvedValue({
        verified: false,
        verificationToken: "test-token-123",
        status: "Pending",
      });
      vi.spyOn(sesVerificationService, "generateDomainVerificationInstructions").mockReturnValue({
        domain: "testcompany.com",
        verificationToken: "test-token-123",
        instructions: {
          recordType: "TXT",
          name: "_amazonses.testcompany.com",
          value: "test-token-123",
          description: "Add this TXT record to verify domain ownership",
        },
      });

      const result = await brandSesService.getSESDomainVerificationInstructions(
        "tenant-123",
        "brand-123",
        "testcompany.com",
      );

      expect(result.domain).toBe("testcompany.com");
      expect(result.verificationToken).toBe("test-token-123");
      expect(result.instructions.recordType).toBe("TXT");
      expect(result.instructions.name).toBe("_amazonses.testcompany.com");
    });

    it("should verify SES domain successfully", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);
      vi.spyOn(sesVerificationService, "checkDomainVerificationStatus").mockResolvedValue({
        verified: true,
        status: "Success",
        verificationToken: "test-token-123",
      });
      vi.spyOn(brandRepository, "update").mockResolvedValue(mockBrand as Brand);

      const result = await brandSesService.verifySESDomain(
        "tenant-123",
        "brand-123",
        "testcompany.com",
      );

      expect(result.whiteLabelConfig?.domains?.sesVerified).toBe(true);
      expect(result.whiteLabelConfig?.domains?.sesVerificationStatus).toBe("Success");
    });

    it("should setup SES DKIM successfully", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);
      vi.spyOn(sesVerificationService, "enableDKIM").mockResolvedValue({
        enabled: true,
        verified: false,
        dkimTokens: ["token1", "token2", "token3"],
      });
      vi.spyOn(sesVerificationService, "generateDKIMInstructions").mockReturnValue({
        domain: "testcompany.com",
        instructions: [
          {
            recordType: "CNAME",
            name: "token1._domainkey.testcompany.com",
            value: "token1.dkim.amazonses.com",
            description: "DKIM CNAME record 1 of 3",
          },
        ],
      });
      vi.spyOn(brandRepository, "update").mockResolvedValue(mockBrand as Brand);

      const result = await brandSesService.setupSESDKIM("tenant-123", "brand-123");

      expect(result.dkimInstructions.domain).toBe("testcompany.com");
      expect(result.dkimInstructions.instructions).toHaveLength(1);
      expect(result.dkimInstructions.instructions[0].recordType).toBe("CNAME");
    });
  });

  describe("Push Notification Configuration", () => {
    it("should get brand push configuration successfully", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);

      const result = await brandMessagingConfigService.getBrandConfigForPush(
        "tenant-123",
        "brand-123",
      );

      expect(result).toEqual({
        brandConfig: {
          name: "Test Company",
          primaryColor: "#007bff",
          logo: "https://example.com/logo.png",
          domain: "testcompany.com",
        },
        canSend: true,
        recommendations: ["Brand is configured for push notifications"],
      });
    });

    it("should provide push recommendations", async () => {
      const incompleteBrand = {
        ...mockBrand,
        primaryColor: undefined,
        logo: undefined,
      };

      vi.spyOn(brandRepository, "findById").mockResolvedValue(incompleteBrand as Brand);
      vi.spyOn(brandedPushService, "getPushRecommendations").mockResolvedValue({
        status: "needs_improvement",
        score: 60,
        recommendations: [
          {
            priority: "medium",
            title: "Add Brand Colors",
            description: "Brand colors will be used in Android push notifications",
            action: "Set primary color in brand settings",
          },
        ],
      });

      const result = await brandMessagingConfigService.getPushRecommendations(
        "tenant-123",
        "brand-123",
      );

      expect(result.status).toBe("needs_improvement");
      expect(result.score).toBe(60);
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          priority: "medium",
          title: "Add Brand Colors",
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle SES configuration errors gracefully", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);
      vi.spyOn(sesVerificationService, "validateSESConfiguration").mockResolvedValue({
        configured: false,
        error: "AWS credentials not configured",
      });

      await expect(
        brandSesService.getSESDomainVerificationInstructions(
          "tenant-123",
          "brand-123",
          "testcompany.com",
        ),
      ).rejects.toThrow("SES is not properly configured");
    });

    it("should handle domain verification failures", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(mockBrand as Brand);
      vi.spyOn(sesVerificationService, "checkDomainVerificationStatus").mockResolvedValue({
        verified: false,
        status: "Failed",
        error: "DNS record not found",
      });
      vi.spyOn(brandRepository, "update").mockResolvedValue(mockBrand as Brand);

      await expect(
        brandSesService.verifySESDomain("tenant-123", "brand-123", "testcompany.com"),
      ).rejects.toThrow("SES domain verification failed");
    });

    it("should handle missing brand gracefully", async () => {
      vi.spyOn(brandRepository, "findById").mockResolvedValue(null);

      await expect(
        brandMessagingConfigService.getBrandConfigForEmail("tenant-123", "brand-123"),
      ).rejects.toThrow("Brand with ID brand-123 not found");
    });
  });

  describe("Validation", () => {
    it("should validate email domain matches verification domain", async () => {
      const invalidBrand = {
        ...mockBrand,
        defaultFromEmail: "notifications@otherdomain.com",
        domain: "testcompany.com",
      };

      vi.spyOn(brandRepository, "findById").mockResolvedValue(invalidBrand as Brand);

      await expect(
        brandSesService.verifySESDomain("tenant-123", "brand-123", "testcompany.com"),
      ).rejects.toThrow(
        "The default from email domain (otherdomain.com) must match the domain being verified",
      );
    });

    it("should require email configuration for domain verification", async () => {
      const incompleteBrand = {
        ...mockBrand,
        defaultFromEmail: undefined,
        defaultFromName: undefined,
      };

      vi.spyOn(brandRepository, "findById").mockResolvedValue(incompleteBrand as Brand);

      await expect(
        brandSesService.verifySESDomain("tenant-123", "brand-123", "testcompany.com"),
      ).rejects.toThrow("Domain verification requires the following fields to be set");
    });
  });
});
