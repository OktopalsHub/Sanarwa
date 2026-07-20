import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantSchemaService } from './tenant-schema.service';

describe('TenantSchemaService', () => {
  let service: TenantSchemaService;
  let dataSource: DataSource;

  const mockDataSource = {
    query: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantSchemaService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TenantSchemaService>(TenantSchemaService);
    dataSource = module.get<DataSource>(getDataSourceToken());

    vi.clearAllMocks();
  });

  describe('createTenantSchema', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should create tenant schema successfully', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.createTenantSchema(tenantId);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `CREATE SCHEMA IF NOT EXISTS "${expectedSchemaName}"`,
      );

      // Should create tenant-specific tables
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(
          `CREATE TABLE IF NOT EXISTS "${expectedSchemaName}".`,
        ),
      );
    });

    it('should handle schema creation errors', async () => {
      const error = new Error('Schema creation failed');
      mockDataSource.query.mockRejectedValue(error);

      await expect(service.createTenantSchema(tenantId)).rejects.toThrow(error);
    });
  });

  describe('dropTenantSchema', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should drop tenant schema successfully', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.dropTenantSchema(tenantId);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `DROP SCHEMA IF EXISTS "${expectedSchemaName}" CASCADE`,
      );
    });

    it('should handle schema drop errors', async () => {
      const error = new Error('Schema drop failed');
      mockDataSource.query.mockRejectedValue(error);

      await expect(service.dropTenantSchema(tenantId)).rejects.toThrow(error);
    });
  });

  describe('getTenantConnection', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should set search path and return connection', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getTenantConnection(tenantId);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET search_path TO "${expectedSchemaName}", public`,
      );
      expect(result).toBe(dataSource);
    });
  });

  describe('executeInTenantContext', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should execute function in tenant context and restore search path', async () => {
      const originalSearchPath = 'public';
      const queryResult = { data: 'test' };
      const queryFn = vi.fn().mockResolvedValue(queryResult);

      mockDataSource.query
        .mockResolvedValueOnce([{ search_path: originalSearchPath }]) // getCurrentSearchPath
        .mockResolvedValueOnce([]) // Set tenant search path
        .mockResolvedValueOnce([]); // Restore search path

      const result = await service.executeInTenantContext(tenantId, queryFn);

      expect(mockDataSource.query).toHaveBeenCalledWith('SHOW search_path');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET search_path TO "${expectedSchemaName}", public`,
      );
      expect(queryFn).toHaveBeenCalledWith(dataSource);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET search_path TO ${originalSearchPath}`,
      );
      expect(result).toBe(queryResult);
    });

    it('should restore search path even if query function throws', async () => {
      const originalSearchPath = 'public';
      const error = new Error('Query failed');
      const queryFn = vi.fn().mockRejectedValue(error);

      mockDataSource.query
        .mockResolvedValueOnce([{ search_path: originalSearchPath }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await expect(
        service.executeInTenantContext(tenantId, queryFn),
      ).rejects.toThrow(error);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET search_path TO ${originalSearchPath}`,
      );
    });
  });

  describe('migrateTenantSchema', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should migrate tenant schema successfully', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.migrateTenantSchema(tenantId);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET search_path TO "${expectedSchemaName}", public`,
      );
    });
  });

  describe('tenantSchemaExists', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should return true when schema exists', async () => {
      mockDataSource.query.mockResolvedValue([
        { schema_name: expectedSchemaName },
      ]);

      const result = await service.tenantSchemaExists(tenantId);

      expect(result).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
        [expectedSchemaName],
      );
    });

    it('should return false when schema does not exist', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.tenantSchemaExists(tenantId);

      expect(result).toBe(false);
    });
  });

  describe('getTenantSchemaStats', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

    it('should return schema statistics', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ count: '5' }]) // table count
        .mockResolvedValueOnce([{ size: '1024 MB' }]) // schema size
        .mockResolvedValueOnce([
          { tablename: 'notifications' },
          { tablename: 'templates' },
        ]) // table names
        .mockResolvedValueOnce([{ count: '100' }]) // notifications count
        .mockResolvedValueOnce([{ count: '25' }]); // templates count

      const result = await service.getTenantSchemaStats(tenantId);

      expect(result).toEqual({
        tableCount: 5,
        totalSize: '1024 MB',
        recordCounts: {
          notifications: 100,
          templates: 25,
        },
      });
    });

    it('should handle missing size data', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]) // no size data
        .mockResolvedValueOnce([]);

      const result = await service.getTenantSchemaStats(tenantId);

      expect(result.totalSize).toBe('0 bytes');
    });
  });

  describe('getTenantSchemaName', () => {
    it('should generate correct schema name', () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedSchemaName = 'tenant_123e4567_e89b_12d3_a456_426614174000';

      const result = (service as any).getTenantSchemaName(tenantId);

      expect(result).toBe(expectedSchemaName);
    });

    it('should handle tenant IDs with special characters', () => {
      const tenantId = 'test-tenant-id';
      const expectedSchemaName = 'tenant_test_tenant_id';

      const result = (service as any).getTenantSchemaName(tenantId);

      expect(result).toBe(expectedSchemaName);
    });
  });

  describe('createTenantTables', () => {
    const schemaName = 'tenant_test';

    it('should create all tenant tables', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await (service as any).createTenantTables(schemaName);

      const expectedTables = [
        'notifications',
        'notification_deliveries',
        'templates',
        'provider_configs',
      ];

      expectedTables.forEach((tableName) => {
        expect(mockDataSource.query).toHaveBeenCalledWith(
          expect.stringContaining(
            `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}"`,
          ),
        );
      });
    });

    it('should handle missing tables gracefully', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Table not found'));

      // Should not throw, just log warning
      await expect(
        (service as any).createTenantTables(schemaName),
      ).resolves.not.toThrow();
    });
  });

  describe('getCurrentSearchPath', () => {
    it('should return current search path', async () => {
      const expectedPath = 'public, tenant_test';
      mockDataSource.query.mockResolvedValue([{ search_path: expectedPath }]);

      const result = await (service as any).getCurrentSearchPath();

      expect(result).toBe(expectedPath);
      expect(mockDataSource.query).toHaveBeenCalledWith('SHOW search_path');
    });
  });
});
