import { MigrationInterface, QueryRunner } from "typeorm";

export class TenantMembers1759217768135 implements MigrationInterface {
  name = "TenantMembers1759217768135";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_members (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        role VARCHAR(32) NOT NULL DEFAULT 'member',
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        tenant_id UUID NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP,
        CONSTRAINT PK_tenant_members PRIMARY KEY (id),
        CONSTRAINT FK_tenant_members_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_tenant_members_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_members`);
  }
}
