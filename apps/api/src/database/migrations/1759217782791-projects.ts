import { MigrationInterface, QueryRunner } from 'typeorm';

export class Projects1759217782791 implements MigrationInterface {
  name = 'Projects1759217782791';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        settings JSONB,
        metadata JSONB,
        tenant_id UUID NOT NULL,
        brand_id UUID,
        created_by_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP,
        CONSTRAINT PK_projects PRIMARY KEY (id),
        CONSTRAINT FK_projects_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_projects_created_by 
      FOREIGN KEY (created_by_id) REFERENCES tenant_members(id) ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('projects');
  }
}
