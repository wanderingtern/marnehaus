import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireTenant } from '../middleware/auth';
import { sendMagicLinkEmail } from '../lib/email';

const router = Router();

// POST /portal/request-link — send magic link to tenant email
router.post('/request-link', async (req: Request, res: Response) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);

  const tenant = await prisma.tenant.findUnique({ where: { email } });
  if (!tenant) {
    // Don't reveal whether email exists
    res.json({ ok: true });
    return;
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const tokenRecord = await prisma.tenantToken.create({
    data: { tenantId: tenant.id, expiresAt },
  });

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
  const magicLinkUrl = `${appUrl}/portal/auth?token=${tokenRecord.token}`;

  try {
    await sendMagicLinkEmail({
      to: tenant.email,
      tenantName: `${tenant.firstName} ${tenant.lastName}`,
      magicLinkUrl,
    });
  } catch (err) {
    console.error('Failed to send magic link email:', err);
  }

  res.json({ ok: true });
});

// POST /portal/verify-token — exchange one-time token for session token
router.post('/verify-token', async (req: Request, res: Response) => {
  const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

  const tokenRecord = await prisma.tenantToken.findUnique({
    where: { token },
    include: { tenant: true },
  });

  if (!tokenRecord) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  if (tokenRecord.expiresAt < new Date()) {
    res.status(401).json({ error: 'Token expired' });
    return;
  }
  if (tokenRecord.usedAt) {
    res.status(401).json({ error: 'Token already used' });
    return;
  }

  // Mark one-time token as used
  await prisma.tenantToken.update({
    where: { id: tokenRecord.id },
    data: { usedAt: new Date() },
  });

  // Issue a session token (24h)
  const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sessionToken = await prisma.tenantToken.create({
    data: { tenantId: tokenRecord.tenantId, expiresAt: sessionExpiry },
  });

  res.json({ sessionToken: sessionToken.token, tenant: { id: tokenRecord.tenant.id, firstName: tokenRecord.tenant.firstName, lastName: tokenRecord.tenant.lastName, email: tokenRecord.tenant.email } });
});

// All routes below require a valid session token
router.use(requireTenant());

// GET /portal/me
router.get('/me', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const full = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    include: {
      unit: { include: { property: { select: { name: true, address: true, city: true, state: true } } } },
    },
  });
  res.json(full);
});

// GET /portal/invoices
router.get('/invoices', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: tenant.id },
    orderBy: { dueDate: 'desc' },
  });
  res.json(invoices);
});

// GET /portal/lease
router.get('/lease', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const lease = await prisma.lease.findFirst({
    where: { tenantId: tenant.id, status: 'ACTIVE' },
    include: {
      unit: { include: { property: { select: { name: true, address: true } } } },
    },
    orderBy: { startDate: 'desc' },
  });
  res.json(lease ?? null);
});

// GET /portal/maintenance
router.get('/maintenance', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const requests = await prisma.maintenanceRequest.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

// POST /portal/maintenance
router.post('/maintenance', async (req: Request, res: Response) => {
  const tenant = (req as any).tenant;
  const schema = z.object({
    category: z.string().min(1),
    description: z.string().min(10),
  });
  const data = schema.parse(req.body);

  if (!tenant.unitId) {
    res.status(400).json({ error: 'Tenant is not assigned to a unit' });
    return;
  }

  const request = await prisma.maintenanceRequest.create({
    data: {
      tenantId: tenant.id,
      unitId: tenant.unitId,
      category: data.category,
      description: data.description,
    },
    include: {
      unit: { include: { property: { select: { name: true, address: true } } } },
    },
  });

  // Notify landlord
  const landlord = await prisma.user.findFirst({
    where: { properties: { some: { units: { some: { id: tenant.unitId } } } } },
  });
  if (landlord) {
    const unitInfo = `${request.unit.property.address} — Unit ${request.unit.unitNumber ?? ''}`;
    try {
      const { sendMaintenanceRequestEmail } = await import('../lib/email');
      await sendMaintenanceRequestEmail({
        to: landlord.email,
        landlordName: landlord.name ?? 'Landlord',
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        unitAddress: unitInfo,
        category: data.category,
        description: data.description,
        requestId: request.id,
        appUrl: process.env.APP_URL ?? 'http://localhost:5173',
      });
    } catch (err) {
      console.error('Failed to send maintenance notification:', err);
    }
  }

  res.status(201).json(request);
});

export default router;
