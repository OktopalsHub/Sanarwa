import { MigrationInterface, QueryRunner } from "typeorm";

export class DeviceRegistrations1760919969818 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create device_registrations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS device_registrations (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        subscriber_id VARCHAR(36) NOT NULL,
        tenant_id UUID NOT NULL,
        device_token VARCHAR(500) NOT NULL,
        platform VARCHAR(16) NOT NULL DEFAULT 'unknown',
        provider VARCHAR(16)  NOT NULL DEFAULT 'sns',
        app_bundle_id VARCHAR(255),
        device_info JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_subscriber_tenant ON device_registrations (subscriber_id, tenant_id);
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_device_registrations_unique ON device_registrations (device_token, subscriber_id, tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_platform_active ON device_registrations (platform, is_active);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_provider_active ON device_registrations (provider, is_active);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_subscriber_id ON device_registrations (subscriber_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_tenant_id ON device_registrations (tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_device_token ON device_registrations (device_token);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_last_seen ON device_registrations (last_seen);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_device_registrations_is_active ON device_registrations (is_active);
    `);

    // Add foreign key constraints (assuming users and tenants tables exist)
    await queryRunner.query(`
      ALTER TABLE device_registrations 
      ADD CONSTRAINT fk_device_registrations_subscriber 
      FOREIGN KEY (subscriber_id) REFERENCES "user"(id) ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE device_registrations 
      ADD CONSTRAINT fk_device_registrations_tenant 
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);

    // Add trigger to update updated_at timestamp
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_device_registrations_updated_at 
      BEFORE UPDATE ON device_registrations 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger and function
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_device_registrations_updated_at ON device_registrations;`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column();`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS device_registrations;`);
  }
}
