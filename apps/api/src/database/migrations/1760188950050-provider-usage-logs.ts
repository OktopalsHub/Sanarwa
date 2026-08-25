import { MigrationInterface, QueryRunner } from "typeorm";

export class ProviderUsageLogs1760188950050 implements MigrationInterface {
  name = "ProviderUsageLogs1760188950050";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS provider_usage_logs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        provider_config_id UUID NOT NULL,
        channel VARCHAR(50) NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        successful_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        total_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
        provider_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
        infrastructure_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
        average_latency_ms INTEGER NOT NULL DEFAULT 0,
        error_breakdown JSONB,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT PK_provider_usage_logs PRIMARY KEY (id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS provider_usage_logs`);
  }
}
