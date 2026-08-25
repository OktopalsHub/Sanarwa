import { MigrationInterface, QueryRunner } from "typeorm";

export class Invites1759217829717 implements MigrationInterface {
  name = "Invites1759217829717";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS invites (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        role VARCHAR(16) NOT NULL DEFAULT 'member',
        expires_at TIMESTAMP NOT NULL,
        tenant_id UUID NOT NULL,
        invited_by_id UUID NOT NULL,
        accepted_at TIMESTAMP,
        declined_at TIMESTAMP,
        invited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_invites_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_invites_invited_by_id FOREIGN KEY (invited_by_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT UQ_invites_email_tenant UNIQUE (email, tenant_id),
        CONSTRAINT UQ_invites_token UNIQUE (token)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_invites_email_tenant ON invites (email, tenant_id);
      CREATE INDEX IF NOT EXISTS IDX_invites_token ON invites (token);
      CREATE INDEX IF NOT EXISTS IDX_invites_status ON invites (status);
      CREATE INDEX IF NOT EXISTS IDX_invites_tenant_id ON invites (tenant_id);
      CREATE INDEX IF NOT EXISTS IDX_invites_expires_at ON invites (expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("invites");
  }
}
