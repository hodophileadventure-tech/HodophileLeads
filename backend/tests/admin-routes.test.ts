import express from 'express';
import { adminRouter } from '../src/routes/admin';
import { adminController } from '../src/controllers/admin-controller';
import { verifyToken } from '../src/utils/auth';
import { query } from '../src/utils/database';

jest.mock('../src/utils/auth', () => ({
  verifyToken: jest.fn()
}));

jest.mock('../src/utils/database', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../src/utils/activity-log', () => ({
  logActivity: jest.fn().mockResolvedValue({})
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

  it('reverts a lead to the previous owner from the most recent matching transfer event', async () => {
    const lead = {
      id: 'lead-1',
      agent_id: 'agent-b',
      client_name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '5551234'
    };

    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [lead] })
      .mockResolvedValueOnce({
        rows: [
          { changes: { fromAgentId: 'agent-c', toAgentId: 'agent-d' } },
          { changes: { fromAgentId: 'agent-a', toAgentId: 'agent-b' } }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ id: 'agent-a' }] })
      .mockResolvedValueOnce({ rows: [{ ...lead, agent_id: 'agent-a' }] });

    const req: any = {
      params: { id: 'lead-1' },
      user: { id: 'manager-1', role: 'manager' }
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await adminController.revertLeadTransfer(req, res, next);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(query).toHaveBeenNthCalledWith(4, expect.stringContaining('UPDATE leads SET agent_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *'), ['agent-a', 'lead-1']);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      lead: expect.objectContaining({ agent_id: 'agent-a' })
    }));
  });
});
