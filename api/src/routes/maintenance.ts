import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { MaintenanceStatus } from '@prisma/client';

const router = Router();
router.use(requireAuth());

// GET /maintenance?status=OPEN&unitId=...
router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { status, unitId } = req.query;

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      unit: { property: { userId: user.id } },
      ...(status && { status: status as MaintenanceStatus }),
      ...(unitId && { unitId: unitId as string }),
    },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
      unit: {
        include: { property: { select: { id: true, name: true, address: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
});

// GET /maintenance/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;

  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: req.params.id, unit: { property: { userId: user.id } } },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
      unit: {
        include: { property: { select: { id: true, name: true, address: true } } },
      },
    },
  });

  if (!request) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }

  res.json(request);
});

// PATCH /maintenance/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const schema = z.object({
    status: z.nativeEnum(MaintenanceStatus).optional(),
    landlordNote: z.string().optional(),
  });
  const data = schema.parse(req.body);

  const existing = await prisma.maintenanceRequest.findFirst({
    where: { id: req.params.id, unit: { property: { userId: user.id } } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Maintenance request not found' });
    return;
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id: req.params.id },
    data,
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
      unit: {
        include: { property: { select: { id: true, name: true, address: true } } },
      },
    },
  });

  res.json(updated);
});

export default router;
