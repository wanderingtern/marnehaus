import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { clerkAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import propertiesRouter from './routes/properties';
import unitsRouter from './routes/units';
import tenantsRouter from './routes/tenants';
import leasesRouter from './routes/leases';
import webhooksRouter from './routes/webhooks';
import stripeRouter from './routes/stripe';
import invoicesRouter from './routes/invoices';

export function createApp() {
  const app = express();

  app.use(helmet());
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

  app.use(errorHandler);

  return app;
}
