import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { leadsRouter } from './routes/leads';
import { dashboardRouter } from './routes/dashboard';
import { followUpsRouter } from './routes/followups';
import { availabilityRouter } from './routes/availability';
import { adminRouter } from './routes/admin';
import { itinerariesRouter } from './routes/itineraries';
import { notificationsRouter } from './routes/notifications';
import { paymentsRouter } from './routes/payments';
import { errorHandler } from './middleware/auth';
import { initDatabase } from './utils/database';
import { startFollowUpWorker } from './workers/followUpWorker';
import { createServer } from 'http';
import { initWebsocket } from './utils/wsServer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Respect reverse proxy headers so office IP checks can see the real client address.
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(__dirname, '..', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (e) {
  // ignore
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/follow-ups', followUpsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/admin', adminRouter);
app.use('/api/itineraries', itinerariesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/payments', paymentsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'TRIPNEXUS API',
    version: '1.0.0',
    description: 'Travel Agency Lead Management System API',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register'
      },
      leads: {
        list: 'GET /api/leads',
        create: 'POST /api/leads',
        getById: 'GET /api/leads/:id',
        update: 'PUT /api/leads/:id',
        updateStatus: 'PATCH /api/leads/:id/status',
        delete: 'DELETE /api/leads/:id'
      },
      followUps: {
        list: 'GET /api/follow-ups',
        create: 'POST /api/follow-ups',
        update: 'PUT /api/follow-ups/:id',
        delete: 'DELETE /api/follow-ups/:id',
        complete: 'PATCH /api/follow-ups/:id/complete'
      },
      payments: {
        list: 'GET /api/payments?leadId=UUID',
        create: 'POST /api/payments',
        update: 'PUT /api/payments/:id',
        confirm: 'PATCH /api/payments/:id/confirm',
        delete: 'DELETE /api/payments/:id'
      },
      availability: {
        get: 'GET /api/availability/:leadId',
        update: 'PUT /api/availability/:leadId',
        gates: 'GET /api/availability/:leadId/gates'
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats',
        pipeline: 'GET /api/dashboard/pipeline',
        analytics: 'GET /api/dashboard/analytics',
        health: 'GET /api/dashboard/health'
      },
      admin: {
        redFlags: 'GET /api/admin/red-flags'
      }
    }
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

// Start server after DB init and worker start
const start = async () => {
  await initDatabase();
  // start background worker
  startFollowUpWorker();

  const server = createServer(app);
  // init websocket server
  initWebsocket(server);

  server.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ API docs available at http://localhost:${PORT}/api/docs`);
  });
};

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
