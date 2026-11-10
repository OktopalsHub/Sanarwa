import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794349055401 implements MigrationInterface {
  name = "InitialSchema1794349055401";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "config_key" character varying(255) NOT NULL, "config_value" jsonb NOT NULL, "config_type" character varying(50) NOT NULL DEFAULT 'general', "description" character varying(500), "is_encrypted" boolean NOT NULL DEFAULT false, "is_system" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "validation_schema" jsonb, "default_value" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by_id" character varying(36), CONSTRAINT "PK_ef9fc29709cc5fc66610fc6a664" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_862351304f050ede746dd216b1" ON "configurations"  ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8ba365604f3d49aaaf4db4598b" ON "configurations"  ("config_type") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c02c349cfef4799e17ef746eb1" ON "configurations"  ("tenant_id", "config_key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invites_status_enum" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invites_role_enum" AS ENUM('owner', 'admin', 'member', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "token" character varying(255) NOT NULL, "status" "public"."invites_status_enum" NOT NULL DEFAULT 'pending', "role" "public"."invites_role_enum" NOT NULL DEFAULT 'member', "expires_at" TIMESTAMP NOT NULL, "tenant_id" character varying NOT NULL, "accepted_at" TIMESTAMP, "declined_at" TIMESTAMP, "invited_at" TIMESTAMP NOT NULL, "invited_by_id" character varying(36), CONSTRAINT "UQ_18a9a6c85f7cc6f42ebef3b3188" UNIQUE ("token"), CONSTRAINT "PK_aa52e96b44a714372f4dd31a0af" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_966019af04a8fff533d87203c2" ON "invites"  ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_18a9a6c85f7cc6f42ebef3b318" ON "invites"  ("token") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2c6981e09ba258d84b7f510395" ON "invites"  ("email", "tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_deliveries_status_enum" AS ENUM('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'unsubscribed', 'skipped')`,
    );
    await queryRunner.query(
      `CREATE TABLE "message_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "channel" character varying(20) NOT NULL, "provider_id" character varying NOT NULL, "recipient" character varying(500) NOT NULL, "status" "public"."message_deliveries_status_enum" NOT NULL DEFAULT 'pending', "provider_message_id" character varying NOT NULL, "provider_response" json, "error_message" text, "retry_count" integer NOT NULL DEFAULT '0', "sent_at" TIMESTAMP, "delivered_at" TIMESTAMP, "opened_at" TIMESTAMP, "clicked_at" TIMESTAMP, "metadata" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a582991a821a658d1ffab3d8556" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_764d21f361d0f6b155ad2273de" ON "message_deliveries"  ("message_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bc0b44588ac7b4bd5c95a40abb" ON "message_deliveries"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adf99ea07dc5b73e92b87c2942" ON "message_deliveries"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c83c1a9962f356257ac91c61a1" ON "message_deliveries"  ("provider_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b746d4f69fbef5d7f552b3b0b3" ON "message_deliveries"  ("channel", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fdecedcba754e65f7888bfd331" ON "message_deliveries"  ("message_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_status_enum" AS ENUM('pending', 'processing', 'sent', 'delivered', 'partially_delivered', 'failed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_priority_enum" AS ENUM('low', 'normal', 'high', 'urgent')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "template_id" character varying NOT NULL, "channels" json NOT NULL, "recipients" json NOT NULL, "variables" json NOT NULL, "status" "public"."messages_status_enum" NOT NULL DEFAULT 'pending', "priority" "public"."messages_priority_enum" NOT NULL DEFAULT 'normal', "scheduled_at" TIMESTAMP, "subject" text, "data" text, "metadata" json, "retry_count" integer NOT NULL DEFAULT '0', "error_message" text, "delivered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by_id" character varying(36), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_558150f45586066db2415eb28c" ON "messages"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_014fd1d6dfb6c8fcf44e92fbc4" ON "messages"  ("scheduled_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e80e763a87656d475402cbf621" ON "messages"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b5f94ffd3a2c5eb77062c0e465" ON "messages"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."provider_configs_provider_type_enum" AS ENUM('aws_ses', 'aws_sns', 'aws_pinpoint', 'termii', 'twilio', 'sendgrid', 'smtp', 'firebase', 'whatsapp', 'whatsapp_business', 'slack', 'discord', 'telegram', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TABLE "provider_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" character varying NOT NULL, "provider_id" character varying NOT NULL, "provider_name" character varying(100) NOT NULL, "provider_type" "public"."provider_configs_provider_type_enum" NOT NULL, "channel" character varying(20) NOT NULL, "config" json NOT NULL, "priority" integer NOT NULL DEFAULT '1', "is_active" boolean NOT NULL DEFAULT true, "is_default" boolean NOT NULL DEFAULT false, "supported_countries" json, "rate_limits" json, "metadata" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by_id" character varying(36), CONSTRAINT "UQ_56efb4cbf5466d2a55284dc0ed4" UNIQUE ("project_id", "provider_id", "channel"), CONSTRAINT "PK_00bf1b21735102954736b29cdb8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d81bc2b2694878015019c248c5" ON "provider_configs"  ("project_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69b625e46054a8716a36f87fe4" ON "provider_configs"  ("project_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1d52669971dfb5e97111ae17d" ON "provider_configs"  ("project_id", "channel") `,
    );
    await queryRunner.query(
      `CREATE TABLE "account" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" character varying(36) NOT NULL, "account_id" character varying(255), "provider_id" character varying(255), "access_token" text, "refresh_token" text, "id_token" text, "access_token_expires_at" TIMESTAMP, "refresh_token_expires_at" TIMESTAMP, "scope" text, "password" text, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_918ed923e61b4a2df82acccc00" ON "account"  ("provider_id", "account_id") WHERE provider_id IS NOT NULL AND account_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_efef1e5fdbe318a379c06678c5" ON "account"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" character varying(36) NOT NULL, "active_organization_id" character varying(36), "expires_at" TIMESTAMP NOT NULL, "token" text NOT NULL, "ip_address" character varying(45), "user_agent" text, CONSTRAINT "UQ_232f8e85d7633bd6ddfad421696" UNIQUE ("token"), CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_232f8e85d7633bd6ddfad42169" ON "session"  ("token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ff9670b9425f3cd85959daae6d" ON "session"  ("active_organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_30e98e8746699fb9af235410af" ON "session"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying(100) NOT NULL, "password" character varying(255), "email_verified" boolean NOT NULL DEFAULT false, "name" character varying(100) NOT NULL, "image" character varying(255), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."push_certificates_type_enum" AS ENUM('ios', 'android')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."push_certificates_status_enum" AS ENUM('active', 'inactive', 'expired', 'revoked', 'pending_validation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."push_certificates_environment_enum" AS ENUM('development', 'production')`,
    );
    await queryRunner.query(
      `CREATE TABLE "push_certificates" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" text, "type" "public"."push_certificates_type_enum" NOT NULL, "status" "public"."push_certificates_status_enum" NOT NULL DEFAULT 'pending_validation', "environment" "public"."push_certificates_environment_enum" NOT NULL DEFAULT 'development', "certificate_data" json NOT NULL, "expires_at" TIMESTAMP, "issued_at" TIMESTAMP, "issuer" character varying, "subject" character varying, "fingerprint" text, "last_validated_at" TIMESTAMP, "last_tested_at" TIMESTAMP, "validation_result" json, "test_result" json, "total_notifications_sent" integer NOT NULL DEFAULT '0', "last_used_at" TIMESTAMP, "rotation_config" json, "next_rotation_at" TIMESTAMP, "allowed_projects" text, "access_control" json, "tags" text, "metadata" json, "tenant_id" character varying NOT NULL, "created_by_id" character varying NOT NULL, "project_id" character varying, CONSTRAINT "PK_6a0ed1ca75a4770dd823d1c60de" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_members_role_enum" AS ENUM('owner', 'admin', 'member', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenant_members_status_enum" AS ENUM('active', 'inactive', 'pending')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_members" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "role" "public"."tenant_members_role_enum" NOT NULL DEFAULT 'member', "status" "public"."tenant_members_status_enum" NOT NULL DEFAULT 'active', "name" text, "avatar" text, "tenant_id" character varying NOT NULL, "user_id" character varying NOT NULL, CONSTRAINT "PK_f698fea03ae8f690b936971aa99" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45aa4b00b2400b1852516f2bdc" ON "tenant_members"  ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0b89826fd3107a38e93be7f7e0" ON "tenant_members"  ("tenant_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."brands_status_enum" AS ENUM('active', 'inactive', 'pending_verification')`,
    );
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "domain" character varying, "status" "public"."brands_status_enum" NOT NULL DEFAULT 'active', "logo" character varying, "primary_color" character varying(7), "secondary_color" character varying(7), "default_from_email" character varying, "default_from_name" character varying, "reply_to_email" character varying NOT NULL, "white_label_config" json, "email_settings" json, "sms_settings" json, "social_links" json, "metadata" json, "created_by_id" character varying(36), "tenant_id" character varying(36), CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" character varying NOT NULL, "name" character varying(255), "url" character varying(2048) NOT NULL, "secret" character varying(255), "events" jsonb NOT NULL DEFAULT '[]', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ffa6f0eb99be341d486fc8c9ff" ON "webhooks"  ("active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d6fcde4ac5ca1d5823f51aa18" ON "webhooks"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_settings" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "email_notifications_enabled" boolean NOT NULL DEFAULT true, "two_factor_auth_required" boolean NOT NULL DEFAULT false, "timezone" character varying(50), "language" character varying(10), "notification_storage_policy" character varying(32) NOT NULL DEFAULT 'metadata_only', "content_retention_days" integer, "custom_branding" json, "retention_policy" json, "metadata" json, "tenant_id" character varying NOT NULL, CONSTRAINT "REL_a6abc1c3ed0df635955fc852f1" UNIQUE ("tenant_id"), CONSTRAINT "PK_69225c0ca64bcbbf9af8a217043" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tenants_status_enum" AS ENUM('active', 'suspended', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "subdomain" character varying(50) NOT NULL, "invite_code" character varying(6) NOT NULL, "status" "public"."tenants_status_enum" NOT NULL DEFAULT 'active', "quotas" json NOT NULL, "usage" json, "last_active_at" TIMESTAMP, "deleted_at" TIMESTAMP, "owner_id" character varying NOT NULL, CONSTRAINT "UQ_21bb89e012fa5b58532009c1601" UNIQUE ("subdomain"), CONSTRAINT "UQ_9ee3b77c794ec9d9358cddfaffc" UNIQUE ("invite_code"), CONSTRAINT "UQ_21bb89e012fa5b58532009c1601" UNIQUE ("subdomain"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c59559e7872bc9726adef4669f" ON "tenants"  ("status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."templates_status_enum" AS ENUM('draft', 'active', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "project_id" character varying, "name" character varying(255), "description" text, "is_default" boolean NOT NULL DEFAULT false, "channel" character varying(50) NOT NULL DEFAULT 'email', "subject" text, "data" text, "meta" json, "variables" jsonb, "status" "public"."templates_status_enum" NOT NULL DEFAULT 'draft', "version" integer NOT NULL DEFAULT '1', "parent_template_id" uuid, "channel_specific" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by_id" character varying(36), CONSTRAINT "PK_515948649ce0bbbe391de702ae5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4d669ade634dfa6f9b98521edf" ON "templates"  ("tenant_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b61f2e3babe7038c5e3e1351b" ON "templates"  ("tenant_id", "channel") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."projects_status_enum" AS ENUM('active', 'inactive', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "status" "public"."projects_status_enum" NOT NULL DEFAULT 'active', "metadata" json, "tenant_id" character varying NOT NULL, "brand_id" character varying(36), "created_by_id" character varying(36), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3748e4d84654129e867486bb67" ON "projects"  ("tenant_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a27865a7be17886e3088f4a650" ON "projects"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7393a03ef67e2ea91b81faa95d" ON "projects"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."api_keys_environment_enum" AS ENUM('production', 'development')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."api_keys_status_enum" AS ENUM('active', 'inactive', 'revoked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "key_hash" character varying NOT NULL, "key_prefix" character varying NOT NULL, "environment" "public"."api_keys_environment_enum" NOT NULL DEFAULT 'production', "status" "public"."api_keys_status_enum" NOT NULL DEFAULT 'active', "permissions" json NOT NULL DEFAULT '["notifications:send", "templates:read"]', "ip_whitelist" json, "expires_at" TIMESTAMP, "last_used_at" TIMESTAMP, "last_used_ip" character varying, "usage_count" integer NOT NULL DEFAULT '0', "rate_limit_per_minute" integer NOT NULL DEFAULT '1000', "rate_limit_per_hour" integer NOT NULL DEFAULT '10000', "rate_limit_per_day" integer NOT NULL DEFAULT '100000', "metadata" json, "project_id" character varying NOT NULL, "created_by_id" character varying, CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e836681c884f5c577f7dd79cf9" ON "api_keys"  ("project_id", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b99bbb8e545065a99b409dbc5d" ON "api_keys"  ("key_prefix") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_57384430aa1959f4578046c9b8" ON "api_keys"  ("key_hash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."token_purchases_status_enum" AS ENUM('pending', 'completed', 'failed', 'refunded')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."token_purchases_type_enum" AS ENUM('manual', 'auto_topup', 'scheduled', 'overage')`,
    );
    await queryRunner.query(
      `CREATE TABLE "token_purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "subscription_id" uuid, "token_amount" integer NOT NULL, "total_price" numeric(10,2) NOT NULL, "price_per_token" numeric(10,4) NOT NULL, "status" "public"."token_purchases_status_enum" NOT NULL DEFAULT 'pending', "type" "public"."token_purchases_type_enum" NOT NULL DEFAULT 'manual', "payment_intent_id" character varying, "transaction_reference" character varying, "payment_metadata" json, "completed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6bfcf3c296d0dd02fe2960c8411" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_plan_enum" AS ENUM('starter', 'professional', 'enterprise', 'pay_as_you_go')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('active', 'cancelled', 'past_due', 'unpaid', 'trialing')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_payment_provider_enum" AS ENUM('bachs')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "plan" "public"."subscriptions_plan_enum" NOT NULL DEFAULT 'pay_as_you_go', "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active', "payment_provider" "public"."subscriptions_payment_provider_enum" NOT NULL, "external_subscription_id" character varying, "external_customer_id" character varying, "monthly_price" numeric(10,2), "included_tokens" integer, "overage_rate" numeric(10,4), "current_period_start" TIMESTAMP, "current_period_end" TIMESTAMP, "trial_end" TIMESTAMP, "cancelled_at" TIMESTAMP, "cancel_at_period_end" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "token_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "total_tokens" bigint NOT NULL DEFAULT '0', "used_tokens" bigint NOT NULL DEFAULT '0', "available_tokens" bigint NOT NULL DEFAULT '0', "reserved_tokens" bigint NOT NULL DEFAULT '0', "last_usage" TIMESTAMP, "last_purchase" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e12dc361a93cf25efa25d0a4cdc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3515a4cea8328b8cc41cc91396" ON "token_balances"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."token_transactions_type_enum" AS ENUM('purchase', 'usage', 'refund', 'bonus', 'expiry')`,
    );
    await queryRunner.query(
      `CREATE TABLE "token_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "type" "public"."token_transactions_type_enum" NOT NULL, "amount" bigint NOT NULL, "balance_after" bigint NOT NULL, "description" character varying, "metadata" json, "reference_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_44a80aad9a3477ae6902ecc7fd2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_token_purchase_reference_unique" ON "token_transactions"  ("tenant_id", "reference_id") WHERE "type" = 'purchase' AND "reference_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_49c35a3d955dafb3cfd6ffdf5b" ON "token_transactions"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_payment_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "provider" character varying(16) NOT NULL, "currency" character varying(8) NOT NULL, "external_customer_id" character varying(255) NOT NULL, "external_payment_method_id" character varying(255), "external_subscription_id" character varying(255), "card_brand" character varying(32), "card_last4" character varying(4), "card_exp_month" integer, "card_exp_year" integer, "status" character varying(16) NOT NULL DEFAULT 'active', "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f82662f1d0f8b498b153996aa9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auto_topup_configs_trigger_enum" AS ENUM('threshold', 'scheduled', 'both')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auto_topup_configs_schedule_frequency_enum" AS ENUM('daily', 'weekly', 'monthly')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auto_topup_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "trigger" "public"."auto_topup_configs_trigger_enum" NOT NULL DEFAULT 'threshold', "threshold_amount" integer, "topup_amount" integer, "schedule_frequency" "public"."auto_topup_configs_schedule_frequency_enum", "scheduled_amount" integer, "schedule_time" TIME, "schedule_day_of_week" integer, "schedule_day_of_month" integer, "last_triggered" TIMESTAMP, "next_scheduled_run" TIMESTAMP, "max_monthly_spend" numeric(10,2), "current_month_spend" numeric(10,2) NOT NULL DEFAULT '0', "current_month" integer NOT NULL DEFAULT '1', "current_year" integer NOT NULL DEFAULT '2026', "package_id" character varying(64), "currency" character varying(8), "payment_method_id" uuid, "setup_reference" character varying(128), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f8b36627c1bfede89304f4b5457" UNIQUE ("tenant_id"), CONSTRAINT "PK_af1714d3b532d1e026a966ef8d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tracking_id" character varying NOT NULL, "channel" character varying(32) NOT NULL, "to" character varying NOT NULL, "status" character varying NOT NULL, "tenant_id" character varying NOT NULL, "project_id" character varying NOT NULL, "external_id" character varying, "error" text, "scheduled_at" TIMESTAMP, "sent_at" TIMESTAMP, "delivered_at" TIMESTAMP, "failed_at" TIMESTAMP, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d622c78dec24303756a0996c3d2" UNIQUE ("tracking_id"), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf3808c90b68b06f22820d6168" ON "notification_logs"  ("channel", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d622c78dec24303756a0996c3d" ON "notification_logs"  ("tracking_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40a8ae2886ad13e65de5db4ac2" ON "notification_logs"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "provider_usage_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider_config_id" uuid NOT NULL, "channel" character varying(50) NOT NULL, "message_count" integer NOT NULL, "successful_count" integer NOT NULL, "failed_count" integer NOT NULL, "total_cost" numeric(10,4) NOT NULL, "provider_cost" numeric(10,4) NOT NULL, "infrastructure_cost" numeric(10,4) NOT NULL, "average_latency_ms" integer NOT NULL, "error_breakdown" json, "currency" character varying(3) NOT NULL, "period_start" TIMESTAMP NOT NULL, "period_end" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bff5acf41284046349d163b43f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_registrations_platform_enum" AS ENUM('ios', 'android', 'web', 'desktop', 'unknown')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_registrations_provider_enum" AS ENUM('apns', 'fcm', 'web_push', 'sns', 'expo')`,
    );
    await queryRunner.query(
      `CREATE TABLE "device_registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscriber_id" character varying NOT NULL, "tenant_id" character varying NOT NULL, "device_token" character varying(500) NOT NULL, "platform" "public"."device_registrations_platform_enum" NOT NULL DEFAULT 'unknown', "provider" "public"."device_registrations_provider_enum" NOT NULL DEFAULT 'sns', "app_bundle_id" character varying, "device_info" jsonb NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, "last_seen" TIMESTAMP NOT NULL, "registered_at" TIMESTAMP NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a83f3de55b187b15c6c9adc6275" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c2f22538f5dcd9bbcb9c22a1b" ON "device_registrations"  ("subscriber_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4837abb6021218988f32c2b69c" ON "device_registrations"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0f13ab4f159eba767a73aa13bc" ON "device_registrations"  ("device_token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ca89f4f7c69fe3de57e43bf99" ON "device_registrations"  ("is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad38dbe1c700d005ffa7d15331" ON "device_registrations"  ("last_seen") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f61e6e81e06c7e18fc512aadb" ON "device_registrations"  ("provider", "is_active") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52ddae43de920b6ac483f87992" ON "device_registrations"  ("platform", "is_active") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7ba72abda30b7d38fdae7efa03" ON "device_registrations"  ("device_token", "subscriber_id", "tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9b632fd15962822ed35bff6bee" ON "device_registrations"  ("subscriber_id", "tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."security_events_event_type_enum" AS ENUM('login_success', 'login_failure', 'logout', 'password_change', 'password_reset_request', 'password_reset_success', 'api_key_created', 'api_key_revoked', 'api_key_used', 'unauthorized_access', 'permission_denied', 'account_locked', 'account_unlocked', 'suspicious_activity', 'data_encryption', 'data_decryption', 'encryption_key_rotation', 'session_created', 'session_expired', 'session_invalidated', 'rate_limit_exceeded', 'ip_blocked', 'security_scan_detected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."security_events_severity_enum" AS ENUM('low', 'medium', 'high', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TABLE "security_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying, "user_id" character varying, "event_type" "public"."security_events_event_type_enum" NOT NULL, "severity" "public"."security_events_severity_enum" NOT NULL DEFAULT 'low', "description" text NOT NULL, "ip_address" character varying, "user_agent" character varying, "session_id" character varying, "resource_type" character varying, "resource_id" character varying, "metadata" json, "request_details" json, "resolved" boolean NOT NULL DEFAULT false, "resolved_by" character varying, "resolved_at" TIMESTAMP, "resolution" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6fc100d6700780737348df0d3ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63fea9549fcb8977a3c0abd783" ON "security_events"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d1891b273f5c77638d2149a9f0" ON "security_events"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87c998073af994bb49340be58c" ON "security_events"  ("ip_address") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7567faf52e0f0da34dbab2daf3" ON "security_events"  ("severity", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d86aa84090327c9a94aee62e18" ON "security_events"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ac629a2858187ee1dbc4e52e27" ON "security_events"  ("ip_address", "event_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c873234e7d7239ccaae62779a" ON "security_events"  ("user_id", "event_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f4acde77e041da1c66cf5cc365" ON "security_events"  ("tenant_id", "event_type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."configuration_versions_action_enum" AS ENUM('create', 'update', 'delete', 'rollback')`,
    );
    await queryRunner.query(
      `CREATE TABLE "configuration_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "configuration_id" character varying NOT NULL, "version" integer NOT NULL, "previous_value" text, "new_value" text NOT NULL, "action" "public"."configuration_versions_action_enum" NOT NULL, "change_reason" character varying(500), "changed_by" character varying, "change_metadata" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "configurationId" uuid, CONSTRAINT "PK_3e61db976b3136fdfc0664d00c0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2aca29024c17f7e7284d1a4d93" ON "configuration_versions"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1eaabb0c9669230c5de4424266" ON "configuration_versions"  ("configuration_id", "version") `,
    );
    await queryRunner.query(
      `CREATE TABLE "verification" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "identifier" character varying(100) NOT NULL, "token" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, CONSTRAINT "UQ_9f6123129312c1eb442bec455d6" UNIQUE ("token"), CONSTRAINT "PK_f7e3a90ca384e71d6e2e93bb340" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fcf8c31632dc768a91c9b5652a" ON "verification"  ("identifier", "token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organization" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" text NOT NULL, "slug" text NOT NULL, "logo" text, "metadata" text, CONSTRAINT "UQ_a08804baa7c5d5427067c49a31f" UNIQUE ("slug"), CONSTRAINT "PK_472c1f99a32def1b0abb219cd67" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a08804baa7c5d5427067c49a31" ON "organization"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "member" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "organization_id" character varying(36) NOT NULL, "user_id" character varying(36) NOT NULL, "role" text NOT NULL DEFAULT 'member', "name" text, "avatar" text, CONSTRAINT "PK_97cbbe986ce9d14ca5894fdc072" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_efc766611e939bdbe6f7088984" ON "member"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bfadaaab56ae7b5f2d76885d03" ON "member"  ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e2ca32cb72cafdf81b71062459" ON "member"  ("organization_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "invitation" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "organization_id" character varying(36) NOT NULL, "email" text NOT NULL, "role" text, "status" text NOT NULL DEFAULT 'pending', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "inviter_id" character varying(36) NOT NULL, CONSTRAINT "PK_beb994737756c0f18a1c1f8669c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bcb0a0d2333443083582a05cdd" ON "invitation"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_de7c148c7834d738ac7113f3dd" ON "invitation"  ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0d83b1de272a6d77656eeb5bcb" ON "invitation"  ("organization_id", "email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "apikey" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "config_id" text NOT NULL DEFAULT 'organization', "name" text, "start" text, "reference_id" character varying(36) NOT NULL, "prefix" text, "key" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "rate_limit_enabled" boolean NOT NULL DEFAULT true, "rate_limit_time_window" integer, "rate_limit_max" integer, "request_count" integer NOT NULL DEFAULT '0', "remaining" integer, "last_request" TIMESTAMP, "expires_at" TIMESTAMP, "permissions" text, "metadata" text, CONSTRAINT "PK_0a1358bea3e5a3ba047b6e4959c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_86d97df78920c5d9f621c0d604" ON "apikey"  ("key") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_514633b3554a4b1f77ce6dbbf3" ON "apikey"  ("reference_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."dead_letters_original_type_enum" AS ENUM('notification', 'delivery', 'webhook', 'system')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."dead_letters_status_enum" AS ENUM('pending_review', 'under_investigation', 'resolved', 'ignored')`,
    );
    await queryRunner.query(
      `CREATE TABLE "dead_letters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "original_type" "public"."dead_letters_original_type_enum" NOT NULL, "original_id" character varying NOT NULL, "failure_reason" text NOT NULL, "failed_at" TIMESTAMP NOT NULL, "retry_count" integer NOT NULL DEFAULT '0', "status" "public"."dead_letters_status_enum" NOT NULL DEFAULT 'pending_review', "original_job_data" json, "message_data" json, "delivery_data" json, "metadata" json, "resolution_notes" text, "resolved_by" uuid, "resolved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_084e63809483fb0a9c48aae607f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0d769be8a8d0c7a1a5d4c1d77a" ON "dead_letters"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33dc258f52abeba4bab8f4f5f4" ON "dead_letters"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17ed3f7e7d06f1d90bdc0ddedf" ON "dead_letters"  ("original_type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_874114dd4a32c08ab0113e0328" ON "dead_letters"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."in_app_notifications_type_enum" AS ENUM('info', 'warning', 'error', 'success', 'system', 'user_action', 'marketing')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."in_app_notifications_status_enum" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "in_app_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "message" text NOT NULL, "type" "public"."in_app_notifications_type_enum" NOT NULL DEFAULT 'info', "status" "public"."in_app_notifications_status_enum" NOT NULL DEFAULT 'pending', "data" jsonb, "metadata" jsonb, "template_id" character varying, "category" character varying NOT NULL, "action_url" character varying, "actions" jsonb, "scheduled_at" TIMESTAMP, "sent_at" TIMESTAMP, "delivered_at" TIMESTAMP, "read_at" TIMESTAMP, "expires_at" TIMESTAMP, "transaction_id" uuid, "feed_id" character varying NOT NULL DEFAULT 'default', "channel" character varying NOT NULL DEFAULT 'in_app', "message_id" character varying(255), "delivery_id" uuid, "seen" boolean NOT NULL DEFAULT false, "seen_at" TIMESTAMP, "archived" boolean NOT NULL DEFAULT false, "archived_at" TIMESTAMP, "subscriber_id" character varying, "priority" character varying, "avatar" character varying, "user_id" character varying, "tenant_id" character varying NOT NULL, "created_by_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f871e2a23724692bbb5b3b75c98" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f75ef8aab48463b94fb0518ae6" ON "in_app_notifications"  ("message_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_afd42a07f9331a26c878ee6ec9" ON "in_app_notifications"  ("transaction_id", "tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_73734f635696287f4effd37b4b" ON "in_app_notifications"  ("subscriber_id", "seen") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fa42e34c09416625fc00d7f0b0" ON "in_app_notifications"  ("tenant_id", "feed_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7f20af3a88de2b60c9ed28c6b8" ON "in_app_notifications"  ("type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ce141ddbdf239d1e1310d5e816" ON "in_app_notifications"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d0c2addd512adf9b04bf894d1e" ON "in_app_notifications"  ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."system_alerts_alert_type_enum" AS ENUM('dead_letter', 'provider_failure', 'rate_limit_exceeded', 'quota_exceeded', 'system_error', 'security_breach', 'performance_degradation')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."system_alerts_severity_enum" AS ENUM('low', 'medium', 'high', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."system_alerts_status_enum" AS ENUM('active', 'acknowledged', 'resolved', 'ignored')`,
    );
    await queryRunner.query(
      `CREATE TABLE "system_alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "alert_type" "public"."system_alerts_alert_type_enum" NOT NULL, "severity" "public"."system_alerts_severity_enum" NOT NULL, "status" "public"."system_alerts_status_enum" NOT NULL DEFAULT 'active', "title" character varying(255) NOT NULL, "message" text NOT NULL, "metadata" json, "recipients" json, "resolution_notes" text, "acknowledged_by_member_id" uuid, "acknowledged_at" TIMESTAMP, "resolved_by_member_id" uuid, "resolved_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c4754bccb48e096e7da8eda23f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87837b104db49412154e3631c1" ON "system_alerts"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dad592d75e540837adee7df86e" ON "system_alerts"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d7cdc1e41584f58f6b525977eb" ON "system_alerts"  ("alert_type", "severity") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ec85b0532233c57aeb123185ef" ON "system_alerts"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tenant_waba_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying NOT NULL, "waba_id" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "usage_stats" json NOT NULL, "access_token" character varying, "phone_number_id" character varying, "status" character varying NOT NULL DEFAULT 'PENDING', "verification_status" character varying NOT NULL DEFAULT 'UNVERIFIED', "last_sync_at" TIMESTAMP, "assigned_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_158b1f83faad6b69eb9ffbfdf6d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2da9a068eb433c3e481c624fd" ON "tenant_waba_configs"  ("waba_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40c28f8c251d72b295af136f4c" ON "tenant_waba_configs"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ec5c56ccef7f1cc0ac849f59d0" ON "tenant_waba_configs"  ("tenant_id", "waba_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "waba_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" character varying, "business_account_id" character varying NOT NULL, "access_token" character varying NOT NULL, "phone_number_id" character varying NOT NULL, "webhook_verify_token" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "is_byop" boolean NOT NULL DEFAULT false, "region" character varying NOT NULL DEFAULT 'global', "template_count" integer NOT NULL DEFAULT '0', "max_templates" integer NOT NULL DEFAULT '6000', "last_used_at" TIMESTAMP, "metadata" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_af726ea7cb2e3a02f3194435e4d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying(32) NOT NULL, "event_id" character varying(255) NOT NULL, "payload_hash" character varying(64), "status" character varying(16) NOT NULL DEFAULT 'processed', "error_message" text, "attempt_count" integer NOT NULL DEFAULT '1', "last_attempt_at" TIMESTAMP NOT NULL DEFAULT now(), "processed_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4cba37e6a0acb5e1fc49c34ebfd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f7f654109e5cf7f541d8a9b694" ON "webhook_events"  ("provider", "event_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "project_send_quotas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" uuid NOT NULL, "tenant_id" uuid NOT NULL, "limit" integer NOT NULL, "window_seconds" integer NOT NULL DEFAULT '60', "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4cb29aae91e50d09c1ade5ba2fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d6c9d79f6608619aaae6d3b8f" ON "project_send_quotas"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_send_quotas_project" ON "project_send_quotas"  ("project_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workflows" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" character varying NOT NULL, "name" character varying NOT NULL, "description" text, "trigger" character varying(32) NOT NULL DEFAULT 'manual', "status" character varying(32) NOT NULL DEFAULT 'active', "steps" jsonb NOT NULL DEFAULT '[]', "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_5b5757cc1cd86268019fef52e0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cacf348850bfae0cd173527233" ON "workflows"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workflow_runs" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" character varying NOT NULL, "workflow_id" character varying NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'running', "current_step" integer NOT NULL DEFAULT '0', "context" jsonb NOT NULL DEFAULT '{}', "wait_event" character varying(255), "wait_until" TIMESTAMP, "error_message" text, "started_at" TIMESTAMP, "completed_at" TIMESTAMP, CONSTRAINT "PK_eea9f8d0a660b3f48114c313233" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c5836f5cc1c21c6570db4ba68b" ON "workflow_runs"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c31278d9f8a5c6d7d6f638984e" ON "workflow_runs"  ("tenant_id", "workflow_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "tenant_member_id" uuid, "action" character varying(50) NOT NULL, "resource_type" character varying(50) NOT NULL, "resource_id" uuid NOT NULL, "description" text NOT NULL, "ip_address" character varying(45), "user_agent" text, "session_id" uuid, "old_values" jsonb, "new_values" jsonb, "metadata" jsonb, "success" boolean NOT NULL DEFAULT true, "error_message" text, "duration" integer NOT NULL DEFAULT '0', "correlation_id" uuid, "request_id" uuid, "request_headers" jsonb, "response_data" jsonb, "api_version" character varying(20), "client_version" character varying(50), "tags" text, "severity" character varying(20) NOT NULL DEFAULT 'low', "compliance_flags" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3197969cb5ed9b2a00252a3c9e" ON "audit_logs"  ("severity") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d04b6f2b05825501c1427f0d9" ON "audit_logs"  ("resource_type", "resource_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_92fb920c7211072903e4a5aeae" ON "audit_logs"  ("tenant_member_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_898d14750b88319b89b1ab66cd" ON "audit_logs"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" character varying(36) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "tenant_id" character varying NOT NULL, "name" character varying NOT NULL, "description" text, "type" character varying(32) NOT NULL DEFAULT 'one_time', "status" character varying(32) NOT NULL DEFAULT 'draft', "channels" jsonb NOT NULL DEFAULT '[]', "audience" jsonb NOT NULL DEFAULT '{}', "schedule" jsonb NOT NULL DEFAULT '{}', "templates" jsonb NOT NULL DEFAULT '[]', "analytics" jsonb NOT NULL DEFAULT '{}', "created_by" character varying, CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8848968b61761dabc955081229" ON "campaigns"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "voice_calls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "call_control_id" character varying NOT NULL, "phone_number" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'initiated', "tts_message" text, "hangup_cause" character varying, "duration" integer, "started_at" TIMESTAMP NOT NULL, "ended_at" TIMESTAMP, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_72ab91ece82712a00fa92140908" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9ff7f19920300de4822cb45b4" ON "voice_calls"  ("tenant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a9733a01760199fc2c4b8d5066" ON "voice_calls"  ("call_control_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9454a1d9a25476a442477025f" ON "voice_calls"  ("tenant_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "message_id" uuid, "delivery_id" uuid, "channel" character varying(20) NOT NULL, "provider" character varying(50) NOT NULL, "type" character varying(32) NOT NULL, "bounce_type" character varying(10), "reason_code" character varying(120), "diagnostic" text, "url" text, "user_agent" text, "ip" character varying(64), "provider_event_id" character varying(255), "provider_message_id" character varying(255), "raw" jsonb NOT NULL DEFAULT '{}', "occurred_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19b3537a3e016d72733fa56f7a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93ea908b383e81cd36d17ebadd" ON "delivery_events"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_098f2c968db229169c9d7dc5cb" ON "delivery_events"  ("provider", "provider_message_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2a85bf3b9154deebc3f4ab0f60" ON "delivery_events"  ("tenant_id", "delivery_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c4d561e92140c017373b2b9e0" ON "delivery_events"  ("tenant_id", "message_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "key" character varying(255) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "message_id" uuid, "response" jsonb, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "idempotency_keys_tenant_key" UNIQUE ("tenant_id", "key"), CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "project_id" uuid, "name" character varying(120) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_be6f24595ff1aa2f45041fff9d9" UNIQUE ("tenant_id", "name"), CONSTRAINT "PK_e4aa99a3fa60ec3a37d1fc4e853" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb32dc9126c56c874d0ab2fa04" ON "topics"  ("tenant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "topic_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "topic_id" uuid NOT NULL, "subscriber_id" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d667ea66818c83513ab590f981a" UNIQUE ("topic_id", "subscriber_id"), CONSTRAINT "PK_e7134698b5cf1a14b3b34b98c39" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40725f5aa33e04840c850ec5f1" ON "topic_subscriptions"  ("topic_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3017841320f74767cb0c20b87c" ON "topic_subscriptions"  ("subscriber_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "subscriber_id" character varying(255) NOT NULL, "channel" character varying(20) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_suppressions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "address" character varying(500) NOT NULL, "channel" character varying(20), "reason" character varying(32) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1e2c6a45e05d890b3d194ccf68b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriber_quiet_hours" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "subscriber_id" character varying(255) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "timezone" character varying(64) NOT NULL DEFAULT 'UTC', "start_minute" smallint NOT NULL DEFAULT '1320', "end_minute" smallint NOT NULL DEFAULT '420', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_55389483bbe73d0d0fa9fc6eec0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93074272f02e58d62d20ba73e7" ON "subscriber_quiet_hours"  ("subscriber_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "template_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "template_id" character varying NOT NULL, "version" integer NOT NULL, "name" character varying(255) NOT NULL, "description" text, "subject" text, "data" text NOT NULL, "html_content" text, "variables" jsonb NOT NULL DEFAULT '{}', "channels" jsonb NOT NULL DEFAULT '[]', "metadata" jsonb, "is_active" boolean NOT NULL DEFAULT false, "created_by" character varying(255), "change_log" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cfc439255ca2725f4102c554d41" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d747f429f90a051a017094521b" ON "template_versions"  ("template_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e7427f6ae24e8bc62994e5418f" ON "template_versions"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6e4a2d992ae36c614cccf51c78" ON "template_versions"  ("template_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e7d4ea0bee357b340b1bf971d3" ON "template_versions"  ("template_id", "version") `,
    );
    await queryRunner.query(
      `ALTER TABLE "configurations" ADD CONSTRAINT "FK_f6a6a3e40d042c349bf1ad35bc5" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invites" ADD CONSTRAINT "FK_a3ad8c552d7c4c5320758376c1b" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invites" ADD CONSTRAINT "FK_997b4c1cbb58bd9467ab0f8e0e3" FOREIGN KEY ("invited_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_deliveries" ADD CONSTRAINT "FK_764d21f361d0f6b155ad2273dee" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_c7a03050ea97f7843acff1964a0" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_configs" ADD CONSTRAINT "FK_d81bc2b2694878015019c248c5e" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_configs" ADD CONSTRAINT "FK_8c58e979b54395cac2bfb1c674f" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_efef1e5fdbe318a379c06678c51" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_30e98e8746699fb9af235410aff" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_certificates" ADD CONSTRAINT "FK_7d13956b229314b24e6cc0a904f" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_certificates" ADD CONSTRAINT "FK_bd459eb659143919de6fc98eb4f" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_certificates" ADD CONSTRAINT "FK_4b128563fbb2846a53d84df83f3" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_members" ADD CONSTRAINT "FK_ffba0c9ecd4fd98550b3300ae68" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_members" ADD CONSTRAINT "FK_396d571d91da471867fcfbdd2e4" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_6bcdb4b8f471f0a9203754abe98" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_33bb5b1b1a3a7e8b9787cd87784" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhooks" ADD CONSTRAINT "FK_4d6fcde4ac5ca1d5823f51aa186" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_settings" ADD CONSTRAINT "FK_a6abc1c3ed0df635955fc852f1c" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "FK_efba90c155ec02ae586fb7ed31d" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" ADD CONSTRAINT "FK_ddd7ea53812fb25d98cc3357926" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" ADD CONSTRAINT "FK_54e5c9fc0c740b2bd65f0160b5a" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" ADD CONSTRAINT "FK_7fe85a796a57a6cccfaa2dff03c" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_7393a03ef67e2ea91b81faa95dd" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_ab672de45bbe816d2d45203c460" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_c24760a4c22a838d6a8eb1fdc3a" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "FK_f5de07dbb229225e2be643ff3d0" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD CONSTRAINT "FK_3afd227c6cb003779abe2a88b4e" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_purchases" ADD CONSTRAINT "FK_a570ccea77809c68c58aafe543e" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_purchases" ADD CONSTRAINT "FK_2a9a120f9398a72c2dc0a6d777e" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_f6ac03431c311ccb8bbd7d3af18" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_balances" ADD CONSTRAINT "FK_3515a4cea8328b8cc41cc913969" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_transactions" ADD CONSTRAINT "FK_8025722e44a832a0c50743a6702" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_payment_methods" ADD CONSTRAINT "FK_d3aac26475d1180b35bca4367bd" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_topup_configs" ADD CONSTRAINT "FK_f8b36627c1bfede89304f4b5457" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_topup_configs" ADD CONSTRAINT "FK_dc4aa60e83249a1e6b8ed5eeab7" FOREIGN KEY ("payment_method_id") REFERENCES "tenant_payment_methods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_usage_logs" ADD CONSTRAINT "FK_090b7adbc90c62971508c9bb1fa" FOREIGN KEY ("provider_config_id") REFERENCES "provider_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuration_versions" ADD CONSTRAINT "FK_ab3643da4884720a52fea602ac0" FOREIGN KEY ("configurationId") REFERENCES "configurations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "member" ADD CONSTRAINT "FK_bfadaaab56ae7b5f2d76885d03b" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "member" ADD CONSTRAINT "FK_efc766611e939bdbe6f7088984d" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD CONSTRAINT "FK_de7c148c7834d738ac7113f3dd8" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" ADD CONSTRAINT "FK_6a74e98954df622bd19d879f6db" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" ADD CONSTRAINT "FK_095076c892fd4f640ea401d83ab" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" ADD CONSTRAINT "FK_22a131a0e33a353be5464919125" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" ADD CONSTRAINT "FK_7efd9be1e8fe2445b45bbbfba88" FOREIGN KEY ("created_by_id") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_waba_configs" ADD CONSTRAINT "FK_d2da9a068eb433c3e481c624fdf" FOREIGN KEY ("waba_id") REFERENCES "waba_configs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD CONSTRAINT "FK_d4b32d1e898a336c770e08bf5e8" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD CONSTRAINT "FK_49da41a196c3d2bd6f5ce1dc3b5" FOREIGN KEY ("created_by") REFERENCES "tenant_members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP CONSTRAINT "FK_49da41a196c3d2bd6f5ce1dc3b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP CONSTRAINT "FK_d4b32d1e898a336c770e08bf5e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_waba_configs" DROP CONSTRAINT "FK_d2da9a068eb433c3e481c624fdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "FK_7efd9be1e8fe2445b45bbbfba88"`,
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "FK_22a131a0e33a353be5464919125"`,
    );
    await queryRunner.query(
      `ALTER TABLE "in_app_notifications" DROP CONSTRAINT "FK_095076c892fd4f640ea401d83ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" DROP CONSTRAINT "FK_6a74e98954df622bd19d879f6db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitation" DROP CONSTRAINT "FK_de7c148c7834d738ac7113f3dd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member" DROP CONSTRAINT "FK_efc766611e939bdbe6f7088984d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member" DROP CONSTRAINT "FK_bfadaaab56ae7b5f2d76885d03b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configuration_versions" DROP CONSTRAINT "FK_ab3643da4884720a52fea602ac0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_usage_logs" DROP CONSTRAINT "FK_090b7adbc90c62971508c9bb1fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_topup_configs" DROP CONSTRAINT "FK_dc4aa60e83249a1e6b8ed5eeab7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_topup_configs" DROP CONSTRAINT "FK_f8b36627c1bfede89304f4b5457"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_payment_methods" DROP CONSTRAINT "FK_d3aac26475d1180b35bca4367bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_transactions" DROP CONSTRAINT "FK_8025722e44a832a0c50743a6702"`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_balances" DROP CONSTRAINT "FK_3515a4cea8328b8cc41cc913969"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_f6ac03431c311ccb8bbd7d3af18"`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_purchases" DROP CONSTRAINT "FK_2a9a120f9398a72c2dc0a6d777e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_purchases" DROP CONSTRAINT "FK_a570ccea77809c68c58aafe543e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT "FK_3afd227c6cb003779abe2a88b4e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP CONSTRAINT "FK_f5de07dbb229225e2be643ff3d0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_c24760a4c22a838d6a8eb1fdc3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_ab672de45bbe816d2d45203c460"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_7393a03ef67e2ea91b81faa95dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" DROP CONSTRAINT "FK_7fe85a796a57a6cccfaa2dff03c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" DROP CONSTRAINT "FK_54e5c9fc0c740b2bd65f0160b5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" DROP CONSTRAINT "FK_ddd7ea53812fb25d98cc3357926"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP CONSTRAINT "FK_efba90c155ec02ae586fb7ed31d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_settings" DROP CONSTRAINT "FK_a6abc1c3ed0df635955fc852f1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhooks" DROP CONSTRAINT "FK_4d6fcde4ac5ca1d5823f51aa186"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" DROP CONSTRAINT "FK_33bb5b1b1a3a7e8b9787cd87784"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" DROP CONSTRAINT "FK_6bcdb4b8f471f0a9203754abe98"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_members" DROP CONSTRAINT "FK_396d571d91da471867fcfbdd2e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_members" DROP CONSTRAINT "FK_ffba0c9ecd4fd98550b3300ae68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_certificates" DROP CONSTRAINT "FK_4b128563fbb2846a53d84df83f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_certificates" DROP CONSTRAINT "FK_bd459eb659143919de6fc98eb4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_certificates" DROP CONSTRAINT "FK_7d13956b229314b24e6cc0a904f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_30e98e8746699fb9af235410aff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_efef1e5fdbe318a379c06678c51"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_configs" DROP CONSTRAINT "FK_8c58e979b54395cac2bfb1c674f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_configs" DROP CONSTRAINT "FK_d81bc2b2694878015019c248c5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_c7a03050ea97f7843acff1964a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_deliveries" DROP CONSTRAINT "FK_764d21f361d0f6b155ad2273dee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invites" DROP CONSTRAINT "FK_997b4c1cbb58bd9467ab0f8e0e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invites" DROP CONSTRAINT "FK_a3ad8c552d7c4c5320758376c1b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "configurations" DROP CONSTRAINT "FK_f6a6a3e40d042c349bf1ad35bc5"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_e7d4ea0bee357b340b1bf971d3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6e4a2d992ae36c614cccf51c78"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e7427f6ae24e8bc62994e5418f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d747f429f90a051a017094521b"`);
    await queryRunner.query(`DROP TABLE "template_versions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_93074272f02e58d62d20ba73e7"`);
    await queryRunner.query(`DROP TABLE "subscriber_quiet_hours"`);
    await queryRunner.query(`DROP TABLE "notification_suppressions"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_40725f5aa33e04840c850ec5f1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3017841320f74767cb0c20b87c"`);
    await queryRunner.query(`DROP TABLE "topic_subscriptions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bb32dc9126c56c874d0ab2fa04"`);
    await queryRunner.query(`DROP TABLE "topics"`);
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8c4d561e92140c017373b2b9e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2a85bf3b9154deebc3f4ab0f60"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_098f2c968db229169c9d7dc5cb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_93ea908b383e81cd36d17ebadd"`);
    await queryRunner.query(`DROP TABLE "delivery_events"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d9454a1d9a25476a442477025f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a9733a01760199fc2c4b8d5066"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b9ff7f19920300de4822cb45b4"`);
    await queryRunner.query(`DROP TABLE "voice_calls"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8848968b61761dabc955081229"`);
    await queryRunner.query(`DROP TABLE "campaigns"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_898d14750b88319b89b1ab66cd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_92fb920c7211072903e4a5aeae"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3d04b6f2b05825501c1427f0d9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3197969cb5ed9b2a00252a3c9e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c31278d9f8a5c6d7d6f638984e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c5836f5cc1c21c6570db4ba68b"`);
    await queryRunner.query(`DROP TABLE "workflow_runs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cacf348850bfae0cd173527233"`);
    await queryRunner.query(`DROP TABLE "workflows"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_project_send_quotas_project"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3d6c9d79f6608619aaae6d3b8f"`);
    await queryRunner.query(`DROP TABLE "project_send_quotas"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f7f654109e5cf7f541d8a9b694"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP TABLE "waba_configs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ec5c56ccef7f1cc0ac849f59d0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_40c28f8c251d72b295af136f4c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d2da9a068eb433c3e481c624fd"`);
    await queryRunner.query(`DROP TABLE "tenant_waba_configs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ec85b0532233c57aeb123185ef"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d7cdc1e41584f58f6b525977eb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dad592d75e540837adee7df86e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_87837b104db49412154e3631c1"`);
    await queryRunner.query(`DROP TABLE "system_alerts"`);
    await queryRunner.query(`DROP TYPE "public"."system_alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."system_alerts_severity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."system_alerts_alert_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d0c2addd512adf9b04bf894d1e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ce141ddbdf239d1e1310d5e816"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7f20af3a88de2b60c9ed28c6b8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fa42e34c09416625fc00d7f0b0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_73734f635696287f4effd37b4b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_afd42a07f9331a26c878ee6ec9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f75ef8aab48463b94fb0518ae6"`);
    await queryRunner.query(`DROP TABLE "in_app_notifications"`);
    await queryRunner.query(`DROP TYPE "public"."in_app_notifications_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."in_app_notifications_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_874114dd4a32c08ab0113e0328"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_17ed3f7e7d06f1d90bdc0ddedf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_33dc258f52abeba4bab8f4f5f4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0d769be8a8d0c7a1a5d4c1d77a"`);
    await queryRunner.query(`DROP TABLE "dead_letters"`);
    await queryRunner.query(`DROP TYPE "public"."dead_letters_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."dead_letters_original_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_514633b3554a4b1f77ce6dbbf3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_86d97df78920c5d9f621c0d604"`);
    await queryRunner.query(`DROP TABLE "apikey"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0d83b1de272a6d77656eeb5bcb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_de7c148c7834d738ac7113f3dd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bcb0a0d2333443083582a05cdd"`);
    await queryRunner.query(`DROP TABLE "invitation"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e2ca32cb72cafdf81b71062459"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bfadaaab56ae7b5f2d76885d03"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_efc766611e939bdbe6f7088984"`);
    await queryRunner.query(`DROP TABLE "member"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a08804baa7c5d5427067c49a31"`);
    await queryRunner.query(`DROP TABLE "organization"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fcf8c31632dc768a91c9b5652a"`);
    await queryRunner.query(`DROP TABLE "verification"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1eaabb0c9669230c5de4424266"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2aca29024c17f7e7284d1a4d93"`);
    await queryRunner.query(`DROP TABLE "configuration_versions"`);
    await queryRunner.query(`DROP TYPE "public"."configuration_versions_action_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f4acde77e041da1c66cf5cc365"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9c873234e7d7239ccaae62779a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ac629a2858187ee1dbc4e52e27"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d86aa84090327c9a94aee62e18"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7567faf52e0f0da34dbab2daf3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_87c998073af994bb49340be58c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d1891b273f5c77638d2149a9f0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_63fea9549fcb8977a3c0abd783"`);
    await queryRunner.query(`DROP TABLE "security_events"`);
    await queryRunner.query(`DROP TYPE "public"."security_events_severity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."security_events_event_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9b632fd15962822ed35bff6bee"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7ba72abda30b7d38fdae7efa03"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_52ddae43de920b6ac483f87992"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3f61e6e81e06c7e18fc512aadb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ad38dbe1c700d005ffa7d15331"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7ca89f4f7c69fe3de57e43bf99"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0f13ab4f159eba767a73aa13bc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4837abb6021218988f32c2b69c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8c2f22538f5dcd9bbcb9c22a1b"`);
    await queryRunner.query(`DROP TABLE "device_registrations"`);
    await queryRunner.query(`DROP TYPE "public"."device_registrations_provider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."device_registrations_platform_enum"`);
    await queryRunner.query(`DROP TABLE "provider_usage_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_40a8ae2886ad13e65de5db4ac2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d622c78dec24303756a0996c3d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cf3808c90b68b06f22820d6168"`);
    await queryRunner.query(`DROP TABLE "notification_logs"`);
    await queryRunner.query(`DROP TABLE "auto_topup_configs"`);
    await queryRunner.query(`DROP TYPE "public"."auto_topup_configs_schedule_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."auto_topup_configs_trigger_enum"`);
    await queryRunner.query(`DROP TABLE "tenant_payment_methods"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_49c35a3d955dafb3cfd6ffdf5b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_token_purchase_reference_unique"`);
    await queryRunner.query(`DROP TABLE "token_transactions"`);
    await queryRunner.query(`DROP TYPE "public"."token_transactions_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3515a4cea8328b8cc41cc91396"`);
    await queryRunner.query(`DROP TABLE "token_balances"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_payment_provider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_plan_enum"`);
    await queryRunner.query(`DROP TABLE "token_purchases"`);
    await queryRunner.query(`DROP TYPE "public"."token_purchases_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."token_purchases_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_57384430aa1959f4578046c9b8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b99bbb8e545065a99b409dbc5d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e836681c884f5c577f7dd79cf9"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TYPE "public"."api_keys_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."api_keys_environment_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7393a03ef67e2ea91b81faa95d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a27865a7be17886e3088f4a650"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3748e4d84654129e867486bb67"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0b61f2e3babe7038c5e3e1351b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4d669ade634dfa6f9b98521edf"`);
    await queryRunner.query(`DROP TABLE "templates"`);
    await queryRunner.query(`DROP TYPE "public"."templates_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c59559e7872bc9726adef4669f"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
    await queryRunner.query(`DROP TYPE "public"."tenants_status_enum"`);
    await queryRunner.query(`DROP TABLE "tenant_settings"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4d6fcde4ac5ca1d5823f51aa18"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ffa6f0eb99be341d486fc8c9ff"`);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "brands"`);
    await queryRunner.query(`DROP TYPE "public"."brands_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0b89826fd3107a38e93be7f7e0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_45aa4b00b2400b1852516f2bdc"`);
    await queryRunner.query(`DROP TABLE "tenant_members"`);
    await queryRunner.query(`DROP TYPE "public"."tenant_members_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."tenant_members_role_enum"`);
    await queryRunner.query(`DROP TABLE "push_certificates"`);
    await queryRunner.query(`DROP TYPE "public"."push_certificates_environment_enum"`);
    await queryRunner.query(`DROP TYPE "public"."push_certificates_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."push_certificates_type_enum"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_30e98e8746699fb9af235410af"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ff9670b9425f3cd85959daae6d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_232f8e85d7633bd6ddfad42169"`);
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_efef1e5fdbe318a379c06678c5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_918ed923e61b4a2df82acccc00"`);
    await queryRunner.query(`DROP TABLE "account"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e1d52669971dfb5e97111ae17d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_69b625e46054a8716a36f87fe4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d81bc2b2694878015019c248c5"`);
    await queryRunner.query(`DROP TABLE "provider_configs"`);
    await queryRunner.query(`DROP TYPE "public"."provider_configs_provider_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b5f94ffd3a2c5eb77062c0e465"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e80e763a87656d475402cbf621"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_014fd1d6dfb6c8fcf44e92fbc4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_558150f45586066db2415eb28c"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."messages_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fdecedcba754e65f7888bfd331"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b746d4f69fbef5d7f552b3b0b3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c83c1a9962f356257ac91c61a1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_adf99ea07dc5b73e92b87c2942"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bc0b44588ac7b4bd5c95a40abb"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_764d21f361d0f6b155ad2273de"`);
    await queryRunner.query(`DROP TABLE "message_deliveries"`);
    await queryRunner.query(`DROP TYPE "public"."message_deliveries_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2c6981e09ba258d84b7f510395"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_18a9a6c85f7cc6f42ebef3b318"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_966019af04a8fff533d87203c2"`);
    await queryRunner.query(`DROP TABLE "invites"`);
    await queryRunner.query(`DROP TYPE "public"."invites_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."invites_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c02c349cfef4799e17ef746eb1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8ba365604f3d49aaaf4db4598b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_862351304f050ede746dd216b1"`);
    await queryRunner.query(`DROP TABLE "configurations"`);
  }
}
