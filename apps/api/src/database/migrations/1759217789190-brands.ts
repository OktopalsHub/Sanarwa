import { MigrationInterface, QueryRunner } from "typeorm";

export class Brands1759217789190 implements MigrationInterface {
  name = "Brands1759217789190";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        logo VARCHAR(500),
        primary_color VARCHAR(7),
        secondary_color VARCHAR(7),
        domain VARCHAR(255),
        default_from_email VARCHAR(100),
        default_from_name VARCHAR(100),
        reply_to_email VARCHAR(100),
        white_label_config JSONB,
        email_settings JSONB,
        sms_settings JSONB,
        social_links JSONB,
        metadata JSONB,
        tenant_id UUID NOT NULL,
        created_by_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        deleted_at TIMESTAMP,
        CONSTRAINT PK_brands PRIMARY KEY (id),
        CONSTRAINT FK_brands_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_brands_created_by FOREIGN KEY (created_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      )
    `);

    // Add foreign key constraint for projects -> brands now that brands table exists
    await queryRunner.query(`
      ALTER TABLE projects 
      ADD CONSTRAINT FK_projects_brand 
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("brands");
  }
}
