import { MigrationInterface, QueryRunner } from 'typeorm';

export class User1759217753253 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user table with VARCHAR ID
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id VARCHAR(36) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255),
        email_verified BOOLEAN NOT NULL DEFAULT false,
        name VARCHAR(100),
        image VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    // Create accounts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS account (
        id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        account_id VARCHAR(255),
        provider_id VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        access_token_expires_at TIMESTAMP,
        refresh_token_expires_at TIMESTAMP,
        scope TEXT,
        id_token TEXT,
        password TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);

    // Create sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS session (
        id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        token TEXT UNIQUE,
        expires_at TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);

    // Create verifications table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS verification (
        id VARCHAR(36) NOT NULL,
        identifier VARCHAR(100) NOT NULL,
        value VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS IDX_user_email ON "user" (email);
      CREATE INDEX IF NOT EXISTS IDX_account_user_id ON account (user_id);
      CREATE INDEX IF NOT EXISTS IDX_session_user_id ON session (user_id);
      CREATE INDEX IF NOT EXISTS IDX_verification_identifier ON verification (identifier);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop auth tables
    await queryRunner.query(`
      DROP TABLE IF EXISTS verification;
      DROP TABLE IF EXISTS session;
      DROP TABLE IF EXISTS account;
    `);

    // Drop user table
    await queryRunner.dropTable('user');
  }
}
