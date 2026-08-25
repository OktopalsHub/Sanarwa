import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class TenantSchemaService {
  private readonly logger = new Logger(TenantSchemaService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create tenant-specific schema (if using schema-per-tenant approach)
   */
  async createTenantSchema(tenantId: string): Promise<void> {
    const schemaName = this.getTenantSchemaName(tenantId);

    try {
      // Create schema
      await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create tenant-specific tables by copying structure from public schema
      await this.createTenantTables(schemaName);

      this.logger.log(`Created schema for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to create schema for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Drop tenant-specific schema
   */
  async dropTenantSchema(tenantId: string): Promise<void> {
    const schemaName = this.getTenantSchemaName(tenantId);

    try {
      await this.dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      this.logger.log(`Dropped schema for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to drop schema for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get tenant-specific connection with schema context
   */
  async getTenantConnection(tenantId: string): Promise<DataSource> {
    const schemaName = this.getTenantSchemaName(tenantId);

    // Set search path to tenant schema
    await this.dataSource.query(`SET search_path TO "${schemaName}", public`);

    return this.dataSource;
  }

  /**
   * Execute query in tenant context
   */
  async executeInTenantContext<T>(
    tenantId: string,
    queryFn: (connection: DataSource) => Promise<T>,
  ): Promise<T> {
    const originalSearchPath = await this.getCurrentSearchPath();
    const schemaName = this.getTenantSchemaName(tenantId);

    try {
      // Set tenant schema context
      await this.dataSource.query(`SET search_path TO "${schemaName}", public`);

      // Execute query
      const result = await queryFn(this.dataSource);

      return result;
    } finally {
      // Restore original search path
      await this.dataSource.query(`SET search_path TO ${originalSearchPath}`);
    }
  }

  /**
   * Migrate tenant schema to latest version
   */
  async migrateTenantSchema(tenantId: string): Promise<void> {
    const schemaName = this.getTenantSchemaName(tenantId);

    try {
      // Set schema context
      await this.dataSource.query(`SET search_path TO "${schemaName}", public`);

      // Run migrations (this would typically use TypeORM migrations)
      // For now, we'll ensure all tables exist
      await this.createTenantTables(schemaName);

      this.logger.log(`Migrated schema for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to migrate schema for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Check if tenant schema exists
   */
  async tenantSchemaExists(tenantId: string): Promise<boolean> {
    const schemaName = this.getTenantSchemaName(tenantId);

    const result = await this.dataSource.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName],
    );

    return result.length > 0;
  }

  /**
   * Get tenant schema statistics
   */
  async getTenantSchemaStats(tenantId: string): Promise<{
    tableCount: number;
    totalSize: string;
    recordCounts: Record<string, number>;
  }> {
    const schemaName = this.getTenantSchemaName(tenantId);

    // Get table count
    const tableCountResult = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = $1`,
      [schemaName],
    );

    // Get schema size
    const sizeResult = await this.dataSource.query(
      `SELECT pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size
       FROM pg_tables WHERE schemaname = $1`,
      [schemaName],
    );

    // Get record counts for each table
    const tablesResult = await this.dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1`,
      [schemaName],
    );

    const recordCounts: Record<string, number> = {};
    for (const table of tablesResult) {
      const countResult = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${schemaName}"."${table.tablename}"`,
      );
      recordCounts[table.tablename] = parseInt(countResult[0].count);
    }

    return {
      tableCount: parseInt(tableCountResult[0].count),
      totalSize: sizeResult[0]?.size || "0 bytes",
      recordCounts,
    };
  }

  /**
   * Generate tenant schema name
   */
  private getTenantSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, "_")}`;
  }

  /**
   * Create tenant-specific tables
   */
  private async createTenantTables(schemaName: string): Promise<void> {
    // List of tables that should be created per tenant
    const tenantTables = [
      "notifications",
      "notification_deliveries",
      "templates",
      "provider_configs",
    ];

    for (const tableName of tenantTables) {
      await this.createTableInSchema(schemaName, tableName);
    }
  }

  /**
   * Create a specific table in tenant schema
   */
  private async createTableInSchema(schemaName: string, tableName: string): Promise<void> {
    try {
      // Copy table structure from public schema to tenant schema
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" 
        (LIKE public."${tableName}" INCLUDING ALL)
      `);
    } catch (error) {
      // If table doesn't exist in public schema, skip
      this.logger.warn(`Table ${tableName} not found in public schema, skipping`);
    }
  }

  /**
   * Get current search path
   */
  private async getCurrentSearchPath(): Promise<string> {
    const result = await this.dataSource.query("SHOW search_path");
    return result[0].search_path;
  }
}
