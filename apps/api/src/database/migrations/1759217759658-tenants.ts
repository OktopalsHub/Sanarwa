import { MigrationInterface, QueryRunner } from "typeorm";

export class Tenants1759217759658 implements MigrationInterface {
  name = "Tenants1759217759658";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(50) UNIQUE NOT NULL,
        invite_code VARCHAR(6) UNIQUE NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        quotas JSONB NOT NULL,
        usage JSONB,
        last_active_at TIMESTAMP,
        owner_id VARCHAR(36),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (owner_id) REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("tenants");
  }
}
