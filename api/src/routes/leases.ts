import express, { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { LeaseStatus } from '@prisma/client';
import { uploadFile, getFileUrl } from '../lib/storage';

const router = Router();

const createLeaseSchema = z.object({
  unitId: z.string().min(1),
  tenantId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  monthlyRent: z.number().positive(),
  status: z.nativeEnum(LeaseStatus).default(LeaseStatus.ACTIVE),
});

const updateLeaseSchema = createLeaseSchema.omit({ unitId: true, tenantId: true }).partial();

router.use(requireAuth());

// GET /leases?unitId=...&tenantId=...&status=...
router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { unitId, tenantId, status } = req.query;

  const leases = await prisma.lease.findMany({
    where: {
      unit: { property: { userId: user.id } },
      ...(unitId && { unitId: unitId as string }),
      ...(tenantId && { tenantId: tenantId as string }),
      ...(status && { status: status as LeaseStatus }),
    },
    include: {
      unit: {
        include: { property: { select: { id: true, name: true, address: true } } },
      },
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { startDate: 'desc' },
  });
  res.json(leases);
});

// POST /leases
router.post('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = createLeaseSchema.parse(req.body);

  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId, property: { userId: user.id } },
  });
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  const tenant = await prisma.tenant.findFirst({ where: { id: data.tenantId } });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const lease = await prisma.lease.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
    include: {
      unit: { include: { property: { select: { id: true, name: true } } } },
      tenant: true,
    },
  });
  res.status(201).json(lease);
});

// PATCH /leases/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = updateLeaseSchema.parse(req.body);

  const existing = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { userId: user.id } } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Lease not found' });
    return;
  }

  const lease = await prisma.lease.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
    },
    include: {
      unit: { include: { property: { select: { id: true, name: true } } } },
      tenant: true,
    },
  });
  res.json(lease);
});

// POST /leases/:id/document — upload lease PDF (raw body, Content-Type: application/pdf)
router.post('/:id/document', express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '20mb' }), async (req: Request, res: Response) => {
  const user = (req as any).user;

  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { userId: user.id } } },
  });
  if (!lease) {
    res.status(404).json({ error: 'Lease not found' });
    return;
  }

  const key = `leases/${lease.id}/document.pdf`;
  await uploadFile(key, req.body as Buffer, 'application/pdf');

  const updated = await prisma.lease.update({
    where: { id: req.params.id },
    data: { documentPath: key },
  });

  res.json({ ok: true, documentPath: updated.documentPath });
});

// GET /leases/:id/document — get signed URL or redirect for lease PDF
router.get('/:id/document', async (req: Request, res: Response) => {
  const user = (req as any).user;

  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { userId: user.id } } },
  });
  if (!lease) {
    res.status(404).json({ error: 'Lease not found' });
    return;
  }
  if (!lease.documentPath) {
    res.status(404).json({ error: 'No document uploaded' });
    return;
  }

  const url = await getFileUrl(lease.documentPath);
  res.redirect(url);
});

export default router;
