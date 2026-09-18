import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from '../src/utils/auth';
import { markLoginAttendance } from '../src/controllers/auth-controller';
import { query } from '../src/utils/database';

jest.mock('../src/utils/database', () => ({
  query: jest.fn()
}));

describe('auth utils', () => {
  test('generates and verifies a token payload', () => {
    const token = generateToken({ id: 'user-1', email: 'agent@test.com', role: 'agent' });
    const decoded = verifyToken(token) as jwt.JwtPayload;

    expect(decoded.id).toBe('user-1');
    expect(decoded.email).toBe('agent@test.com');
    expect(decoded.role).toBe('agent');
  });

  test('uses an 8 hour default expiry for all roles', () => {
    const token = generateToken({ id: 'user-2', email: 'video-editor@test.com', role: 'video_editor' });
    const decoded = verifyToken(token) as jwt.JwtPayload;

    expect(decoded.exp).toBeTruthy();
    expect(decoded.exp! - decoded.iat!).toBe(8 * 60 * 60);
  });

  test('rejects invalid token', () => {
    expect(verifyToken('invalid.token.value')).toBeNull();
  });

  test('does not mark attendance again for the same user/date on re-login', async () => {
    const mockedQuery = query as jest.MockedFunction<typeof query>;
    mockedQuery.mockResolvedValue({ rows: [] } as any);

    await markLoginAttendance('user-1', 'agent');

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const sql = mockedQuery.mock.calls[0][0] as string;

    expect(sql).toContain('NOT EXISTS (');
    expect(sql).toContain('FROM attendance a');
    expect(sql).toContain('a.user_id = u.id');
    expect(sql).toContain('a.attendance_date = local_clock.attendance_date');
  });
});
