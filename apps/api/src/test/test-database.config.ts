import { DataSource } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { assertSafeTestDatabase, createSqliteTestDataSource } from './sqlite-test-data-source';

@Entity('test_config_rows')
class TestConfigRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}

export const testDataSource = createSqliteTestDataSource([TestConfigRow]);

export async function setupTestDatabase(): Promise<DataSource> {
  assertSafeTestDatabase();
  if (!testDataSource.isInitialized) {
    await testDataSource.initialize();
  }
  return testDataSource;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testDataSource.isInitialized) {
    await testDataSource.destroy();
  }
}
