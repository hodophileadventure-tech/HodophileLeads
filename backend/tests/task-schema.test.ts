import fs from 'fs';
import * as database from '../src/utils/database';

describe('task system schema repair', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('recreates missing task tables from the migration file', async () => {
    const queryMock = jest.spyOn(database, 'query');
    const readFileMock = jest.spyOn(fs, 'readFileSync').mockReturnValue(`
      CREATE TABLE IF NOT EXISTS tasks (id UUID PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS task_activity_logs (id UUID PRIMARY KEY);
    `);

    queryMock
      .mockResolvedValueOnce({ rows: [{ count: 0 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await database.ensureTaskSystemTables();

    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('information_schema.tables'))).toBe(true);
    expect(readFileMock).toHaveBeenCalledWith(expect.stringContaining('2026-08-12-003-create-tasks-system.sql'), 'utf8');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('CREATE TABLE IF NOT EXISTS tasks'))).toBe(true);
  });

  test('enables pgcrypto before repairing missing RBAC tables', async () => {
    const queryMock = jest.spyOn(database, 'query');
    const readFileMock = jest.spyOn(fs, 'readFileSync').mockReturnValue(`
      CREATE TABLE IF NOT EXISTS roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE IF NOT EXISTS permissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
    `);

    queryMock
      .mockResolvedValueOnce({ rows: [{ table_name: 'users' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ table_name: 'users' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await database.ensureRoleAndPermissionTables();

    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('CREATE EXTENSION IF NOT EXISTS pgcrypto'))).toBe(true);
    expect(readFileMock).toHaveBeenCalledWith(expect.stringContaining('2026-08-12-001-create-roles-system.sql'), 'utf8');
  });
});
