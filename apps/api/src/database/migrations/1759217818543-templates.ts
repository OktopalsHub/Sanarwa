import { MigrationInterface, QueryRunner } from "typeorm";

export class Templates1759217818543 implements MigrationInterface {
  name = "Templates1759217818543";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        project_id UUID,
        name VARCHAR(255),
        subject TEXT,
        content TEXT,
        created_by_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT PK_templates PRIMARY KEY (id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS templates`);
  }
}
