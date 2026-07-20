import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  assertSafeTestDatabase,
  createSqliteTestDataSource,
} from '../../src/test/sqlite-test-data-source';
import type { DataSource } from 'typeorm';

@Entity('smoke_users')
class SmokeUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  email!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}

describe('SQLite test database', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    assertSafeTestDatabase();
    dataSource = createSqliteTestDataSource([SmokeUser]);
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.getRepository(SmokeUser).clear();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates and reads a row in memory', async () => {
    const repo = dataSource.getRepository(SmokeUser);
    const saved = await repo.save(repo.create({ email: 'owner@example.com' }));
    expect(saved.id).toBeDefined();
    const found = await repo.findOne({ where: { id: saved.id } });
    expect(found?.email).toBe('owner@example.com');
  });

  it('uses sqlite not postgres', () => {
    expect(dataSource.options.type).toBe('sqljs');
    expect(process.env.DATABASE_URL).toBe('sqlite::memory:');
  });

  it('refuses non-sqlite overrides', () => {
    expect(() =>
      createSqliteTestDataSource([SmokeUser], { type: 'postgres' } as never),
    ).toThrow(/SQLite/);
  });
});
