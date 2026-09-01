import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from '../src/utils/auth';

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
});
