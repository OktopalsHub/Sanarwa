import { Test, TestingModule } from '@nestjs/testing';
import { TokenManagementService } from '../services/token-management.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Mock, Mocked } from 'vitest';

// Mock entity for token management
class TokenEntity {
  id: string;
  tenantId: string;
  userId: string;
  tokenType: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

describe('TokenManagementService', () => {
  let service: TokenManagementService;
  let tokenRepository: Mocked<Repository<TokenEntity>>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn(),
        getOne: vi.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenManagementService,
        {
          provide: getRepositoryToken(TokenEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TokenManagementService>(TokenManagementService);
    tokenRepository = module.get(getRepositoryToken(TokenEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateToken', () => {
    it('should generate a new token', async () => {
      const tokenData = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        tokenType: 'access',
        expiresIn: 3600,
      };

      const mockToken = {
        id: '1',
        ...tokenData,
        token: 'generated-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tokenRepository.create.mockReturnValue(mockToken as TokenEntity);
      tokenRepository.save.mockResolvedValue(mockToken as TokenEntity);

      const result = await service.generateToken(tokenData);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(tokenRepository.create).toHaveBeenCalled();
      expect(tokenRepository.save).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should validate active token', async () => {
      const mockToken = {
        id: '1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        tokenType: 'access',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tokenRepository.findOne.mockResolvedValue(mockToken as TokenEntity);

      const result = await service.validateToken('valid-token');

      expect(result).toBeTruthy();
      expect(result.isActive).toBe(true);
      expect(tokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: 'valid-token', isActive: true },
      });
    });

    it('should reject expired token', async () => {
      const mockToken = {
        id: '1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        tokenType: 'access',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 3600 * 1000), // Expired
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tokenRepository.findOne.mockResolvedValue(mockToken as TokenEntity);

      const result = await service.validateToken('expired-token');

      expect(result).toBeFalsy();
    });
  });

  describe('revokeToken', () => {
    it('should revoke token', async () => {
      const mockToken = {
        id: '1',
        token: 'token-to-revoke',
        isActive: true,
      };

      tokenRepository.findOne.mockResolvedValue(mockToken as TokenEntity);
      tokenRepository.save.mockResolvedValue({ ...mockToken, isActive: false } as TokenEntity);

      await service.revokeToken('token-to-revoke');

      expect(tokenRepository.save).toHaveBeenCalledWith({
        ...mockToken,
        isActive: false,
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      const queryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };

      tokenRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.cleanupExpiredTokens();

      expect(tokenRepository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith('expiresAt < :now', { now: expect.any(Date) });
    });
  });
});