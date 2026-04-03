import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

import { clerkAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import propertiesRouter from './routes/properties';
import unitsRouter from './routes/units';
import tenantsRouter from './routes/tenants';
import leasesRouter from './routes/leases';
import webhooksRouter from './routes/webhooks';
import stripeRouter from './routes/stripe';
import invoicesRouter from './routes/invoices';
import maintenanceRouter from './routes/maintenance';
import portalRouter from './routes/portal';

export function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Webhooks use raw body — register before json middleware
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

  app.use(express.json());
  app.use(clerkAuth);

  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // API routes
  app.use('/api/properties', propertiesRouter);
  app.use('/api/units', unitsRouter);
  app.use('/api/tenants', tenantsRouter);
  app.use('/api/leases', leasesRouter);
  app.use('/api/stripe', stripeRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/maintenance', maintenanceRouter);
  app.use('/api/portal', portalRouter);

  // Local file serving (dev only — in prod, storage uses S3/R2)
  if (process.env.NODE_ENV !== 'production') {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    app.use('/api/files', express.static(uploadsDir));
  }

  // Serve React frontend in production
  if (process.env.NODE_ENV === 'production') {
    const webDistPath = path.resolve(__dirname, '../../web/dist');
    if (fs.existsSync(webDistPath)) {
      app.use(express.static(webDistPath));
      // SPA fallback — all non-API routes serve index.html
      app.get('*', (_req, res) => {
        res.sendFile(path.join(webDistPath, 'index.html'));
      });
    }
  }

  app.use(errorHandler);

  return app;
}
