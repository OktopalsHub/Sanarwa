import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCampaigns1784545200000 implements MigrationInterface {
  name = 'CreateCampaigns1784545200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'campaigns',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'tenant_id', type: 'varchar', length: '36' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'type', type: 'varchar', length: '32', default: "'one_time'" },
          { name: 'status', type: 'varchar', length: '32', default: "'draft'" },
          { name: 'channels', type: 'jsonb', default: "'[]'" },
          { name: 'audience', type: 'jsonb', default: "'{}'" },
          { name: 'schedule', type: 'jsonb', default: "'{}'" },
          { name: 'templates', type: 'jsonb', default: "'[]'" },
          { name: 'analytics', type: 'jsonb', default: "'{}'" },
          { name: 'created_by', type: 'varchar', length: '36', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'now()' },
          { name: 'updated_at', type: 'timestamp', default: 'now()' },
        ],
        foreignKeys: [
          {
            columnNames: ['tenant_id'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'campaigns',
      new TableIndex({
        name: 'IDX_campaigns_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('campaigns');
  }
}
