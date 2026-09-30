import { MigrationInterface, QueryRunner } from "typeorm";

export class DeadLetters1784543893390 implements MigrationInterface {
  name = "DeadLetters1784543893390";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dead_letters (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        original_type VARCHAR NOT NULL,
        original_id UUID NOT NULL,
        failure_reason TEXT NOT NULL,
        failed_at TIMESTAMP NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR NOT NULL DEFAULT 'pending_review',
        original_job_data JSONB,
        message_data JSONB,
        delivery_data JSONB,
        metadata JSONB,
        resolution_notes TEXT,
        resolved_by UUID,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_dead_letters_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_dead_letters_tenant_id ON dead_letters (tenant_id);
      CREATE INDEX IF NOT EXISTS IDX_dead_letters_original_type ON dead_letters (original_type);
      CREATE INDEX IF NOT EXISTS IDX_dead_letters_status ON dead_letters (status);
      CREATE INDEX IF NOT EXISTS IDX_dead_letters_created_at ON dead_letters (created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS dead_letters`);
  }
}
