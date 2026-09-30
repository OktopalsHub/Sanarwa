import { Test, TestingModule } from "@nestjs/testing";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("hashPassword", () => {
    it("should hash a password", async () => {
      const password = "testPassword123!";
      const hash = await service.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it("should generate different hashes for the same password", async () => {
      const password = "testPassword123!";
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    it("should verify a correct password", async () => {
      const password = "testPassword123!";
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword(hash, password);

      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "testPassword123!";
      const wrongPassword = "wrongPassword123!";
      const hash = await service.hashPassword(password);
      const isValid = await service.verifyPassword(hash, wrongPassword);

      expect(isValid).toBe(false);
    });
  });

  describe("generateRandomPassword", () => {
    it("should generate a password with default length", () => {
      const password = service.generateRandomPassword();
      expect(password.length).toBe(16);
    });

    it("should generate a password with custom length", () => {
      const length = 24;
      const password = service.generateRandomPassword(length);
      expect(password.length).toBe(length);
    });

    it("should generate different passwords", () => {
      const password1 = service.generateRandomPassword();
      const password2 = service.generateRandomPassword();
      expect(password1).not.toBe(password2);
    });
  });

  describe("validatePasswordStrength", () => {
    it("should validate a strong password", () => {
      const password = "StrongPassword123!";
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(3);
    });

    it("should reject a password that is too short", () => {
      const password = "Short1!";
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must be at least 8 characters long");
    });

    it("should reject a password without lowercase letters", () => {
      const password = "PASSWORD123!";
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one lowercase letter");
    });

    it("should reject a password without uppercase letters", () => {
      const password = "password123!";
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one uppercase letter");
    });

    it("should reject a password without numbers", () => {
      const password = "Password!";
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one number");
    });

    it("should reject a password without special characters", () => {
      const password = "Password123";
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one special character");
    });

    it("should give bonus score for longer passwords", () => {
      const shortPassword = "Pass12"; // 6 characters, missing special char, score = 3
      const longPassword = "VeryLongPassword123!"; // 20 characters, all criteria + length bonus, score = 5 (capped)

      const shortResult = service.validatePasswordStrength(shortPassword);
      const longResult = service.validatePasswordStrength(longPassword);

      // Long password should have higher score
      expect(longResult.score).toBeGreaterThan(shortResult.score);
      expect(longResult.score).toBe(5); // Max score
      expect(shortResult.score).toBeLessThan(5);
    });
  });
});
