import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCampaigns1787695570150 implements MigrationInterface {
  name = "CreateCampaigns1787695570150";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(36) NOT NULL,
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(32) NOT NULL DEFAULT 'one_time',
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        channels JSONB NOT NULL DEFAULT '[]',
        audience JSONB NOT NULL DEFAULT '{}',
        schedule JSONB NOT NULL DEFAULT '{}',
        templates JSONB NOT NULL DEFAULT '[]',
        analytics JSONB NOT NULL DEFAULT '{}',
        created_by UUID,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_campaigns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_campaigns_tenant_status ON campaigns (tenant_id, status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_campaigns_tenant_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS campaigns`);
  }
}
