import express from 'express';
import { adminRouter } from '../src/routes/admin';
import { verifyToken } from '../src/utils/auth';
import { query } from '../src/utils/database';

jest.mock('../src/utils/auth', () => ({
  verifyToken: jest.fn()
}));

jest.mock('../src/utils/database', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

describe('admin agents route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows managers to access the agents list endpoint', async () => {
    (verifyToken as jest.Mock).mockReturnValue({
      id: 'manager-id',
      email: 'manager@example.com',
      role: 'manager'
    });
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'agent-1', email: 'agent@example.com', name: 'Agent One', role: 'agent' }] });

    const app = express();
    app.use('/api/admin', adminRouter);

    const server = app.listen(0);

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Server address not available');
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/agents`, {
        headers: { Authorization: 'Bearer test-token' }
      });

      expect(response.status).toBe(200);
      const body = await response.json() as { agents: Array<{ id: string }> };
      expect(body.agents).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
