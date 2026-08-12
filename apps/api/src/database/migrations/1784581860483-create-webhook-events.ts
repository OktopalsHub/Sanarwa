import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookEvents1784581860483 implements MigrationInterface {
  name = 'CreateWebhookEvents1784581860483';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(32) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        payload_hash VARCHAR(64),
        processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT UQ_webhook_events_provider_event UNIQUE (provider, event_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_webhook_events_provider
        ON webhook_events (provider)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_events`);
  }
}
