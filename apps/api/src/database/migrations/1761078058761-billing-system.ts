import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingSystem1761078058761 implements MigrationInterface {
  name = 'BillingSystem1761078058761';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        plan VARCHAR(64) NOT NULL DEFAULT 'pay_as_you_go',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        payment_provider VARCHAR(64) NOT NULL,
        external_subscription_id VARCHAR(255),
        external_customer_id VARCHAR(255),
        monthly_price DECIMAL(10,2),
        included_tokens INTEGER,
        overage_rate DECIMAL(10,4),
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        trial_end TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancel_at_period_end BOOLEAN,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_subscriptions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS token_purchases (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        subscription_id UUID,
        token_amount INTEGER NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        price_per_token DECIMAL(10,4) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        type VARCHAR(32) NOT NULL DEFAULT 'manual',
        payment_intent_id VARCHAR(255),
        transaction_reference VARCHAR(255),
        payment_metadata JSONB,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_token_purchases_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_token_purchases_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auto_topup_configs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT true,
        trigger VARCHAR(32) NOT NULL DEFAULT 'threshold',
        threshold_amount INTEGER,
        topup_amount INTEGER,
        schedule_frequency VARCHAR(32),
        scheduled_amount INTEGER,
        schedule_time TIME,
        schedule_day_of_week INTEGER,
        schedule_day_of_month INTEGER,
        last_triggered TIMESTAMP,
        next_scheduled_run TIMESTAMP,
        max_monthly_spend DECIMAL(10,2),
        current_month_spend DECIMAL(10,2) NOT NULL DEFAULT 0,
        current_month INTEGER NOT NULL DEFAULT 1,
        current_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_TIMESTAMP),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_auto_topup_configs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS token_balances (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL UNIQUE,
        total_tokens BIGINT NOT NULL DEFAULT 0,
        used_tokens BIGINT NOT NULL DEFAULT 0,
        available_tokens BIGINT NOT NULL DEFAULT 0,
        reserved_tokens BIGINT NOT NULL DEFAULT 0,
        last_usage TIMESTAMP,
        last_purchase TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_token_balances_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS token_transactions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        type VARCHAR(32) NOT NULL,
        amount BIGINT NOT NULL,
        balance_after BIGINT NOT NULL,
        description VARCHAR(255),
        metadata JSONB,
        reference_id VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_token_transactions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_subscriptions_tenant_id ON subscriptions (tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_token_purchases_tenant_id ON token_purchases (tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_token_balances_tenant_id ON token_balances (tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_token_transactions_tenant_created ON token_transactions (tenant_id, created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS token_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS token_balances`);
    await queryRunner.query(`DROP TABLE IF EXISTS auto_topup_configs`);
    await queryRunner.query(`DROP TABLE IF EXISTS token_purchases`);
    await queryRunner.query(`DROP TABLE IF EXISTS subscriptions`);
  }
}
