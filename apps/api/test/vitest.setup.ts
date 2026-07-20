import 'reflect-metadata';
import { beforeAll } from 'vitest';
import { assertSafeTestDatabase } from '../src/test/sqlite-test-data-source';

beforeAll(() => {
  assertSafeTestDatabase();
});
