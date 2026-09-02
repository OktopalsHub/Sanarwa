import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVoiceCalls1788298445469 implements MigrationInterface {
  name = "CreateVoiceCalls1788298445469";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS voice_calls (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        call_control_id VARCHAR NOT NULL,
        phone_number VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'initiated',
        tts_message TEXT,
        hangup_cause VARCHAR,
        duration INTEGER,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT UQ_voice_calls_call_control_id UNIQUE (call_control_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_voice_calls_tenant_created ON voice_calls (tenant_id, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_voice_calls_tenant_status ON voice_calls (tenant_id, status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS voice_calls`);
  }
}
